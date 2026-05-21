import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import ChevronLeftRoundedIcon from "@mui/icons-material/ChevronLeftRounded";
import ChevronRightRoundedIcon from "@mui/icons-material/ChevronRightRounded";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import VideoCameraFrontRoundedIcon from "@mui/icons-material/VideoCameraFrontRounded";
import {
    Alert,
    Box,
    Button,
    Chip,
    CircularProgress,
    IconButton,
    Modal,
    ModalDialog,
    Sheet,
    Stack,
    Tooltip,
    Typography,
} from "@mui/joy";
import { useColorScheme } from "@mui/joy/styles";
import dayjs, { Dayjs } from "dayjs";

import { useAuth } from "../../../context/AuthContext";
import { useTranslation } from "../../../i18n";
import { CalendarEventModal } from "../../integrations/components/CalendarEventModal";
import { CalendarEvent, listEvents } from "../../integrations/services/calendar";
import {
    findGoogleConnection,
    hasCalendarScope,
    listConnections,
    type ConnectionsResponse,
} from "../../integrations/services/connections";
import { redirectToOAuthConnect } from "../../integrations/services/oauth";
import { buildMonthGrid, weekdayLabels } from "../utils/monthGrid";

interface CalendarModalProps {
    open: boolean;
    onClose: () => void;
}

const MAX_CHIPS_PER_CELL = 2;

/** ISO date key ("YYYY-MM-DD") — same shape Google uses for all-day
 *  events, so an event with `start.date === dayKey(d)` lines up
 *  directly with the cell. */
const dayKey = (d: Dayjs): string => d.format("YYYY-MM-DD");
const monthKey = (d: Dayjs): string => d.format("YYYY-MM");

/** Best-effort start-of-event Dayjs from either `dateTime` (timed)
 *  or `date` (all-day). Returns null on a malformed event so the
 *  bucketer can skip it instead of crashing the grid. */
const eventStart = (e: CalendarEvent): Dayjs | null => {
    const raw = e.start?.dateTime || e.start?.date;
    if (!raw) return null;
    const d = dayjs(raw);
    return d.isValid() ? d : null;
};

/** End boundary as a Dayjs. For all-day events Google's `end.date`
 *  is EXCLUSIVE, so a 1-day event with start "Mon" has end "Tue".
 *  We collapse to inclusive-end here. Returns null if missing so
 *  callers can fall back to a single-day render. */
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

/** Bucket events into the days they intersect within [from, to].
 *  Multi-day all-day events appear in every cell they span — the
 *  monthly grid doesn't support spanning bars in v1 (see plan F3/§3.4
 *  Phase 3). Out-of-range events are silently dropped. */
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
        // Clamp to the visible range so a 30-day event doesn't
        // explode the bucket map. The grid only renders cells in
        // [from, to] anyway.
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

/** Truncated chip label. Long titles otherwise overflow the cell
 *  and the row height jumps. CSS ellipsis on a fixed width would
 *  also work; doing it in JS keeps the chip width fluid. */
const chipLabel = (e: CalendarEvent): string => {
    const raw = e.summary || "(no title)";
    return raw.length > 18 ? `${raw.slice(0, 17)}…` : raw;
};

interface ModalInitial {
    add_meet?: boolean;
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

    const [focused, setFocused] = useState<Dayjs>(() => dayjs().startOf("month"));
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [needsConnect, setNeedsConnect] = useState(false);
    const [needsScope, setNeedsScope] = useState(false);

    // Per-month cache so paging back to a previously-viewed month
    // doesn't refetch. Drops on close — staleness across modal
    // sessions doesn't matter for a UI surface this casual.
    const cacheRef = useRef<Map<string, CalendarEvent[]>>(new Map());

    const [eventsByDay, setEventsByDay] = useState<Record<string, CalendarEvent[]>>({});

    // Day popover ("+N more") state.
    const [popoverDayKey, setPopoverDayKey] = useState<string | null>(null);

    // Embedded event modal state.
    const [eventModalOpen, setEventModalOpen] = useState(false);
    const [eventModalInitial, setEventModalInitial] = useState<ModalInitial | undefined>(
        undefined
    );
    const [editingEventId, setEditingEventId] = useState<string | undefined>(undefined);

