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
import { CalendarEvent, listEvents } from "../../integrations/services/calendar";
import {
    findGoogleConnection,
    hasCalendarScope,
    listConnections,
    type ConnectionsResponse,
} from "../../integrations/services/connections";
import { redirectToOAuthConnect } from "../../integrations/services/oauth";
import { CalendarView, visibleRange } from "../utils/monthGrid";
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

/** Bucket events into the days they intersect for the MonthView.
 *  Multi-day events appear in each day's bucket; out-of-range
 *  events are silently dropped. */
const groupEventsByDay = (
    events: CalendarEvent[],
    from: Dayjs,
    to: Dayjs
): Record<string, CalendarEvent[]> => {
    const out: Record<string, CalendarEvent[]> = {};
    for (const e of events) {
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
    // Connected + scoped on paper, but a live event fetch came back
    // `google_reauth_required` — the stored refresh token is dead. The
    // connection probe (DB scopes) can't see this; only the fetch can.
    const [needsReconnect, setNeedsReconnect] = useState(false);

    // Per-(view, range-start) cache. Switching views or paging
    // back to a previously-viewed window doesn't refetch.
    // Cleared on close so re-opening pulls fresh.
    const cacheRef = useRef<Map<string, CalendarEvent[]>>(new Map());
    const [events, setEvents] = useState<CalendarEvent[]>([]);

    const [popoverDayKey, setPopoverDayKey] = useState<string | null>(null);
    const [eventModalOpen, setEventModalOpen] = useState(false);
    const [eventModalInitial, setEventModalInitial] = useState<ModalInitial | undefined>(
        undefined
    );
    const [editingEventId, setEditingEventId] = useState<string | undefined>(undefined);

    const range = useMemo(() => visibleRange(view, anchor, 0), [view, anchor]);
    const cacheKey = useMemo(() => `${view}:${range.start.toISOString()}`, [view, range.start]);

    const eventsByDay = useMemo(
        () =>
            view === "month"
                ? groupEventsByDay(events, range.start, range.end)
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
        setNeedsReconnect(false);
        (async () => {
            const res: ConnectionsResponse | null = await listConnections(accessToken);
            if (cancelled) return;
            const google = findGoogleConnection(res);
            if (!google) {
                setNeedsConnect(true);
                return;
            }
            if (!hasCalendarScope(google)) {
                setNeedsScope(true);
                return;
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [open, accessToken]);

    useEffect(() => {
        if (!open || !accessToken || needsConnect || needsScope) return;
        const cached = cacheRef.current.get(cacheKey);
        if (cached) {
            setEvents(cached);
            return;
        }
        let cancelled = false;
        setLoading(true);
        setError(null);
        (async () => {
            const res = await listEvents(
                accessToken,
                { from: range.start.toISOString(), to: range.end.toISOString() },
                setError
            );
            if (cancelled) return;
            setLoading(false);
            if (res === "google_reauth_required") {
                // Dead refresh token. Clear the generic error (already
                // set by listEvents) so the reconnect prompt is the
                // single, actionable message.
                setError(null);
                setNeedsReconnect(true);
                return;
            }
            if (!res || typeof res === "string") return;
            const items = res.items || [];
            cacheRef.current.set(cacheKey, items);
            setEvents(items);
        })();
        return () => {
            cancelled = true;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open, accessToken, needsConnect, needsScope, cacheKey]);

    useEffect(() => {
        if (!open) {
            cacheRef.current.clear();
            setEvents([]);
            setPopoverDayKey(null);
            setError(null);
            // Reset the anchor (so the user always reopens onto
            // "today") but preserve the view — the view is the
            // user's persistent preference (see
            // `useCalendarViewPreference`) and reopening should
            // land them on the same granularity they left.
            setAnchor(dayjs().startOf("day"));
        }
    }, [open]);

    const refreshCurrent = useCallback(() => {
        if (!accessToken) return;
        cacheRef.current.delete(cacheKey);
        (async () => {
            setLoading(true);
            const res = await listEvents(
                accessToken,
                { from: range.start.toISOString(), to: range.end.toISOString() },
                setError
            );
            setLoading(false);
            if (res === "google_reauth_required") {
                setError(null);
                setNeedsReconnect(true);
                return;
            }
            if (!res || typeof res === "string") return;
            const items = res.items || [];
            cacheRef.current.set(cacheKey, items);
            setEvents(items);
        })();
    }, [accessToken, cacheKey, range.start, range.end]);

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

    const openCreateOn = (day: Dayjs) => {
        const at9 = day.hour(9).minute(0).second(0).millisecond(0);
        const at10 = at9.add(1, "hour");
        setEditingEventId(undefined);
        setEventModalInitial({
            end: at10.toISOString(),
            start: at9.toISOString(),
        });
        setEventModalOpen(true);
    };

    const openCreateAt = (start: Dayjs) => {
        const end = start.add(1, "hour");
        setEditingEventId(undefined);
        setEventModalInitial({
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

    return (
        <Modal open={open} onClose={onClose}>
            <ModalDialog
                className={`custom-scrollbar-${isDark ? "dark" : "light"}`}
                size="lg"
                sx={{
                    // Wider to make room for the timeline views —
                    // 7 day columns plus the hour gutter need
                    // ~140px per column to keep overlapping event
                    // blocks legible.
                    width: { xs: "96vw", md: 1100 },
                    maxWidth: 1200,
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
                            <Button
                                size="sm"
                                onClick={() =>
                                    void redirectToOAuthConnect(
                                        "google",
                                        accessToken,
                                        undefined,
                                        () => undefined
                                    )
                                }
                            >
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
                            <Button
                                size="sm"
                                onClick={() =>
                                    void redirectToOAuthConnect(
                                        "google",
                                        accessToken,
                                        undefined,
                                        () => undefined
                                    )
                                }
                            >
                                {t.calendar.grantButton}
                            </Button>
                        </Stack>
                    </Alert>
                )}

                {needsReconnect && accessToken && (
                    <Alert color="warning" sx={{ mb: 1.5, flexShrink: 0 }}>
                        <Stack
                            alignItems="center"
                            direction="row"
                            spacing={1.5}
                            sx={{ width: "100%" }}
                        >
                            <Box sx={{ flex: 1 }}>{t.calendar.reauthPrompt}</Box>
                            <ReconnectGoogleCalendarButton
                                accessToken={accessToken}
                                label={t.calendar.reconnectButton}
                                size="sm"
                            />
                        </Stack>
                    </Alert>
                )}

                {!needsConnect && !needsScope && !needsReconnect && (
                    <>
                        {view === "month" ? (
                            <MonthView
                                eventsByDay={eventsByDay}
                                focused={anchor.startOf("month")}
                                onCellClick={openCreateOn}
                                onEventClick={openEdit}
                                onShowMore={setPopoverDayKey}
                            />
                        ) : (
                            <TimelineView
                                anchor={anchor}
                                events={events}
                                view={view}
                                onCreateAt={openCreateAt}
                                onEventClick={openEdit}
                            />
                        )}
                    </>
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
                            {(popoverDayKey ? (eventsByDay[popoverDayKey] ?? []) : []).map(
                                (e, idx) => (
                                    <Chip
                                        key={`${e.id}-${idx}`}
                                        color={e.hangoutLink ? "success" : "primary"}
                                        size="md"
                                        sx={{ cursor: "pointer", justifyContent: "flex-start" }}
                                        variant="soft"
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
                                        {e.summary || "(no title)"}
                                    </Chip>
                                )
                            )}
                        </Stack>
                    </ModalDialog>
                </Modal>

                {accessToken && (
                    <CalendarEventModal
                        accessToken={accessToken}
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
