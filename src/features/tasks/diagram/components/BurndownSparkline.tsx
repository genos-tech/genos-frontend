import { Box, Tooltip } from "@mui/joy";
import { useColorScheme } from "@mui/joy/styles";

import { purplePalette } from "../../../../theme/purplePalette";
import { BurndownPoint } from "../types";
import { HEALTH_TONE_COLOR, ScheduleHealthTone } from "../utils/scheduleStatus";

type Props = {
    data: BurndownPoint[];
    total: number;
    tone: ScheduleHealthTone;
    width?: number;
    height?: number;
};

// Pure-SVG sparkline. Two polylines (ideal dashed + actual solid),
// a dot for "today", no axes. The chart sells a trend at a glance;
// precise numbers live in the chips next to it.
export const BurndownSparkline = ({ data, total, tone, width = 220, height = 44 }: Props) => {
    const { mode } = useColorScheme();
    const isDark = mode === "dark";
    const P = isDark ? purplePalette.dark : purplePalette.light;
    const actualColor = HEALTH_TONE_COLOR[tone];

    if (data.length === 0 || total <= 0) {
        return null;
    }

    const pad = 4;
    const innerW = width - pad * 2;
    const innerH = height - pad * 2;

    const n = data.length;
    const xAt = (i: number) => pad + (n === 1 ? innerW / 2 : (i / (n - 1)) * innerW);
    const yAt = (remaining: number) =>
        pad + (1 - Math.min(1, Math.max(0, remaining / total))) * innerH;

    // Ideal line: total at the first point, 0 at the last.
    const idealStart = `${xAt(0)},${yAt(total)}`;
    const idealEnd = `${xAt(n - 1)},${yAt(0)}`;

    const actualPath = data.map((p, i) => `${xAt(i)},${yAt(p.remaining)}`).join(" ");

    // "Today" anchor — the most recent point we have. In practice the
    // backend returns daily points up to today, so the last point is
    // today's remaining. Highlight it with a small dot.
    const last = data[data.length - 1];
    const lastX = xAt(n - 1);
    const lastY = yAt(last.remaining);

    return (
        <Tooltip
            title={`${last.remaining} of ${total} tasks remaining`}
            placement="top"
            variant="outlined"
            arrow
        >
            <Box
                sx={{
                    display: "inline-flex",
                    px: 0.5,
                    cursor: "help",
                }}
            >
                <svg width={width} height={height} aria-hidden>
                    <line
                        x1={idealStart.split(",")[0]}
                        y1={idealStart.split(",")[1]}
                        x2={idealEnd.split(",")[0]}
                        y2={idealEnd.split(",")[1]}
                        stroke={P.textMuted}
                        strokeOpacity={0.55}
                        strokeWidth={1}
                        strokeDasharray="3 3"
                    />
                    <polyline
                        points={actualPath}
                        fill="none"
                        stroke={actualColor}
                        strokeWidth={2}
                        strokeLinejoin="round"
                        strokeLinecap="round"
                    />
                    <circle cx={lastX} cy={lastY} r={3} fill={actualColor} />
                </svg>
            </Box>
        </Tooltip>
    );
};