    const grid = useMemo(() => buildMonthGrid(focused, 0), [focused]);
    const weekLabels = useMemo(() => weekdayLabels(0), []);
    const visibleFrom = grid[0][0];
    const visibleTo = grid[5][6].endOf("day");

    const todayKey = useMemo(() => dayKey(dayjs()), []);

    // Probe connection state when the modal opens. Cheap; runs once
    // per open. If Google isn't connected or lacks the calendar
    // scope, we short-circuit the events query and render a prompt
    // instead — mirrors the gates on the Integrations Calendar tab.
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

    // Fetch events for the focused month's visible range. Cache hit
    // → reuse; cache miss → fetch and store. We re-group every time
    // since the grouping result is keyed by `from/to` and stays
    // local to this render.
    useEffect(() => {
        if (!open || !accessToken || needsConnect || needsScope) return;
        const key = monthKey(focused);
        const cached = cacheRef.current.get(key);
        if (cached) {
            setEventsByDay(groupEventsByDay(cached, visibleFrom, visibleTo));
            return;
        }
        let cancelled = false;
        setLoading(true);
        setError(null);
        (async () => {
            const res = await listEvents(
                accessToken,
                { from: visibleFrom.toISOString(), to: visibleTo.toISOString() },
                setError
            );
            if (cancelled) return;
            setLoading(false);
            if (!res || typeof res === "string") return;
            const items = res.items || [];
            cacheRef.current.set(key, items);
            setEventsByDay(groupEventsByDay(items, visibleFrom, visibleTo));
        })();
        return () => {
            cancelled = true;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open, accessToken, needsConnect, needsScope, focused]);

    // Drop the cache when the modal closes so re-opening pulls
    // fresh data (Calendar API edits from another device / window
    // won't otherwise be reflected).
    useEffect(() => {
        if (!open) {
            cacheRef.current.clear();
            setEventsByDay({});
            setPopoverDayKey(null);
            setError(null);
        }
    }, [open]);

    const refreshFocused = useCallback(() => {
        if (!accessToken) return;
        const key = monthKey(focused);
        cacheRef.current.delete(key);
        // Same fetch path as the effect; cheaper to inline than to
        // factor out and risk a stale-closure trap.
        (async () => {
            setLoading(true);
            const res = await listEvents(
                accessToken,
                { from: visibleFrom.toISOString(), to: visibleTo.toISOString() },
                setError
            );
            setLoading(false);
            if (!res || typeof res === "string") return;
            const items = res.items || [];
            cacheRef.current.set(key, items);
            setEventsByDay(groupEventsByDay(items, visibleFrom, visibleTo));
        })();
    }, [accessToken, focused, visibleFrom, visibleTo]);

    const openCreateOn = (day: Dayjs) => {
        // Default to a sensible 9–10 AM slot on the clicked day —
        // the event modal uses datetime-local inputs so the user
        // can still adjust before saving. All-day support comes
        // with the modal's `allDay` extension in a later phase.
        const at9 = day.hour(9).minute(0).second(0).millisecond(0);
        const at10 = at9.add(1, "hour");
        setEditingEventId(undefined);
        setEventModalInitial({
            end: at10.toISOString(),
            start: at9.toISOString(),
        });
        setEventModalOpen(true);
    };

    const openEdit = (e: CalendarEvent) => {
        setEditingEventId(e.id);
        setEventModalInitial({
            add_meet: !!e.hangoutLink,
            description: e.description,
            end: e.end?.dateTime,
            start: e.start?.dateTime,
            summary: e.summary,
        });
        setEventModalOpen(true);
    };

    const accent = isDark ? "rgba(124,58,237,0.85)" : "rgba(124,58,237,1)";
    const cellBorder = isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.08)";
    const dimmedText = isDark ? "rgba(255,255,255,0.35)" : "rgba(0,0,0,0.35)";

