import { useEffect, useMemo, useState } from "react";
import VideoCameraFrontRoundedIcon from "@mui/icons-material/VideoCameraFrontRounded";
import { Box, Stack, Tooltip, Typography } from "@mui/joy";
import { useColorScheme } from "@mui/joy/styles";
import dayjs, { Dayjs } from "dayjs";

import { useTranslation } from "../../../i18n";
import { CalendarEvent } from "../../integrations/services/calendar";
import { eventLabel } from "../utils/eventLabel";
import { CalendarView, timelineDays } from "../utils/monthGrid";
import { isMultiDaySpan, layoutSpanSegments } from "../utils/multiDay";
import { paletteForEvent } from "../utils/sourceColors";
import {
    eventHeightPx,
    eventTopPx,
    HOUR_BAND_PX,
    isTimedEvent,
    nowOffsetPx,
    OverlapSlot,
    resolveOverlapColumns,
    TIMELINE_END_HOUR,
    TIMELINE_HOURS,
    TIMELINE_START_HOUR,
    TIMELINE_TOTAL_PX,
} from "../utils/timeline";

interface TimelineViewProps {
    /** Only "day" | "3day" | "week" reach here — Month renders via
     *  `MonthView` from the shell. */
    view: Exclude<CalendarView, "month">;
    /** Reference date — start-of-week for week view, anchor day
     *  for day / 3-day. */
    anchor: Dayjs;
    events: CalendarEvent[];
    /** Click an empty hour slot → caller opens the create modal
     *  pre-filled at `start` … `start + 1h`. */
    onCreateAt: (start: Dayjs) => void;
    /** Click an event block (or all-day chip) → caller opens the
     *  edit modal for that event. */
    onEventClick: (event: CalendarEvent) => void;
    /** Base color per `accountId:calendarId`. Blocks are tinted by the
     *  calendar they belong to so a merged work+personal timeline stays
     *  readable; the Meet indicator moved to the icon alone, since a
     *  green-for-Meet fill would collide with the source colors. */
    colorBySource: Record<string, string>;
    /** Sources shared at Google's free/busy level, where Google strips
     *  event titles before they reach us. */
    freeBusySources: Set<string>;
    /** Label for a title-less free/busy event. */
    busyLabel: string;
}

/** "6 AM" / "12 PM" / "11 PM" — Google-style 12h labels. */
const hourLabel = (h: number): string => {
    const hour = h % 24;
    const suffix = hour < 12 ? "AM" : "PM";
    const disp = hour % 12 === 0 ? 12 : hour % 12;
    return `${disp} ${suffix}`;
};

/** True if the timed event's start lands on `day` (compared in
 *  the user's local TZ). Multi-day timed events render only on
 *  their start day per the plan. */
const timedEventStartsOn = (e: CalendarEvent, day: Dayjs): boolean => {
    if (!e.start?.dateTime) return false;
    return dayjs(e.start.dateTime).isSame(day, "day");
};

/** All-day event intersects `day` when day is in [start, end). */
const allDayIntersects = (e: CalendarEvent, day: Dayjs): boolean => {
    if (!e.start?.date || !e.end?.date) return false;
    const start = dayjs(e.start.date).startOf("day");
    const end = dayjs(e.end.date).startOf("day"); // exclusive
    return !day.isBefore(start) && day.isBefore(end);
};

const isAllDay = (e: CalendarEvent): boolean => Boolean(e.start?.date && !e.start?.dateTime);

interface TimedSlot {
    event: CalendarEvent;
    start: Dayjs;
    end: Dayjs;
    slot: OverlapSlot;
}

const layoutTimedDay = (events: CalendarEvent[], day: Dayjs): TimedSlot[] => {
    const onDay = events.filter((e) => isTimedEvent(e) && timedEventStartsOn(e, day));
    if (onDay.length === 0) return [];
    const annotated = onDay.map((e) => ({
        event: e,
        start: dayjs(e.start!.dateTime!),
        end: dayjs(e.end!.dateTime!),
    }));
    const slots = resolveOverlapColumns(annotated);
    return annotated.map((a, i) => ({ ...a, slot: slots[i] }));
};

