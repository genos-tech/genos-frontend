import { Box } from "@mui/joy";
import { useColorScheme } from "@mui/joy/styles";

import { AppTooltip } from "../../../../components/ui/AppTooltip";
import { fmt, useTranslation } from "../../../../i18n";
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
    const { t } = useTranslation();
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
        <AppTooltip
            title={fmt(t.tasks.diagram.tooltips.tasksRemaining, {
                remaining: last.remaining,
                total,
            })}
        >
            <Box
                sx={{
                    display: "inline-flex",
                    px: 0.5,
                    cursor: "help",
                }}
            >
                <svg height={height} width={width} aria-hidden>
                    <line
                        // `style`, not a `stroke=` attribute: palette values are
                        // CSS variables, and SVG presentation attributes never
                        // resolve `var()` (the line would render unpainted).
                        style={{ stroke: P.textMuted }}
                        strokeDasharray="3 3"
                        strokeOpacity={0.55}
                        strokeWidth={1}
                        x1={idealStart.split(",")[0]}
                        x2={idealEnd.split(",")[0]}
                        y1={idealStart.split(",")[1]}
                        y2={idealEnd.split(",")[1]}
                    />
                    <polyline
                        fill="none"
                        points={actualPath}
                        stroke={actualColor}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                    />
                    <circle cx={lastX} cy={lastY} fill={actualColor} r={3} />
                </svg>
            </Box>
        </AppTooltip>
    );
};
