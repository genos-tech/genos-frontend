import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import ChevronLeftRoundedIcon from "@mui/icons-material/ChevronLeftRounded";
import ChevronRightRoundedIcon from "@mui/icons-material/ChevronRightRounded";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import VideoCameraFrontRoundedIcon from "@mui/icons-material/VideoCameraFrontRounded";
import {
    Alert,
    Box,
    Button,
    ButtonGroup,
    Chip,
    CircularProgress,
    IconButton,
    Modal,
    ModalDialog,
    Stack,
    Typography,
} from "@mui/joy";
import { useColorScheme } from "@mui/joy/styles";
import dayjs, { Dayjs } from "dayjs";

import { useAuth } from "../../../context/AuthContext";
import { useCalendarViewPreference } from "../../../hooks/common/useCalendarViewPreference";
import { useTranslation } from "../../../i18n";
import { CalendarEventModal } from "../../integrations/components/CalendarEventModal";
import { ReconnectGoogleCalendarButton } from "../../integrations/components/ReconnectGoogleCalendarButton";
import {
    CalendarEvent,
    listEventsAggregate,
    sourceKey,
} from "../../integrations/services/calendar";
import {
    findGoogleConnections,
    hasAnyCalendarScope,
    listConnections,
    type Connection,
    type ConnectionsResponse,
} from "../../integrations/services/connections";
import { redirectToOAuthConnect } from "../../integrations/services/oauth";
import { isWritableCalendar, useCalendarSources } from "../hooks/useCalendarSources";
import { useStickyPeriodScroll } from "../hooks/useStickyPeriodScroll";
import { eventLabel } from "../utils/eventLabel";
import { CalendarView, visibleRange } from "../utils/monthGrid";
import { isMultiDaySpan } from "../utils/multiDay";
import { CalendarSourcePicker } from "./CalendarSourcePicker";
import { MonthView } from "./MonthView";
import { TimelineView } from "./TimelineView";

interface CalendarModalProps {
    open: boolean;
    onClose: () => void;
}

const dayKey = (d: Dayjs): string => d.format("YYYY-MM-DD");

const eventStart = (e: CalendarEvent): Dayjs | null => {
    const raw = e.start?.dateTime || e.start?.date;
    if (!raw) return null;
    const d = dayjs(raw);
    return d.isValid() ? d : null;
};

const eventEndInclusive = (e: CalendarEvent): Dayjs | null => {
    if (e.end?.dateTime) {
        const d = dayjs(e.end.dateTime);
        return d.isValid() ? d : null;
    }
    if (e.end?.date) {
        const d = dayjs(e.end.date).subtract(1, "day");
        return d.isValid() ? d : null;
    }
    return null;
};

/** Bucket events into the days they intersect. Out-of-range events are
 *  silently dropped.
 *
 *  `skipSpans` excludes multi-day all-day events, which MonthView draws
 *  as one continuous bar instead of a chip per day. Without it the same
 *  event renders TWICE on every day it covers — once as the bar, once
 *  as a chip.
 *
 *  Both variants are needed: the grid wants chips-only, while the "+N
 *  more" popover is "everything on this day" and must still list the
 *  spans. */
const groupEventsByDay = (
    events: CalendarEvent[],
    from: Dayjs,
    to: Dayjs,
    { skipSpans }: { skipSpans: boolean }
): Record<string, CalendarEvent[]> => {
    const out: Record<string, CalendarEvent[]> = {};
    for (const e of events) {
        if (skipSpans && isMultiDaySpan(e)) continue;
        const start = eventStart(e);
        if (!start) continue;
        const end = eventEndInclusive(e) ?? start;
        const lo = start.isBefore(from) ? from : start;
        const hi = end.isAfter(to) ? to : end;
        let cursor = lo.startOf("day");
        const stop = hi.startOf("day");
        while (!cursor.isAfter(stop)) {
            const key = dayKey(cursor);
            (out[key] ??= []).push(e);
            cursor = cursor.add(1, "day");
        }
    }
    return out;
};

