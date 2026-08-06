import { useMemo } from "react";
import ArrowLeftRoundedIcon from "@mui/icons-material/ArrowLeftRounded";
import ArrowRightRoundedIcon from "@mui/icons-material/ArrowRightRounded";
import VideoCameraFrontRoundedIcon from "@mui/icons-material/VideoCameraFrontRounded";
import { Box, Chip, Sheet, Stack, Typography } from "@mui/joy";
import { useColorScheme } from "@mui/joy/styles";
import dayjs, { Dayjs } from "dayjs";

import { AppTooltip } from "../../../components/ui/AppTooltip";
import { useIsMobile } from "../../../hooks/common/useIsMobile";
import { CalendarEvent } from "../../integrations/services/calendar";
import { eventLabel } from "../utils/eventLabel";
import { buildMonthGrid, weekdayLabels } from "../utils/monthGrid";
import { clampLanes, layoutSpanSegments, type SpanSegment } from "../utils/multiDay";
import { paletteForEvent } from "../utils/sourceColors";

/** Vertical budget inside a cell, in content rows. Span lanes are drawn
 *  across the whole week but consume from the same budget as the per-day
 *  chips beneath them. */
const MAX_CONTENT_ROWS = 3;
/** Span lanes are capped rather than allowed to grow, so one busy week
 *  can't squeeze every other week's chips to nothing — the grid keeps
 *  its fixed six equal rows. Anything beyond the cap folds into the
 *  "+N more" affordance rather than disappearing. */
const MAX_SPAN_LANES = 2;

/* ── Shared geometry ──────────────────────────────────────────────────
 * The bar overlay is a SEPARATE grid layered over the day cells, so the
 * two only stay aligned if they agree on these exact numbers. They're
 * named constants rather than inline values precisely because an earlier
 * revision gave each layer its own padding and everything drifted:
 * date numbers sat left of their cell, chips overhung to the right.
 *
 * Rule: the overlay and the cell grid share identical column tracks and
 * gap, and NEITHER carries horizontal padding. Visual inset comes from
 * the cell's own padding and a matching margin on the bars. */
/** Gap between day cells, in Joy spacing units (8px base) — so 4px.
 *  The overlay must use this exact value or the bars drift out of their
 *  columns. */
const CELL_GAP_SPACING = 0.5;
/** Padding inside a day cell. Bars inset by the same amount so their
 *  ends line up with the chips below them. */
const CELL_PADDING_PX = 4;
/** Height reserved for the date number at the top of each cell. */
const DATE_ROW_PX = 20;
/** Height of one span lane. */
const LANE_HEIGHT_PX = 18;

