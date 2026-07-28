import { useMemo } from "react";
import ArrowLeftRoundedIcon from "@mui/icons-material/ArrowLeftRounded";
import ArrowRightRoundedIcon from "@mui/icons-material/ArrowRightRounded";
import VideoCameraFrontRoundedIcon from "@mui/icons-material/VideoCameraFrontRounded";
import { Box, Chip, Sheet, Stack, Tooltip, Typography } from "@mui/joy";
import { useColorScheme } from "@mui/joy/styles";
import dayjs, { Dayjs } from "dayjs";

import { CalendarEvent } from "../../integrations/services/calendar";
import { eventLabel } from "../utils/eventLabel";
import { buildMonthGrid, weekdayLabels } from "../utils/monthGrid";
import { clampLanes, layoutSpanSegments, type SpanSegment } from "../utils/multiDay";
import { paletteForEvent } from "../utils/sourceColors";

/** Vertical budget inside a cell, in content rows. A cell is ~80px —
 *  roughly the date number plus three rows of content. Span lanes are
 *  drawn across the whole week but consume from the same budget as the
 *  per-day chips beneath them. */
const MAX_CONTENT_ROWS = 3;
/** Span lanes are capped rather than allowed to grow, so one busy week
 *  can't squeeze every other week's chips to nothing — the grid keeps
 *  its fixed six equal rows. Anything beyond the cap folds into the
 *  "+N more" affordance rather than disappearing. */
const MAX_SPAN_LANES = 2;
const LANE_HEIGHT_PX = 18;

const dayKey = (d: Dayjs): string => d.format("YYYY-MM-DD");

const truncate = (raw: string): string => (raw.length > 18 ? `${raw.slice(0, 17)}…` : raw);

interface MonthViewProps {
    /** First-of-month for the visible grid. The 6×7 layout pads
     *  with the surrounding days as dimmed cells. */
    focused: Dayjs;
    /** Single-day events bucketed by "YYYY-MM-DD". Multi-day spans are
     *  deliberately ABSENT — they're drawn as bars from `events` — so
     *  the same event doesn't render twice on every day it covers. */
    eventsByDay: Record<string, CalendarEvent[]>;
    /** The full event list, used to lay out the spanning bars. */
    events: CalendarEvent[];
    /** Click on an empty cell surface → opens the create-event
     *  modal pre-filled for the clicked day. */
    onCellClick: (day: Dayjs) => void;
    /** Click on an event chip → opens the edit-event modal. */
    onEventClick: (event: CalendarEvent) => void;
    /** Click on the "+N more" overflow chip → caller surfaces a
     *  per-day popover listing all events for that key. */
    onShowMore: (dayKey: string) => void;
    /** Base color per `accountId:calendarId`. With several accounts
     *  overlaid, color is the only thing distinguishing a work meeting
     *  from a personal one, so events are tinted per source rather than
     *  all wearing the brand accent. */
    colorBySource: Record<string, string>;
    /** Sources shared at Google's free/busy level, where titles are
     *  stripped upstream. */
    freeBusySources: Set<string>;
    /** Label for a title-less free/busy event. */
    busyLabel: string;
}

/**
 * Six-row monthly grid. Rendered when the user has the Month
 * view tab active. Lifted out of `CalendarModal.tsx` so the
 * shell can swap between this and `TimelineView` without
 * holding the grid's render details.
 *
 * Each week is its own stacking context: a background layer of day
 * cells (owning the click target and today's highlight) with a content
 * layer on top holding the spanning bars followed by each day's chips.
 * A multi-day event is drawn ONCE as a continuous bar across its
 * columns rather than repeated as a chip per day — which is what makes
 * a three-day trip read as one event instead of three unrelated ones.
 */
