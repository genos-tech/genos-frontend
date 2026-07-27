import { useEffect, useMemo, useState } from "react";
import VideoCameraFrontRoundedIcon from "@mui/icons-material/VideoCameraFrontRounded";
import { Box, Stack, Tooltip, Typography } from "@mui/joy";
import { useColorScheme } from "@mui/joy/styles";
import dayjs, { Dayjs } from "dayjs";

import { useTranslation } from "../../../i18n";
import { CalendarEvent } from "../../integrations/services/calendar";
import { CalendarView, timelineDays } from "../utils/monthGrid";
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
}: TimelineViewProps) => {
    const { mode } = useColorScheme();
    const { t } = useTranslation();
    const isDark = mode === "dark";

    const days = useMemo(() => timelineDays(view, anchor), [view, anchor]);
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
    const eventBlue = isDark
        ? "rgba(var(--gp-brand-700-rgb), 0.32)"
        : "rgba(var(--gp-brand-700-rgb), 0.16)";
    const eventBlueHover = isDark
        ? "rgba(var(--gp-brand-700-rgb), 0.45)"
        : "rgba(var(--gp-brand-700-rgb), 0.28)";
    const eventBorder = isDark
        ? "rgba(var(--gp-brand-700-rgb), 0.7)"
        : "rgba(var(--gp-brand-700-rgb), 0.55)";
    const eventGreen = isDark ? "rgba(34,197,94,0.32)" : "rgba(34,197,94,0.18)";
    const eventGreenBorder = isDark ? "rgba(34,197,94,0.7)" : "rgba(34,197,94,0.55)";
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

            {/* All-day strip — single fixed row above the hour
                grid. Each column gets its own all-day list; events
                that span multiple days appear in every column they
                cover. */}
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
                {days.map((d) => {
                    const allDayEvents = events.filter(
                        (e) => isAllDay(e) && allDayIntersects(e, d)
                    );
                    return (
                        <Stack
                            key={d.toString()}
                            spacing={0.25}
                            sx={{
                                py: 0.25,
                                px: 0.25,
                                borderLeft: `1px solid ${gridLine}`,
                            }}
                        >
                            {allDayEvents.map((e) => (
                                <Tooltip
                                    key={e.id}
                                    size="sm"
                                    sx={{ borderRadius: "8px" }}
                                    title={e.summary || "(no title)"}
                                    variant="outlined"
                                >
                                    <Box
                                        sx={{
                                            cursor: "pointer",
                                            backgroundColor: e.hangoutLink
                                                ? eventGreen
                                                : eventBlue,
                                            borderLeft: `3px solid ${
                                                e.hangoutLink ? eventGreenBorder : eventBorder
                                            }`,
                                            borderRadius: "4px",
                                            px: 0.5,
                                            py: 0.25,
                                            fontSize: "0.72rem",
                                            overflow: "hidden",
                                            textOverflow: "ellipsis",
                                            whiteSpace: "nowrap",
                                            "&:hover": {
                                                backgroundColor: eventBlueHover,
                                            },
                                        }}
                                        onClick={(ev) => {
                                            ev.stopPropagation();
                                            onEventClick(e);
                                        }}
                                    >
                                        {e.summary || "(no title)"}
                                    </Box>
                                </Tooltip>
                            ))}
                        </Stack>
                    );
                })}
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
                                    return (
                                        <Tooltip
                                            key={event.id}
                                            size="sm"
                                            sx={{ borderRadius: "8px" }}
                                            title={`${event.summary || "(no title)"} · ${start.format("h:mm A")}–${end.format("h:mm A")}`}
                                            variant="outlined"
                                        >
                                            <Box
                                                sx={{
                                                    position: "absolute",
                                                    top,
                                                    height,
                                                    left: `calc(${leftPct}% + 2px)`,
                                                    width: `calc(${widthPct}% - 4px)`,
                                                    backgroundColor: event.hangoutLink
                                                        ? eventGreen
                                                        : eventBlue,
                                                    borderLeft: `3px solid ${
                                                        event.hangoutLink
                                                            ? eventGreenBorder
                                                            : eventBorder
                                                    }`,
                                                    borderRadius: "4px",
                                                    px: 0.5,
                                                    py: 0.25,
                                                    overflow: "hidden",
                                                    cursor: "pointer",
                                                    display: "flex",
                                                    flexDirection: "column",
                                                    gap: 0.25,
                                                    "&:hover": {
                                                        backgroundColor: eventBlueHover,
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