const dayKey = (d: Dayjs): string => d.format("YYYY-MM-DD");

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
 * Two layers per week, and only two on purpose:
 *
 *   1. The day cells, each owning its own date number and chips as
 *      ordinary children. Keeping content INSIDE the cell means its
 *      padding does the aligning — no second grid to keep in sync.
 *   2. A bar overlay for multi-day events, which is the one thing that
 *      genuinely has to cross cell boundaries and therefore can't live
 *      inside a cell.
 *
 * A multi-day event is drawn ONCE as a continuous bar across its
 * columns rather than repeated as a chip per day, which is what makes a
 * three-day trip read as one event instead of three unrelated ones.
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
    const isMobile = useIsMobile();

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
            <AppTooltip
                // Keyed per (event, week): the same event appears in
                // every week row it crosses, so the event id alone would
                // collide across rows.
                key={`${segment.event.id}-w${weekIndex}`}
                size="sm"
                title={
                    segment.event._source?.account_email
                        ? `${label} — ${segment.event._source.account_email}`
                        : label
                }
            >
                <Box
                    sx={{
                        // 1-based grid lines, and the end line is
                        // exclusive — hence +1 / +2. Spanning several
                        // columns makes the bar cross the gaps between
                        // them, which is what reads as continuous.
                        gridColumn: `${segment.startIndex + 1} / ${segment.endIndex + 2}`,
                        gridRow: 1,
                        alignSelf: "start",
                        // Pushed down past the date row, then one lane
                        // height per stacking level. Offsetting inside a
                        // single grid row keeps the overlay's column
                        // tracks identical to the cells'.
                        mt: `${CELL_PADDING_PX + DATE_ROW_PX + segment.lane * LANE_HEIGHT_PX}px`,
                        // Matches the cell's own padding so a bar's ends
                        // line up with the chips underneath it.
                        mx: `${CELL_PADDING_PX}px`,
                        height: LANE_HEIGHT_PX - 3,
                        display: "flex",
                        alignItems: "center",
                        gap: 0.25,
                        minWidth: 0,
                        px: 0.5,
                        cursor: "pointer",
                        // The overlay is `pointerEvents: none` so empty
                        // space falls through to the day cell's click
                        // target underneath. Every interactive child has
                        // to opt back in — without this the bar renders
                        // perfectly and simply can't be clicked.
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
            </AppTooltip>
        );
    };

    return (
        <>
            {/* Weekday labels. Same column tracks and gap as the cells
                below so each label sits over its own column. */}
            <Box
                sx={{
                    display: "grid",
                    gridTemplateColumns: "repeat(7, minmax(0, 1fr))",
                    gap: CELL_GAP_SPACING,
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

            {/* Six week rows */}
            <Box
                sx={{
                    display: "grid",
                    gridTemplateRows: "repeat(6, minmax(0, 1fr))",
                    gap: CELL_GAP_SPACING,
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
                        <Box
                            key={week[0].toString()}
                            sx={{
                                position: "relative",
                                minHeight: isMobile ? 56 : 84,
                                minWidth: 0,
                            }}
                        >
                            {/* Day cells, each owning its own content. */}
                            <Box
                                sx={{
                                    display: "grid",
                                    gridTemplateColumns: "repeat(7, minmax(0, 1fr))",
                                    gap: CELL_GAP_SPACING,
                                    height: "100%",
                                }}
                            >
                                {week.map((day, dayIndex) => {
                                    const key = dayKey(day);
                                    const inMonth = day.month() === focused.month();
                                    const isToday = key === todayKey;
                                    const dayEvents = eventsByDay[key] ?? [];
                                    // Spans dropped by the lane cap still
                                    // have to be reachable, so they count
                                    // toward this day's overflow.
                                    const hiddenSpans = hiddenPerColumn[dayIndex] ?? 0;
                                    const total = dayEvents.length + hiddenSpans;
                                    const needsOverflow = total > chipSlots;
                                    // Reserve one slot for the "+N" chip
                                    // when overflowing.
                                    const shown = needsOverflow
                                        ? Math.max(0, chipSlots - 1)
                                        : chipSlots;
                                    const visibleChips = dayEvents.slice(0, shown);
                                    const overflow = total - visibleChips.length;
                                    return (
                                        <Sheet
                                            key={key}
                                            variant="outlined"
                                            sx={{
                                                display: "flex",
                                                flexDirection: "column",
                                                minWidth: 0,
                                                overflow: "hidden",
                                                p: `${CELL_PADDING_PX}px`,
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
                                            onClick={(ev) => {
                                                // Only the cell surface opens
                                                // "create"; chips and the +N
                                                // affordance stop propagation.
                                                if (ev.target === ev.currentTarget) {
                                                    onCellClick(day);
                                                }
                                            }}
                                        >
                                            {/* Date number — fixed height so
                                                every cell's content starts at
                                                the same y, which is what the
                                                bar overlay offsets against. */}
                                            <Box
                                                sx={{
                                                    height: `${DATE_ROW_PX}px`,
                                                    display: "flex",
                                                    alignItems: "center",
                                                    flexShrink: 0,
                                                    pointerEvents: "none",
                                                }}
                                            >
                                                {isToday ? (
                                                    <Box
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
                                                        level="body-xs"
                                                        sx={{ fontWeight: 500, lineHeight: 1 }}
                                                    >
                                                        {day.date()}
                                                    </Typography>
                                                )}
                                            </Box>

                                            {/* Blank space the bar overlay
                                                draws into. Reserving it here
                                                is what stops the bars from
                                                covering the chips. */}
                                            {lanesUsed > 0 && (
                                                <Box
                                                    sx={{
                                                        height: `${lanesUsed * LANE_HEIGHT_PX}px`,
                                                        flexShrink: 0,
                                                        pointerEvents: "none",
                                                    }}
                                                />
                                            )}

                                            {/* Transparent to pointer
                                                events so a click on the
                                                blank area below the chips
                                                still reaches the cell and
                                                opens "create"; the chips
                                                themselves opt back in. */}
                                            <Stack
                                                spacing={0.25}
                                                sx={{
                                                    minWidth: 0,
                                                    minHeight: 0,
                                                    mt: "2px",
                                                    pointerEvents: "none",
                                                }}
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
                                                        <AppTooltip
                                                            key={`${e.id}-${idx}`}
                                                            size="sm"
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
                                                                    // Width is bounded by
                                                                    // the cell; the label
                                                                    // ellipsises to fit
                                                                    // rather than being
                                                                    // cut at a fixed
                                                                    // character count,
                                                                    // which never matched
                                                                    // the real column
                                                                    // width.
                                                                    maxWidth: "100%",
                                                                    minWidth: 0,
                                                                    pointerEvents: "auto",
                                                                    "--Chip-paddingInline": "6px",
                                                                    "--Chip-minHeight": "18px",
                                                                    backgroundColor: palette.fill,
                                                                    color: palette.text,
                                                                    borderLeft: `3px solid ${palette.base}`,
                                                                    borderRadius: "4px",
                                                                    fontSize: "0.68rem",
                                                                    "&:hover": {
                                                                        backgroundColor:
                                                                            palette.fillHover,
                                                                    },
                                                                    "& .MuiChip-label": {
                                                                        overflow: "hidden",
                                                                        textOverflow: "ellipsis",
                                                                        whiteSpace: "nowrap",
                                                                        minWidth: 0,
                                                                    },
                                                                }}
                                                                onClick={(ev) => {
                                                                    ev.stopPropagation();
                                                                    onEventClick(e);
                                                                }}
                                                            >
                                                                {label}
                                                            </Chip>
                                                        </AppTooltip>
                                                    );
                                                })}
                                                {overflow > 0 && (
                                                    <Chip
                                                        color="neutral"
                                                        size="sm"
                                                        variant="plain"
                                                        sx={{
                                                            cursor: "pointer",
                                                            alignSelf: "flex-start",
                                                            pointerEvents: "auto",
                                                            "--Chip-paddingInline": "4px",
                                                            "--Chip-minHeight": "16px",
                                                            fontSize: "0.65rem",
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
                                        </Sheet>
                                    );
                                })}
                            </Box>

                            {/* Bar overlay. Same column tracks and gap as
                                the cell grid above, and no horizontal
                                padding on either — that identity is the
                                only thing keeping the two aligned. */}
                            {visible.length > 0 && (
                                <Box
                                    sx={{
                                        position: "absolute",
                                        inset: 0,
                                        display: "grid",
                                        gridTemplateColumns: "repeat(7, minmax(0, 1fr))",
                                        gap: CELL_GAP_SPACING,
                                        pointerEvents: "none",
                                    }}
                                >
                                    {visible.map((segment) => renderSpan(segment, weekIndex))}
                                </Box>
                            )}
                        </Box>
                    );
                })}
            </Box>
        </>
    );
};