interface ModalInitial {
    account_id?: string;
    /** Master id when the event is one occurrence of a series. */
    recurring_event_id?: string;
    add_meet?: boolean;
    all_day?: boolean;
    attendees?: Array<{ email: string; displayName?: string }>;
    calendar_id?: string;
    description?: string;
    end?: string;
    start?: string;
    summary?: string;
}

export const CalendarModal = ({ open, onClose }: CalendarModalProps) => {
    const { accessToken } = useAuth();
    const { t } = useTranslation();
    const { mode } = useColorScheme();
    const isDark = mode === "dark";

    // View persisted to localStorage so reopening the modal lands
    // on whatever granularity the user was last using. Anchor is
    // intentionally NOT persisted — the user expects "Today" each
    // time they reopen, not the calendar window from last week.
    const [view, setView] = useCalendarViewPreference();
    // Anchor semantics depend on view: start-of-month for Month,
    // any day inside the visible window for Week (snapped via
    // `visibleRange`), the specific day for Day / 3-day.
    const [anchor, setAnchor] = useState<Dayjs>(() => dayjs().startOf("day"));
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [needsConnect, setNeedsConnect] = useState(false);
    const [needsScope, setNeedsScope] = useState(false);
    // Google accounts the user has connected. Held so per-account
    // failures can be reported by email rather than by opaque id.
    const [googleAccounts, setGoogleAccounts] = useState<Connection[]>([]);
    // Sources whose fetch failed while others succeeded. Rendered as a
    // banner ABOVE a still-populated grid: with two accounts overlaid,
    // a dead refresh token on the personal one must not hide the work
    // calendar. This is why the state is a list rather than the single
    // `needsReconnect` boolean it replaced.
    const [failedSourceKeys, setFailedSourceKeys] = useState<
        Array<{ accountId: string; reason: string }>
    >([]);

    const sources = useCalendarSources(accessToken, open && !needsConnect);
    const { selectedSources, colorBySource, calendars } = sources;

    // Per-(view, range-start, selection) cache. Switching views or
    // paging back to a previously-viewed window doesn't refetch.
    // Cleared on close so re-opening pulls fresh.
    // Failures are cached ALONGSIDE the items, not separately: a cache
    // hit returns early, so keeping them apart left the banner showing
    // failures from whichever window was fetched last while the user
    // paged back to a healthy one.
    const cacheRef = useRef<
        Map<
            string,
            { items: CalendarEvent[]; failed: Array<{ accountId: string; reason: string }> }
        >
    >(new Map());
    const [events, setEvents] = useState<CalendarEvent[]>([]);

    const [popoverDayKey, setPopoverDayKey] = useState<string | null>(null);
    const [eventModalOpen, setEventModalOpen] = useState(false);
    const [eventModalInitial, setEventModalInitial] = useState<ModalInitial | undefined>(
        undefined
    );
    const [editingEventId, setEditingEventId] = useState<string | undefined>(undefined);

    const range = useMemo(() => visibleRange(view, anchor, 0), [view, anchor]);

    // The selection is part of the cache identity — ticking another
    // calendar has to invalidate the window the user is looking at, or
    // they'd toggle a calendar on and see no change. Sorted so a
    // reordering of the same set stays one cache entry.
    const selectionFingerprint = useMemo(
        () =>
            selectedSources
                .map((s) => sourceKey(s.accountId, s.calendarId))
                .sort()
                .join("|"),
        [selectedSources]
    );
    const cacheKey = useMemo(
        () => `${view}:${range.start.toISOString()}:${selectionFingerprint}`,
        [view, range.start, selectionFingerprint]
    );

    // Chips only — multi-day spans are drawn as bars by MonthView.
    const eventsByDay = useMemo(
        () =>
            view === "month"
                ? groupEventsByDay(events, range.start, range.end, { skipSpans: true })
                : ({} as Record<string, CalendarEvent[]>),
        [events, view, range.start, range.end]
    );

    // Everything covering each day, spans included. Drives the "+N more"
    // popover, which promises "everything on this day" — a multi-day
    // event must still be reachable there even though the grid shows it
    // as a bar rather than a chip.
    const allEventsByDay = useMemo(
        () =>
            view === "month"
                ? groupEventsByDay(events, range.start, range.end, { skipSpans: false })
                : ({} as Record<string, CalendarEvent[]>),
        [events, view, range.start, range.end]
    );

    useEffect(() => {
        if (!open) return;
        if (!accessToken) {
            setNeedsConnect(true);
            setNeedsScope(false);
            return;
        }
        let cancelled = false;
        setNeedsConnect(false);
        setNeedsScope(false);
        void (async () => {
            const res: ConnectionsResponse | null = await listConnections(accessToken);
            if (cancelled) return;
            const google = findGoogleConnections(res);
            setGoogleAccounts(google);
            if (google.length === 0) {
                setNeedsConnect(true);
                return;
            }
            // "Some account can read calendars", not "every account
            // can": one unscoped account shouldn't present as though
            // Calendar is unavailable when another one works.
            if (!hasAnyCalendarScope(google)) {
                setNeedsScope(true);
                return;
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [open, accessToken]);

    const fetchEvents = useCallback(
        async (key: string, useCache: boolean) => {
            if (!accessToken) return;
            if (useCache) {
                const cached = cacheRef.current.get(key);
                if (cached) {
                    setEvents(cached.items);
                    setFailedSourceKeys(cached.failed);
                    return;
                }
            }
            setLoading(true);
            setError(null);
            const res = await listEventsAggregate(
                accessToken,
                {
                    from: range.start.toISOString(),
                    to: range.end.toISOString(),
                    sources: selectedSources,
                },
                setError
            );
            setLoading(false);
            if (!res || typeof res === "string") {
                // Endpoint-level failure. `listEventsAggregate` already
                // surfaced the message; per-source problems arrive via
                // `failed_sources` instead and are handled below.
                return;
            }
            const items = res.items || [];
            const failed = res.failed_sources.map((f) => ({
                accountId: f.account_id,
                reason: f.reason,
            }));
            cacheRef.current.set(key, { items, failed });
            setEvents(items);
            setFailedSourceKeys(failed);
        },
        [accessToken, range.start, range.end, selectedSources]
    );

    useEffect(() => {
        if (!open || !accessToken || needsConnect || needsScope) return;
        // Wait for the calendar list before the first fetch: firing with
        // an empty selection would ask the server for nothing and cache
        // an empty result against this window.
        if (!sources.loaded) return;
        let cancelled = false;
        void (async () => {
            if (cancelled) return;
            await fetchEvents(cacheKey, true);
        })();
        return () => {
            cancelled = true;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open, accessToken, needsConnect, needsScope, cacheKey, sources.loaded]);

    useEffect(() => {
        if (!open) {
            cacheRef.current.clear();
            setEvents([]);
            setPopoverDayKey(null);
            setError(null);
            setFailedSourceKeys([]);
            // Reset the anchor (so the user always reopens onto
            // "today") but preserve the view — the view is the
            // user's persistent preference (see
            // `useCalendarViewPreference`) and reopening should
            // land them on the same granularity they left.
            setAnchor(dayjs().startOf("day"));
        }
    }, [open]);

    const refreshCurrent = useCallback(() => {
        cacheRef.current.delete(cacheKey);
        void fetchEvents(cacheKey, false);
    }, [cacheKey, fetchEvents]);

    const showGrid = !needsConnect && !needsScope;

    const stepBackward = () => {
        if (view === "month") setAnchor(anchor.subtract(1, "month"));
        else if (view === "week") setAnchor(anchor.subtract(7, "day"));
        else if (view === "3day") setAnchor(anchor.subtract(3, "day"));
        else setAnchor(anchor.subtract(1, "day"));
    };
    const stepForward = () => {
        if (view === "month") setAnchor(anchor.add(1, "month"));
        else if (view === "week") setAnchor(anchor.add(7, "day"));
        else if (view === "3day") setAnchor(anchor.add(3, "day"));
        else setAnchor(anchor.add(1, "day"));
    };
    const jumpToday = () => setAnchor(dayjs().startOf(view === "month" ? "month" : "day"));

    // Horizontal scroll pages through periods, using the same steppers
    // as the chevrons so Month/Week/3-day/Day all move by their own
    // unit. Deliberately "sticky" — see `utils/stickyScroll` for why a
    // raw wheel-to-step mapping is unusable on a trackpad.
    const gridScrollRef = useStickyPeriodScroll<HTMLDivElement>({
        onPrev: stepBackward,
        onNext: stepForward,
        enabled: showGrid,
    });

    const headerTitle = useMemo(() => {
        if (view === "month") return anchor.format("MMMM YYYY");
        if (view === "day") return anchor.format("MMMM D, YYYY");
        const start = range.start;
        const last = range.end;
        // Compact range labels: same month "May 19 – 25, 2026",
        // crossing months "Apr 28 – May 4, 2026". Year always at
        // the end so the user keeps their place when paging.
        if (start.isSame(last, "month")) {
            return `${start.format("MMM D")} – ${last.format("D, YYYY")}`;
        }
        return `${start.format("MMM D")} – ${last.format("MMM D, YYYY")}`;
    }, [view, anchor, range.start, range.end]);

    /** Default target for a newly created event: the first SELECTED
     *  calendar the user can actually write to. Picking a read-only
     *  shared calendar here would fail at save time with a 403, and
     *  falling back to the account default would silently file the
     *  event somewhere the user isn't looking. */
    const defaultCreateTarget = useMemo(() => {
        const writable = calendars.find(
            (c) => sources.selectedKeys.has(sourceKey(c.account_id, c.id)) && isWritableCalendar(c)
        );
        return writable
            ? { account_id: writable.account_id, calendar_id: writable.id }
            : undefined;
    }, [calendars, sources.selectedKeys]);

    const openCreateOn = (day: Dayjs) => {
        const at9 = day.hour(9).minute(0).second(0).millisecond(0);
        const at10 = at9.add(1, "hour");
        setEditingEventId(undefined);
        setEventModalInitial({
            ...defaultCreateTarget,
            end: at10.toISOString(),
            start: at9.toISOString(),
        });
        setEventModalOpen(true);
    };

    const openCreateAt = (start: Dayjs) => {
        const end = start.add(1, "hour");
        setEditingEventId(undefined);
        setEventModalInitial({
            ...defaultCreateTarget,
            end: end.toISOString(),
            start: start.toISOString(),
        });
        setEventModalOpen(true);
    };

    const openEdit = (e: CalendarEvent) => {
        setEditingEventId(e.id);
        // All-day events carry `start.date`/`end.date` (no `dateTime`).
        // Pass the date strings + the flag so the modal opens in all-day
        // mode instead of showing empty datetime fields.
        const isAllDay = !!e.start?.date && !e.start?.dateTime;
        setEventModalInitial({
            // Carry the event's origin through to the edit modal. Event
            // ids are unique per calendar, not globally, and the account
            // decides which credential the PATCH authenticates with —
            // without both, an edit on the personal calendar would be
            // sent to the work account and 404.
            account_id: e._source?.account_id,
            calendar_id: e._source?.calendar_id,
            // Present only on an occurrence of a repeating series; it's
            // what lets the modal offer "this event / all events".
            recurring_event_id: e.recurringEventId,
            add_meet: !!e.hangoutLink,
            all_day: isAllDay,
            // Pre-populate the attendee picker so the user sees
            // who's already invited and can prune / add. We drop
            // `self`-flagged entries (Google echoes the organizer
            // back) so the modal doesn't insist on re-inviting the
            // current user. External attendees without a team-member
            // match still appear, with email used as displayName.
            attendees: (e.attendees ?? [])
                .filter((a) => !a.self && !!a.email)
                .map((a) => ({
                    email: a.email,
                    displayName: a.displayName,
                })),
            description: e.description,
            end: isAllDay ? e.end?.date : e.end?.dateTime,
            start: isAllDay ? e.start?.date : e.start?.dateTime,
            summary: e.summary,
        });
        setEventModalOpen(true);
    };

    const viewButton = (target: CalendarView, label: string) => (
        <Button
            key={target}
            aria-pressed={view === target}
            size="sm"
            variant={view === target ? "solid" : "outlined"}
            onClick={() => setView(target)}
        >
            {label}
        </Button>
    );

    const startConnectFlow = useCallback(() => {
        if (!accessToken) return;
        void redirectToOAuthConnect("google", accessToken, undefined, () => undefined);
    }, [accessToken]);

    // Per-account failures, de-duplicated and resolved to an email so
    // the banner can name which account needs attention.
    const accountIssues = useMemo(() => {
        const emailById = new Map(googleAccounts.map((a) => [a.id, a.label]));
        const seen = new Map<string, string>();
        for (const f of failedSourceKeys) {
            if (!seen.has(f.accountId)) seen.set(f.accountId, f.reason);
        }
        for (const f of sources.failedAccounts) {
            if (!seen.has(f.account_id)) seen.set(f.account_id, String(f.reason));
        }
        return [...seen.entries()].map(([accountId, reason]) => ({
            accountId,
            reason,
            email: emailById.get(accountId) ?? t.calendar.sources.unknownAccount,
        }));
    }, [failedSourceKeys, sources.failedAccounts, googleAccounts, t]);

    return (
        <Modal open={open} onClose={onClose}>
            <ModalDialog
                className={`custom-scrollbar-${isDark ? "dark" : "light"}`}
                size="lg"
                sx={{
                    // Wider to make room for the timeline views —
                    // 7 day columns plus the hour gutter need
                    // ~140px per column to keep overlapping event
                    // blocks legible. The extra ~240px over the
                    // pre-multi-account width is the source rail.
                    width: { xs: "96vw", md: 1340 },
                    maxWidth: "96vw",
                    maxHeight: "92vh",
                    p: 2,
                    overflow: "hidden",
                    display: "flex",
                    flexDirection: "column",
                }}
            >
                <Stack
                    alignItems="center"
                    direction="row"
                    spacing={1}
                    sx={{ mb: 1.5, flexShrink: 0, flexWrap: "wrap" }}
                >
                    <IconButton
                        aria-label={t.calendar.prev}
                        size="sm"
                        variant="plain"
                        onClick={stepBackward}
                    >
                        <ChevronLeftRoundedIcon />
                    </IconButton>
                    <Typography level="title-lg" sx={{ minWidth: 200, textAlign: "center" }}>
                        {headerTitle}
                    </Typography>
                    <IconButton
                        aria-label={t.calendar.next}
                        size="sm"
                        variant="plain"
                        onClick={stepForward}
                    >
                        <ChevronRightRoundedIcon />
                    </IconButton>
                    <Button size="sm" variant="outlined" onClick={jumpToday}>
                        {t.calendar.today}
                    </Button>
                    <Box sx={{ flex: 1 }} />
                    {/* View tabs — segmented button group. The
                        active view gets `solid`, others `outlined`.
                        Ordered widest → narrowest so the user's
                        eye scans the granularity. */}
                    <ButtonGroup size="sm" variant="outlined">
                        {viewButton("month", t.calendar.views.month)}
                        {viewButton("week", t.calendar.views.week)}
                        {viewButton("3day", t.calendar.views.threeDay)}
                        {viewButton("day", t.calendar.views.day)}
                    </ButtonGroup>
                    {loading && <CircularProgress size="sm" />}
                    <IconButton
                        aria-label={t.calendar.close}
                        size="sm"
                        variant="plain"
                        onClick={onClose}
                    >
                        <CloseRoundedIcon />
                    </IconButton>
                </Stack>

                {error && (
                    <Alert color="danger" sx={{ mb: 1.5, flexShrink: 0 }}>
                        {error}
                    </Alert>
                )}

                {needsConnect && accessToken && (
                    <Alert color="primary" sx={{ mb: 1.5, flexShrink: 0 }}>
                        <Stack
                            alignItems="center"
                            direction="row"
                            spacing={1.5}
                            sx={{ width: "100%" }}
                        >
                            <Box sx={{ flex: 1 }}>{t.calendar.connectPrompt}</Box>
                            <Button size="sm" onClick={startConnectFlow}>
                                {t.calendar.connectButton}
                            </Button>
                        </Stack>
                    </Alert>
                )}

                {needsScope && accessToken && (
                    <Alert color="warning" sx={{ mb: 1.5, flexShrink: 0 }}>
                        <Stack
                            alignItems="center"
                            direction="row"
                            spacing={1.5}
                            sx={{ width: "100%" }}
                        >
                            <Box sx={{ flex: 1 }}>{t.calendar.scopePrompt}</Box>
                            <Button size="sm" onClick={startConnectFlow}>
                                {t.calendar.grantButton}
                            </Button>
                        </Stack>
                    </Alert>
                )}

                {/* Per-account trouble. Deliberately rendered ALONGSIDE
                    the grid, not instead of it: the whole point of the
                    multi-account view is that one broken account leaves
                    the others readable. */}
                {showGrid && accessToken && accountIssues.length > 0 && (
                    <Alert color="warning" sx={{ mb: 1.5, flexShrink: 0 }}>
                        <Stack spacing={0.5} sx={{ width: "100%" }}>
                            {accountIssues.map((issue) => (
                                <Stack
                                    key={issue.accountId}
                                    alignItems="center"
                                    direction="row"
                                    spacing={1.5}
                                    sx={{ width: "100%" }}
                                >
                                    <Box sx={{ flex: 1 }}>
                                        {issue.reason === "calendar_scope_missing"
                                            ? t.calendar.sources.accountScopeNeeded.replace(
                                                  "{email}",
                                                  issue.email
                                              )
                                            : issue.reason === "google_reauth_required"
                                              ? t.calendar.sources.accountReauthNeeded.replace(
                                                    "{email}",
                                                    issue.email
                                                )
                                              : t.calendar.sources.partialFailure}
                                    </Box>
                                    {(issue.reason === "google_reauth_required" ||
                                        issue.reason === "calendar_scope_missing") && (
                                        <ReconnectGoogleCalendarButton
                                            accessToken={accessToken}
                                            label={t.calendar.reconnectButton}
                                            size="sm"
                                        />
                                    )}
                                </Stack>
                            ))}
                        </Stack>
                    </Alert>
                )}

                {showGrid && (
                    <Stack
                        direction="row"
                        spacing={1.5}
                        sx={{ flex: 1, minHeight: 0, overflow: "hidden" }}
                    >
                        <CalendarSourcePicker
                            calendars={sources.calendars}
                            colorBySource={colorBySource}
                            loading={sources.loading}
                            selectedKeys={sources.selectedKeys}
                            onAddAccount={startConnectFlow}
                            onToggle={sources.toggleSource}
                            onToggleAccount={sources.setAccountSelected}
                        />
                        <Box
                            ref={gridScrollRef}
                            sx={{
                                flex: 1,
                                minWidth: 0,
                                display: "flex",
                                flexDirection: "column",
                                // The sticky-scroll handler owns
                                // horizontal gestures here; keeping the
                                // pane non-scrollable sideways means
                                // there is nothing for it to fight.
                                overflowX: "hidden",
                            }}
                        >
                            {selectedSources.length === 0 && sources.loaded ? (
                                <Stack
                                    alignItems="center"
                                    justifyContent="center"
                                    sx={{ flex: 1, opacity: 0.65 }}
                                >
                                    <Typography level="body-sm">
                                        {t.calendar.sources.emptySelection}
                                    </Typography>
                                </Stack>
                            ) : view === "month" ? (
                                <MonthView
                                    colorBySource={colorBySource}
                                    events={events}
                                    busyLabel={t.calendar.busy}
                                    eventsByDay={eventsByDay}
                                    focused={anchor.startOf("month")}
                                    freeBusySources={sources.freeBusySources}
                                    onCellClick={openCreateOn}
                                    onEventClick={openEdit}
                                    onShowMore={setPopoverDayKey}
                                />
                            ) : (
                                <TimelineView
                                    anchor={anchor}
                                    busyLabel={t.calendar.busy}
                                    colorBySource={colorBySource}
                                    events={events}
                                    freeBusySources={sources.freeBusySources}
                                    view={view}
                                    onCreateAt={openCreateAt}
                                    onEventClick={openEdit}
                                />
                            )}
                        </Box>
                    </Stack>
                )}

                {/* +N more popover — only meaningful in Month view
                    since timeline views show every event already. */}
                <Modal open={popoverDayKey !== null} onClose={() => setPopoverDayKey(null)}>
                    <ModalDialog size="md" sx={{ minWidth: 320 }}>
                        <Stack alignItems="center" direction="row" spacing={1} sx={{ mb: 1 }}>
                            <Typography level="title-md">
                                {popoverDayKey ? dayjs(popoverDayKey).format("MMMM D") : ""}
                            </Typography>
                            <Box sx={{ flex: 1 }} />
                            <IconButton
                                aria-label={t.calendar.close}
                                size="sm"
                                variant="plain"
                                onClick={() => setPopoverDayKey(null)}
                            >
                                <CloseRoundedIcon />
                            </IconButton>
                        </Stack>
                        <Stack spacing={0.5}>
                            {(popoverDayKey ? (allEventsByDay[popoverDayKey] ?? []) : []).map(
                                (e, idx) => {
                                    const color = e._source
                                        ? colorBySource[
                                              sourceKey(
                                                  e._source.account_id,
                                                  e._source.calendar_id
                                              )
                                          ]
                                        : undefined;
                                    return (
                                        <Chip
                                            key={`${e.id}-${idx}`}
                                            size="md"
                                            variant="soft"
                                            sx={{
                                                cursor: "pointer",
                                                justifyContent: "flex-start",
                                                // Colored left rule ties the row
                                                // back to its calendar in the rail.
                                                borderLeft: color
                                                    ? `3px solid ${color}`
                                                    : undefined,
                                            }}
                                            startDecorator={
                                                e.hangoutLink ? (
                                                    <VideoCameraFrontRoundedIcon
                                                        sx={{ fontSize: 14 }}
                                                    />
                                                ) : undefined
                                            }
                                            onClick={() => {
                                                setPopoverDayKey(null);
                                                openEdit(e);
                                            }}
                                        >
                                            {eventLabel(
                                                e,
                                                sources.freeBusySources,
                                                t.calendar.busy
                                            )}
                                        </Chip>
                                    );
                                }
                            )}
                        </Stack>
                    </ModalDialog>
                </Modal>

                {accessToken && (
                    <CalendarEventModal
                        accessToken={accessToken}
                        calendars={sources.calendars}
                        editingEventId={editingEventId}
                        initial={eventModalInitial}
                        open={eventModalOpen}
                        onClose={() => setEventModalOpen(false)}
                        onError={setError}
                        onDeleted={() => {
                            refreshCurrent();
                        }}
                        onSaved={() => {
                            refreshCurrent();
                        }}
                    />
                )}
            </ModalDialog>
        </Modal>
    );
};