    return (
        <Modal open={open} onClose={onClose}>
            <ModalDialog
                size="lg"
                sx={{
                    width: { xs: "94vw", md: 880 },
                    maxWidth: 900,
                    maxHeight: "90vh",
                    p: 2,
                    overflow: "hidden",
                    display: "flex",
                    flexDirection: "column",
                }}
            >
                {/* Header */}
                <Stack
                    alignItems="center"
                    direction="row"
                    spacing={1}
                    sx={{ mb: 1.5, flexShrink: 0 }}
                >
                    <IconButton
                        size="sm"
                        variant="plain"
                        onClick={() => setFocused(focused.subtract(1, "month"))}
                        aria-label={t.calendar.prevMonth}
                    >
                        <ChevronLeftRoundedIcon />
                    </IconButton>
                    <Typography level="title-lg" sx={{ minWidth: 180, textAlign: "center" }}>
                        {focused.format("MMMM YYYY")}
                    </Typography>
                    <IconButton
                        size="sm"
                        variant="plain"
                        onClick={() => setFocused(focused.add(1, "month"))}
                        aria-label={t.calendar.nextMonth}
                    >
                        <ChevronRightRoundedIcon />
                    </IconButton>
                    <Button
                        size="sm"
                        variant="outlined"
                        onClick={() => setFocused(dayjs().startOf("month"))}
                    >
                        {t.calendar.today}
                    </Button>
                    <Box sx={{ flex: 1 }} />
                    {loading && <CircularProgress size="sm" />}
                    <IconButton
                        size="sm"
                        variant="plain"
                        onClick={onClose}
                        aria-label={t.calendar.close}
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
                            direction="row"
                            alignItems="center"
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
                            direction="row"
                            alignItems="center"
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

                {!needsConnect && !needsScope && (
                    <>
                        {/* Weekday labels */}
                        <Box
                            sx={{
                                display: "grid",
                                gridTemplateColumns: "repeat(7, minmax(0, 1fr))",
                                gap: 0.5,
                                mb: 0.5,
                                flexShrink: 0,
                            }}
                        >
                            {weekLabels.map((label, i) => (
                                <Box
                                    key={`${label}-${i}`}
                                    sx={{
                                        textAlign: "center",
                                        py: 0.5,
                                        color: dimmedText,
                                        fontSize: "0.75rem",
                                        fontWeight: 600,
                                        letterSpacing: "0.04em",
                                        textTransform: "uppercase",
                                    }}
                                >
                                    {label}
                                </Box>
                            ))}
                        </Box>

                        {/* 6×7 grid */}
                        <Box
                            sx={{
                                display: "grid",
                                gridTemplateColumns: "repeat(7, minmax(0, 1fr))",
                                gridTemplateRows: "repeat(6, minmax(0, 1fr))",
                                gap: 0.5,
                                flex: 1,
                                minHeight: 0,
                                overflow: "auto",
                            }}
                        >
                            {grid.flat().map((day) => {
                                const key = dayKey(day);
                                const inMonth = day.month() === focused.month();
                                const dayEvents = eventsByDay[key] ?? [];
                                const overflow = dayEvents.length - MAX_CHIPS_PER_CELL;
                                const visibleChips = dayEvents.slice(0, MAX_CHIPS_PER_CELL);
                                return (
                                    <Sheet
                                        key={key}
                                        variant="outlined"
                                        sx={{
                                            p: 0.5,
                                            minHeight: 80,
                                            borderRadius: "sm",
                                            borderColor: cellBorder,
                                            cursor: "pointer",
                                            opacity: inMonth ? 1 : 0.55,
                                            transition: "background-color 0.12s ease",
                                            "&:hover": {
                                                backgroundColor: isDark
                                                    ? "rgba(124,58,237,0.08)"
                                                    : "rgba(124,58,237,0.04)",
                                            },
                                        }}
                                        onClick={(ev) => {
                                            // Only open create when the click landed on the
                                            // cell surface itself, not on a chip or the +N
                                            // affordance — those have their own handlers
                                            // that stopPropagation.
                                            if (ev.target === ev.currentTarget) openCreateOn(day);
                                        }}
                                    >
                                        <Stack
                                            alignItems="center"
                                            direction="row"
                                            justifyContent="space-between"
                                            sx={{ mb: 0.25 }}
                                        >
                                            <Typography
                                                level="body-xs"
                                                sx={{
                                                    fontWeight: key === todayKey ? 700 : 500,
                                                    color: key === todayKey ? accent : undefined,
                                                }}
                                            >
                                                {day.date()}
                                            </Typography>
                                        </Stack>
                                        <Stack spacing={0.25}>
                                            {visibleChips.map((e, idx) => (
                                                <Tooltip
                                                    key={`${e.id}-${idx}`}
                                                    title={e.summary || "(no title)"}
                                                    size="sm"
                                                >
                                                    <Chip
                                                        size="sm"
                                                        variant="soft"
                                                        color={
                                                            e.hangoutLink ? "success" : "primary"
                                                        }
                                                        startDecorator={
                                                            e.hangoutLink ? (
                                                                <VideoCameraFrontRoundedIcon
                                                                    sx={{ fontSize: 12 }}
                                                                />
                                                            ) : undefined
                                                        }
                                                        sx={{
                                                            cursor: "pointer",
                                                            maxWidth: "100%",
                                                            "& .MuiChip-label, & > span": {
                                                                overflow: "hidden",
                                                                textOverflow: "ellipsis",
                                                                whiteSpace: "nowrap",
                                                            },
                                                        }}
                                                        onClick={(ev) => {
                                                            ev.stopPropagation();
                                                            openEdit(e);
                                                        }}
                                                    >
                                                        {chipLabel(e)}
                                                    </Chip>
                                                </Tooltip>
                                            ))}
                                            {overflow > 0 && (
                                                <Chip
                                                    size="sm"
                                                    variant="plain"
                                                    color="neutral"
                                                    sx={{ cursor: "pointer" }}
                                                    onClick={(ev) => {
                                                        ev.stopPropagation();
                                                        setPopoverDayKey(key);
                                                    }}
                                                >
                                                    {`+${overflow} ${t.calendar.more}`}
                                                </Chip>
                                            )}
                                        </Stack>
                                    </Sheet>
                                );
                            })}
                        </Box>
                    </>
                )}

                {/* +N more popover — secondary modal listing all
                    events on a single day. Click an event to edit;
                    click outside (or ✕) to close back to the grid. */}
                <Modal open={popoverDayKey !== null} onClose={() => setPopoverDayKey(null)}>
                    <ModalDialog size="md" sx={{ minWidth: 320 }}>
                        <Stack alignItems="center" direction="row" spacing={1} sx={{ mb: 1 }}>
                            <Typography level="title-md">
                                {popoverDayKey ? dayjs(popoverDayKey).format("MMMM D") : ""}
                            </Typography>
                            <Box sx={{ flex: 1 }} />
                            <IconButton
                                size="sm"
                                variant="plain"
                                onClick={() => setPopoverDayKey(null)}
                                aria-label={t.calendar.close}
                            >
                                <CloseRoundedIcon />
                            </IconButton>
                        </Stack>
                        <Stack spacing={0.5}>
                            {(popoverDayKey ? (eventsByDay[popoverDayKey] ?? []) : []).map(
                                (e, idx) => (
                                    <Chip
                                        key={`${e.id}-${idx}`}
                                        size="md"
                                        variant="soft"
                                        color={e.hangoutLink ? "success" : "primary"}
                                        startDecorator={
                                            e.hangoutLink ? (
                                                <VideoCameraFrontRoundedIcon
                                                    sx={{ fontSize: 14 }}
                                                />
                                            ) : undefined
                                        }
                                        sx={{ cursor: "pointer", justifyContent: "flex-start" }}
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

                {/* Lifted event modal — handles both create and
                    edit via `editingEventId`. After save we drop the
                    visible-month cache and refetch so the new chip
                    appears in the grid. */}
                {accessToken && (
                    <CalendarEventModal
                        accessToken={accessToken}
                        open={eventModalOpen}
                        onClose={() => setEventModalOpen(false)}
                        initial={eventModalInitial}
                        editingEventId={editingEventId}
                        onSaved={() => {
                            refreshFocused();
                        }}
                        onError={setError}
                    />
                )}
            </ModalDialog>
        </Modal>
    );
};
