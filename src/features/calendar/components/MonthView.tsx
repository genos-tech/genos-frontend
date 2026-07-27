import { useMemo } from "react";
import VideoCameraFrontRoundedIcon from "@mui/icons-material/VideoCameraFrontRounded";
import { Box, Chip, Sheet, Stack, Tooltip, Typography } from "@mui/joy";
import { useColorScheme } from "@mui/joy/styles";
import dayjs, { Dayjs } from "dayjs";

import { CalendarEvent } from "../../integrations/services/calendar";
import { buildMonthGrid, weekdayLabels } from "../utils/monthGrid";

const MAX_CHIPS_PER_CELL = 2;

const dayKey = (d: Dayjs): string => d.format("YYYY-MM-DD");

const chipLabel = (e: CalendarEvent): string => {
    const raw = e.summary || "(no title)";
    return raw.length > 18 ? `${raw.slice(0, 17)}…` : raw;
};

interface MonthViewProps {
    /** First-of-month for the visible grid. The 6×7 layout pads
     *  with the surrounding days as dimmed cells. */
    focused: Dayjs;
    /** Events bucketed by "YYYY-MM-DD" — the caller computes this
     *  once per `eventsByDay` to keep the grid render cheap. */
    eventsByDay: Record<string, CalendarEvent[]>;
    /** Click on an empty cell surface → opens the create-event
     *  modal pre-filled for the clicked day. */
    onCellClick: (day: Dayjs) => void;
    /** Click on an event chip → opens the edit-event modal. */
    onEventClick: (event: CalendarEvent) => void;
    /** Click on the "+N more" overflow chip → caller surfaces a
     *  per-day popover listing all events for that key. */
    onShowMore: (dayKey: string) => void;
}

/**
 * Six-row monthly grid. Rendered when the user has the Month
 * view tab active. Lifted out of `CalendarModal.tsx` so the
 * shell can swap between this and `TimelineView` without
 * holding the grid's render details.
 */
export const MonthView = ({
    focused,
    eventsByDay,
    onCellClick,
    onEventClick,
    onShowMore,
}: MonthViewProps) => {
    const { mode } = useColorScheme();
    const isDark = mode === "dark";

    const grid = useMemo(() => buildMonthGrid(focused, 0), [focused]);
    const weekLabels = useMemo(() => weekdayLabels(0), []);
    const todayKey = useMemo(() => dayKey(dayjs()), []);

    const accent = isDark
        ? "rgba(var(--gp-brand-700-rgb), 0.85)"
        : "rgba(var(--gp-brand-700-rgb), 1)";
    const cellBorder = isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.08)";
    const dimmedText = isDark ? "rgba(255,255,255,0.35)" : "rgba(0,0,0,0.35)";

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
                    const isToday = key === todayKey;
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
                                // Today's cell wears three signals at once
                                // so it's instantly findable on a busy
                                // month grid: accent border (thicker),
                                // faint accent tint, and the date number
                                // rendered as a filled circle below.
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
                                // Only open create when the click landed on
                                // the cell surface itself, not on a chip or
                                // the +N affordance — those have their own
                                // handlers that stopPropagation.
                                if (ev.target === ev.currentTarget) onCellClick(day);
                            }}
                        >
                            <Stack
                                alignItems="center"
                                direction="row"
                                justifyContent="space-between"
                                sx={{ mb: 0.25 }}
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
                                    <Typography level="body-xs" sx={{ fontWeight: 500 }}>
                                        {day.date()}
                                    </Typography>
                                )}
                            </Stack>
                            <Stack spacing={0.25}>
                                {visibleChips.map((e, idx) => (
                                    <Tooltip
                                        key={`${e.id}-${idx}`}
                                        size="sm"
                                        sx={{ borderRadius: "8px" }}
                                        title={e.summary || "(no title)"}
                                        variant="outlined"
                                    >
                                        <Chip
                                            color={e.hangoutLink ? "success" : "primary"}
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
                                            {chipLabel(e)}
                                        </Chip>
                                    </Tooltip>
                                ))}
                                {overflow > 0 && (
                                    <Chip
                                        color="neutral"
                                        size="sm"
                                        sx={{ cursor: "pointer" }}
                                        variant="plain"
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
        </>
    );
};