export const TimelineView = ({
    view,
    anchor,
    events,
    onCreateAt,
    onEventClick,
    colorBySource,
    freeBusySources,
    busyLabel,
}: TimelineViewProps) => {
    const { mode } = useColorScheme();
    const { t } = useTranslation();
    const isDark = mode === "dark";

    const days = useMemo(() => timelineDays(view, anchor), [view, anchor]);

    // Multi-day all-day events, laid out as bars across the visible day
    // columns. No lane cap here: the all-day strip grows with its
    // content rather than competing with a fixed cell height the way
    // Month view's does.
    const allDaySpans = useMemo(() => layoutSpanSegments(events, days), [events, days]);
    const allDayLaneCount = useMemo(
        () => allDaySpans.reduce((max, s) => Math.max(max, s.lane + 1), 0),
        [allDaySpans]
    );
    const todayKey = useMemo(() => dayjs().format("YYYY-MM-DD"), []);

    // Per-minute tick for the "Now" indicator. Setting an interval
    // is cheap and the indicator's positional formula needs the
    // current time anyway. Falls back to a stale value between
    // ticks; updates within ~60s of the wall clock.
    const [now, setNow] = useState<Dayjs>(() => dayjs());
    useEffect(() => {
        const id = window.setInterval(() => setNow(dayjs()), 60_000);
        return () => window.clearInterval(id);
    }, []);

    const accent = isDark
        ? "rgba(var(--gp-brand-700-rgb), 0.85)"
        : "rgba(var(--gp-brand-700-rgb), 1)";
    // Event fills used to be one brand blue (green for Meet events).
    // Both are gone: with several calendars overlaid, colour has to
    // carry which calendar an event belongs to, so it now comes from
    // `paletteForEvent` per source and the Meet signal is the camera
    // icon alone.
    const gridLine = isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)";
    const headerLine = isDark ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.12)";
    const nowLine = isDark ? "rgba(239,68,68,0.85)" : "rgba(239,68,68,1)";

    const HOUR_GUTTER_PX = 64;

    return (
        <Box
            sx={{
                display: "flex",
                flexDirection: "column",
                flex: 1,
                minHeight: 0,
                overflow: "hidden",
            }}
        >
            {/* Day-header row — date label per column.
                The gutter column at the left aligns the headers
                with the hour ruler below. */}
            <Box
                sx={{
                    display: "grid",
                    gridTemplateColumns: `${HOUR_GUTTER_PX}px repeat(${days.length}, minmax(0, 1fr))`,
                    borderBottom: `1px solid ${headerLine}`,
                    flexShrink: 0,
                }}
            >
                <Box />
                {days.map((d) => {
                    const isToday = d.format("YYYY-MM-DD") === todayKey;
                    return (
                        <Box
                            key={d.toString()}
                            sx={{
                                textAlign: "center",
                                py: 0.5,
                                borderLeft: `1px solid ${gridLine}`,
                            }}
                        >
                            <Typography
                                level="body-xs"
                                sx={{
                                    fontSize: "0.7rem",
                                    textTransform: "uppercase",
                                    letterSpacing: "0.04em",
                                    fontWeight: 600,
                                }}
                            >
                                {d.format("ddd")}
                            </Typography>
                            {isToday ? (
                                <Box
                                    sx={{
                                        mt: 0.25,
                                        mx: "auto",
                                        width: 26,
                                        height: 26,
                                        borderRadius: "50%",
                                        backgroundColor: accent,
                                        color: "#fff",
                                        display: "inline-flex",
                                        alignItems: "center",
                                        justifyContent: "center",
                                        fontSize: "0.85rem",
                                        fontWeight: 700,
                                    }}
                                >
                                    {d.date()}
                                </Box>
                            ) : (
                                <Typography level="body-md" sx={{ fontWeight: 600 }}>
                                    {d.date()}
                                </Typography>
                            )}
                        </Box>
                    );
                })}
            </Box>

            {/* All-day strip above the hour grid.
                Multi-day events are drawn ONCE as a bar spanning the
                columns they cover, rather than repeated per column —
                same treatment as Month view, so a trip reads as one
                continuous event in both. Single-day all-day events sit
                in their own column beneath the bars. */}
            <Box
                sx={{
                    display: "grid",
                    gridTemplateColumns: `${HOUR_GUTTER_PX}px repeat(${days.length}, minmax(0, 1fr))`,
                    borderBottom: `1px solid ${headerLine}`,
                    flexShrink: 0,
                    minHeight: 28,
                }}
            >
                <Box
                    sx={{
                        textAlign: "right",
                        pr: 0.75,
                        py: 0.5,
                        fontSize: "0.7rem",
                        color: isDark ? "rgba(255,255,255,0.4)" : "rgba(0,0,0,0.4)",
                        letterSpacing: "0.03em",
                    }}
                >
                    {t.calendar.allDay}
                </Box>
                {/* One cell covering every day column, holding both the
                    spanning bars and the per-day singles. A nested grid
                    is what lets a bar cross column boundaries — the
                    outer grid's columns can't be spanned from inside a
                    per-day Stack. */}
                <Box
                    sx={{
                        gridColumn: `2 / ${days.length + 2}`,
                        display: "grid",
                        gridTemplateColumns: `repeat(${days.length}, minmax(0, 1fr))`,
                        gridAutoRows: "min-content",
                        rowGap: 0.25,
                        py: 0.25,
                    }}
                >
                    {/* Column separators, drawn behind the content so
                        the bars can cross them. */}
                    {days.map((d, i) => (
                        <Box
                            key={`sep-${d.toString()}`}
                            sx={{
                                gridColumn: i + 1,
                                gridRow: "1 / -1",
                                borderLeft: `1px solid ${gridLine}`,
                                pointerEvents: "none",
                            }}
                        />
                    ))}

                    {allDaySpans.map((segment) => {
                        const palette = paletteForEvent(
                            segment.event._source,
                            colorBySource,
                            isDark
                        );
                        const label = eventLabel(segment.event, freeBusySources, busyLabel);
                        return (
                            <Tooltip
                                key={`span-${segment.event.id}`}
                                size="sm"
                                sx={{ borderRadius: "8px" }}
                                variant="outlined"
                                title={
                                    segment.event._source?.account_email
                                        ? `${label} — ${segment.event._source.account_email}`
                                        : label
                                }
                            >
                                <Box
                                    sx={{
                                        gridColumn: `${segment.startIndex + 1} / ${segment.endIndex + 2}`,
                                        gridRow: segment.lane + 1,
                                        mx: "2px",
                                        cursor: "pointer",
                                        backgroundColor: palette.fill,
                                        color: palette.text,
                                        px: 0.5,
                                        py: 0.25,
                                        fontSize: "0.72rem",
                                        overflow: "hidden",
                                        textOverflow: "ellipsis",
                                        whiteSpace: "nowrap",
                                        // Square the edge that runs past
                                        // the visible window so it reads
                                        // as continuing.
                                        borderTopLeftRadius: segment.continuesBefore ? 0 : "4px",
                                        borderBottomLeftRadius: segment.continuesBefore
                                            ? 0
                                            : "4px",
                                        borderTopRightRadius: segment.continuesAfter ? 0 : "4px",
                                        borderBottomRightRadius: segment.continuesAfter
                                            ? 0
                                            : "4px",
                                        borderLeft: segment.continuesBefore
                                            ? undefined
                                            : `3px solid ${palette.base}`,
                                        "&:hover": { backgroundColor: palette.fillHover },
                                    }}
                                    onClick={(ev) => {
                                        ev.stopPropagation();
                                        onEventClick(segment.event);
                                    }}
                                >
                                    {segment.continuesBefore ? "← " : ""}
                                    {label}
                                    {segment.continuesAfter ? " →" : ""}
                                </Box>
                            </Tooltip>
                        );
                    })}

                    {days.map((d, dayIndex) => {
                        // Single-day all-day events only; the multi-day
                        // ones are the bars above.
                        const singles = events.filter(
                            (e) => isAllDay(e) && !isMultiDaySpan(e) && allDayIntersects(e, d)
                        );
                        if (singles.length === 0) return null;
                        return (
                            <Stack
                                key={d.toString()}
                                spacing={0.25}
                                sx={{
                                    gridColumn: dayIndex + 1,
                                    gridRow: allDayLaneCount + 1,
                                    px: 0.25,
                                    minWidth: 0,
                                }}
                            >
                                {singles.map((e) => {
                                    const palette = paletteForEvent(
                                        e._source,
                                        colorBySource,
                                        isDark
                                    );
                                    const label = eventLabel(e, freeBusySources, busyLabel);
                                    return (
                                        <Tooltip
                                            key={e.id}
                                            size="sm"
                                            sx={{ borderRadius: "8px" }}
                                            variant="outlined"
                                            title={
                                                e._source?.account_email
                                                    ? `${label} — ${e._source.account_email}`
                                                    : label
                                            }
                                        >
                                            <Box
                                                sx={{
                                                    cursor: "pointer",
                                                    backgroundColor: palette.fill,
                                                    color: palette.text,
                                                    borderLeft: `3px solid ${palette.base}`,
                                                    borderRadius: "4px",
                                                    px: 0.5,
                                                    py: 0.25,
                                                    fontSize: "0.72rem",
                                                    overflow: "hidden",
                                                    textOverflow: "ellipsis",
                                                    whiteSpace: "nowrap",
                                                    "&:hover": {
                                                        backgroundColor: palette.fillHover,
                                                    },
                                                }}
                                                onClick={(ev) => {
                                                    ev.stopPropagation();
                                                    onEventClick(e);
                                                }}
                                            >
                                                {label}
                                            </Box>
                                        </Tooltip>
                                    );
                                })}
                            </Stack>
                        );
                    })}
                </Box>
            </Box>

            {/* Hour grid — scrolls vertically, day columns share
                the same vertical extent. Hour labels live in the
                left gutter; horizontal rules at every hour band
                anchor the eye. */}
            <Box sx={{ flex: 1, minHeight: 0, overflowY: "auto" }}>
                <Box
                    sx={{
                        display: "grid",
                        gridTemplateColumns: `${HOUR_GUTTER_PX}px repeat(${days.length}, minmax(0, 1fr))`,
                        position: "relative",
                        height: TIMELINE_TOTAL_PX,
                    }}
                >
                    {/* Hour gutter (column 1) */}
                    <Box sx={{ position: "relative" }}>
                        {Array.from({ length: TIMELINE_HOURS }, (_, i) => {
                            const h = TIMELINE_START_HOUR + i;
                            return (
                                <Box
                                    key={h}
                                    sx={{
                                        position: "absolute",
                                        top: i * HOUR_BAND_PX,
                                        right: 4,
                                        fontSize: "0.65rem",
                                        color: isDark
                                            ? "rgba(255,255,255,0.4)"
                                            : "rgba(0,0,0,0.4)",
                                        transform: "translateY(-50%)",
                                    }}
                                >
                                    {hourLabel(h)}
                                </Box>
                            );
                        })}
                    </Box>

                    {/* Day columns */}
                    {days.map((d) => {
                        const isToday = d.format("YYYY-MM-DD") === todayKey;
                        const layout = layoutTimedDay(events, d);
                        const nowPx = isToday ? nowOffsetPx(now, d) : null;
                        return (
                            <Box
                                key={d.toString()}
                                sx={{
                                    position: "relative",
                                    borderLeft: `1px solid ${gridLine}`,
                                    height: TIMELINE_TOTAL_PX,
                                }}
                                onClick={(ev) => {
                                    // Empty-area click → create event at
                                    // the clicked hour. Children that
                                    // represent events stopPropagation.
                                    if (ev.target !== ev.currentTarget) return;
                                    const rect = (
                                        ev.currentTarget as HTMLElement
                                    ).getBoundingClientRect();
                                    const y = ev.clientY - rect.top;
                                    const hour =
                                        TIMELINE_START_HOUR + Math.floor(y / HOUR_BAND_PX);
                                    const start = d
                                        .startOf("day")
                                        .hour(hour)
                                        .minute(0)
                                        .second(0)
                                        .millisecond(0);
                                    onCreateAt(start);
                                }}
                            >
                                {/* Hour-band horizontal rules */}
                                {Array.from({ length: TIMELINE_HOURS }, (_, i) => (
                                    <Box
                                        key={i}
                                        sx={{
                                            position: "absolute",
                                            left: 0,
                                            right: 0,
                                            top: i * HOUR_BAND_PX,
                                            borderTop: `1px solid ${gridLine}`,
                                            pointerEvents: "none",
                                        }}
                                    />
                                ))}

                                {/* Event blocks */}
                                {layout.map(({ event, start, end, slot }) => {
                                    const top = eventTopPx(start, d);
                                    const height = eventHeightPx(start, end, d);
                                    const widthPct = 100 / slot.columnCount;
                                    const leftPct = slot.column * widthPct;
                                    const timedPalette = paletteForEvent(
                                        event._source,
                                        colorBySource,
                                        isDark
                                    );
                                    return (
                                        <Tooltip
                                            key={event.id}
                                            size="sm"
                                            sx={{ borderRadius: "8px" }}
                                            title={`${event.summary || "(no title)"} · ${start.format("h:mm A")}–${end.format("h:mm A")}${event._source?.account_email ? ` — ${event._source.account_email}` : ""}`}
                                            variant="outlined"
                                        >
                                            <Box
                                                sx={{
                                                    position: "absolute",
                                                    top,
                                                    height,
                                                    left: `calc(${leftPct}% + 2px)`,
                                                    width: `calc(${widthPct}% - 4px)`,
                                                    backgroundColor: timedPalette.fill,
                                                    color: timedPalette.text,
                                                    borderLeft: `3px solid ${timedPalette.base}`,
                                                    borderRadius: "4px",
                                                    px: 0.5,
                                                    py: 0.25,
                                                    overflow: "hidden",
                                                    cursor: "pointer",
                                                    display: "flex",
                                                    flexDirection: "column",
                                                    gap: 0.25,
                                                    "&:hover": {
                                                        backgroundColor: timedPalette.fillHover,
                                                    },
                                                }}
                                                onClick={(ev) => {
                                                    ev.stopPropagation();
                                                    onEventClick(event);
                                                }}
                                            >
                                                <Box
                                                    sx={{
                                                        display: "flex",
                                                        alignItems: "center",
                                                        gap: 0.25,
                                                        fontSize: "0.7rem",
                                                        fontWeight: 600,
                                                        whiteSpace: "nowrap",
                                                        overflow: "hidden",
                                                        textOverflow: "ellipsis",
                                                    }}
                                                >
                                                    {event.hangoutLink && (
                                                        <VideoCameraFrontRoundedIcon
                                                            sx={{ fontSize: 12 }}
                                                        />
                                                    )}
                                                    <span
                                                        style={{
                                                            overflow: "hidden",
                                                            textOverflow: "ellipsis",
                                                        }}
                                                    >
                                                        {event.summary || "(no title)"}
                                                    </span>
                                                </Box>
                                                {height >= 32 && (
                                                    <Box
                                                        sx={{
                                                            fontSize: "0.62rem",
                                                            opacity: 0.85,
                                                        }}
                                                    >
                                                        {start.format("h:mm A")} –{" "}
                                                        {end.format("h:mm A")}
                                                    </Box>
                                                )}
                                            </Box>
                                        </Tooltip>
                                    );
                                })}

                                {/* "Now" indicator — only on today's column. */}
                                {nowPx !== null && (
                                    <Box
                                        aria-label={t.calendar.nowLabel}
                                        sx={{
                                            position: "absolute",
                                            left: 0,
                                            right: 0,
                                            top: nowPx,
                                            height: 0,
                                            borderTop: `1.5px solid ${nowLine}`,
                                            pointerEvents: "none",
                                            zIndex: 2,
                                            "&::before": {
                                                content: '""',
                                                position: "absolute",
                                                left: -4,
                                                top: -4,
                                                width: 8,
                                                height: 8,
                                                borderRadius: "50%",
                                                backgroundColor: nowLine,
                                            },
                                        }}
                                    />
                                )}
                            </Box>
                        );
                    })}
                </Box>
            </Box>
        </Box>
    );
};