export const MonthView = ({
    focused,
    eventsByDay,
    events,
    onCellClick,
    onEventClick,
    onShowMore,
    colorBySource,
    freeBusySources,
    busyLabel,
}: MonthViewProps) => {
    const { mode } = useColorScheme();
    const isDark = mode === "dark";

    const grid = useMemo(() => buildMonthGrid(focused, 0), [focused]);
    const weekLabels = useMemo(() => weekdayLabels(0), []);
    const todayKey = useMemo(() => dayKey(dayjs()), []);

    /** Span layout per week, memoised together: lane packing runs for
     *  all six weeks and would otherwise redo on every render. */
    const weekSpans = useMemo(
        () =>
            grid.map((week) =>
                clampLanes(layoutSpanSegments(events, week), MAX_SPAN_LANES, week.length)
            ),
        [events, grid]
    );

    const accent = isDark
        ? "rgba(var(--gp-brand-700-rgb), 0.85)"
        : "rgba(var(--gp-brand-700-rgb), 1)";
    const cellBorder = isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.08)";
    const dimmedText = isDark ? "rgba(255,255,255,0.35)" : "rgba(0,0,0,0.35)";

    const renderSpan = (segment: SpanSegment, weekIndex: number) => {
        const palette = paletteForEvent(segment.event._source, colorBySource, isDark);
        const label = eventLabel(segment.event, freeBusySources, busyLabel);
        return (
            <Tooltip
                // Keyed per (event, week): the same event appears in
                // every week row it crosses, so the event id alone would
                // collide across rows.
                key={`${segment.event.id}-w${weekIndex}`}
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
                        // 1-based grid lines, and the end line is
                        // exclusive — hence +1 / +2.
                        gridColumn: `${segment.startIndex + 1} / ${segment.endIndex + 2}`,
                        gridRow: segment.lane + 1,
                        display: "flex",
                        alignItems: "center",
                        gap: 0.25,
                        minWidth: 0,
                        height: LANE_HEIGHT_PX - 3,
                        px: 0.5,
                        cursor: "pointer",
                        // The content layer is `pointerEvents: none` so
                        // empty space falls through to the day cell's
                        // click target underneath. Every interactive
                        // child has to opt back in — without this the
                        // bar renders perfectly and simply can't be
                        // clicked.
                        pointerEvents: "auto",
                        backgroundColor: palette.fill,
                        color: palette.text,
                        fontSize: "0.68rem",
                        fontWeight: 500,
                        lineHeight: 1,
                        // Square off the edge that continues past this
                        // week, round the edge that genuinely starts or
                        // ends here — the shape alone tells the user
                        // whether they're seeing the whole event.
                        borderTopLeftRadius: segment.continuesBefore ? 0 : "4px",
                        borderBottomLeftRadius: segment.continuesBefore ? 0 : "4px",
                        borderTopRightRadius: segment.continuesAfter ? 0 : "4px",
                        borderBottomRightRadius: segment.continuesAfter ? 0 : "4px",
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
                    {segment.continuesBefore && (
                        <ArrowLeftRoundedIcon sx={{ fontSize: 14, flexShrink: 0, ml: -0.5 }} />
                    )}
                    {segment.event.hangoutLink && (
                        <VideoCameraFrontRoundedIcon sx={{ fontSize: 11, flexShrink: 0 }} />
                    )}
                    <Box
                        sx={{
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                            flex: 1,
                            minWidth: 0,
                        }}
                    >
                        {label}
                    </Box>
                    {segment.continuesAfter && (
                        <ArrowRightRoundedIcon sx={{ fontSize: 14, flexShrink: 0, mr: -0.5 }} />
                    )}
                </Box>
            </Tooltip>
        );
    };

    return (
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

            {/* Six week rows. Each is its own grid so a span bar can be
                positioned by column across the whole week. */}
            <Box
                sx={{
                    display: "grid",
                    gridTemplateRows: "repeat(6, minmax(0, 1fr))",
                    gap: 0.5,
                    flex: 1,
                    minHeight: 0,
                    overflow: "auto",
                }}
            >
                {grid.map((week, weekIndex) => {
                    const { visible, hiddenPerColumn } = weekSpans[weekIndex];
                    const lanesUsed = visible.reduce((max, s) => Math.max(max, s.lane + 1), 0);
                    // Whatever the bars didn't take is left for chips.
                    // At least one slot always survives so a day with its
                    // own event still shows something.
                    const chipSlots = Math.max(1, MAX_CONTENT_ROWS - lanesUsed);
                    return (
                        <Box key={week[0].toString()} sx={{ position: "relative", minHeight: 80 }}>
                            {/* Background layer: the cells themselves.
                                Sits underneath so a click on empty space
                                still reaches `onCellClick`, while bars
                                and chips above stop propagation. */}
                            <Box
                                sx={{
                                    position: "absolute",
                                    inset: 0,
                                    display: "grid",
                                    gridTemplateColumns: "repeat(7, minmax(0, 1fr))",
                                    gap: 0.5,
                                }}
                            >
                                {week.map((day) => {
                                    const inMonth = day.month() === focused.month();
                                    const isToday = dayKey(day) === todayKey;
                                    return (
                                        <Sheet
                                            key={dayKey(day)}
                                            variant="outlined"
                                            sx={{
                                                borderRadius: "sm",
                                                // Today's cell wears an accent
                                                // border + tint; the date number
                                                // adds a filled circle.
                                                borderColor: isToday ? accent : cellBorder,
                                                borderWidth: isToday ? "1.5px" : "1px",
                                                backgroundColor: isToday
                                                    ? isDark
                                                        ? "rgba(var(--gp-brand-700-rgb), 0.16)"
                                                        : "rgba(var(--gp-brand-700-rgb), 0.08)"
                                                    : undefined,
                                                cursor: "pointer",
                                                opacity: inMonth ? 1 : 0.55,
                                                transition: "background-color 0.12s ease",
                                                "&:hover": {
                                                    backgroundColor: isDark
                                                        ? "rgba(var(--gp-brand-700-rgb), 0.08)"
                                                        : "rgba(var(--gp-brand-700-rgb), 0.04)",
                                                },
                                            }}
                                            onClick={() => onCellClick(day)}
                                        />
                                    );
                                })}
                            </Box>

                            {/* Content layer. Transparent to pointer
                                events so empty space falls through to the
                                cell beneath; interactive children opt
                                back in. */}
                            <Box
                                sx={{
                                    position: "relative",
                                    height: "100%",
                                    display: "flex",
                                    flexDirection: "column",
                                    pointerEvents: "none",
                                    overflow: "hidden",
                                }}
                            >
                                {/* Date numbers */}
                                <Box
                                    sx={{
                                        display: "grid",
                                        gridTemplateColumns: "repeat(7, minmax(0, 1fr))",
                                        gap: 0.5,
                                        px: 0.5,
                                        pt: 0.5,
                                    }}
                                >
                                    {week.map((day) => {
                                        const isToday = dayKey(day) === todayKey;
                                        return isToday ? (
                                            <Box
                                                key={dayKey(day)}
                                                sx={{
                                                    width: 20,
                                                    height: 20,
                                                    borderRadius: "50%",
                                                    backgroundColor: accent,
                                                    color: "#fff",
                                                    display: "inline-flex",
                                                    alignItems: "center",
                                                    justifyContent: "center",
                                                    fontSize: "0.7rem",
                                                    fontWeight: 700,
                                                    lineHeight: 1,
                                                }}
                                            >
                                                {day.date()}
                                            </Box>
                                        ) : (
                                            <Typography
                                                key={dayKey(day)}
                                                level="body-xs"
                                                sx={{ fontWeight: 500, pl: "2px" }}
                                            >
                                                {day.date()}
                                            </Typography>
                                        );
                                    })}
                                </Box>

                                {/* Spanning bars */}
                                {visible.length > 0 && (
                                    <Box
                                        sx={{
                                            display: "grid",
                                            gridTemplateColumns: "repeat(7, minmax(0, 1fr))",
                                            gridAutoRows: `${LANE_HEIGHT_PX}px`,
                                            columnGap: 0.5,
                                            mt: 0.25,
                                            px: "2px",
                                        }}
                                    >
                                        {visible.map((segment) => renderSpan(segment, weekIndex))}
                                    </Box>
                                )}

                                {/* Per-day chips */}
                                <Box
                                    sx={{
                                        display: "grid",
                                        gridTemplateColumns: "repeat(7, minmax(0, 1fr))",
                                        gap: 0.5,
                                        px: 0.25,
                                        mt: 0.25,
                                        minHeight: 0,
                                    }}
                                >
                                    {week.map((day, dayIndex) => {
                                        const key = dayKey(day);
                                        const dayEvents = eventsByDay[key] ?? [];
                                        // Spans dropped by the lane cap
                                        // still have to be reachable, so
                                        // they count toward this day's
                                        // overflow.
                                        const hiddenSpans = hiddenPerColumn[dayIndex] ?? 0;
                                        const total = dayEvents.length + hiddenSpans;
                                        const needsOverflow = total > chipSlots;
                                        // Reserve one slot for the "+N"
                                        // chip when overflowing.
                                        const shown = needsOverflow
                                            ? Math.max(0, chipSlots - 1)
                                            : chipSlots;
                                        const visibleChips = dayEvents.slice(0, shown);
                                        const overflow = total - visibleChips.length;
                                        return (
                                            <Stack
                                                key={key}
                                                spacing={0.25}
                                                sx={{ minWidth: 0, alignItems: "stretch" }}
                                            >
                                                {visibleChips.map((e, idx) => {
                                                    const palette = paletteForEvent(
                                                        e._source,
                                                        colorBySource,
                                                        isDark
                                                    );
                                                    const label = eventLabel(
                                                        e,
                                                        freeBusySources,
                                                        busyLabel
                                                    );
                                                    return (
                                                        <Tooltip
                                                            key={`${e.id}-${idx}`}
                                                            size="sm"
                                                            sx={{ borderRadius: "8px" }}
                                                            variant="outlined"
                                                            title={
                                                                e._source?.account_email
                                                                    ? `${label} — ${e._source.account_email}`
                                                                    : label
                                                            }
                                                        >
                                                            <Chip
                                                                size="sm"
                                                                variant="soft"
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
                                                                    pointerEvents: "auto",
                                                                    backgroundColor: palette.fill,
                                                                    color: palette.text,
                                                                    borderLeft: `3px solid ${palette.base}`,
                                                                    borderRadius: "4px",
                                                                    "&:hover": {
                                                                        backgroundColor:
                                                                            palette.fillHover,
                                                                    },
                                                                    "& .MuiChip-label, & > span": {
                                                                        overflow: "hidden",
                                                                        textOverflow: "ellipsis",
                                                                        whiteSpace: "nowrap",
                                                                    },
                                                                }}
                                                                onClick={(ev) => {
                                                                    ev.stopPropagation();
                                                                    onEventClick(e);
                                                                }}
                                                            >
                                                                {truncate(label)}
                                                            </Chip>
                                                        </Tooltip>
                                                    );
                                                })}
                                                {overflow > 0 && (
                                                    <Chip
                                                        color="neutral"
                                                        size="sm"
                                                        variant="plain"
                                                        sx={{
                                                            cursor: "pointer",
                                                            pointerEvents: "auto",
                                                        }}
                                                        onClick={(ev) => {
                                                            ev.stopPropagation();
                                                            onShowMore(key);
                                                        }}
                                                    >
                                                        {`+${overflow}`}
                                                    </Chip>
                                                )}
                                            </Stack>
                                        );
                                    })}
                                </Box>
                            </Box>
                        </Box>
                    );
                })}
            </Box>
        </>
    );
};
