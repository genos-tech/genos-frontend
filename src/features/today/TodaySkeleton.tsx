import { Box, Skeleton } from "@mui/joy";

import { StatStrip } from "../../components/ui/dashboard";
import { SkeletonLines, SkeletonRows } from "../../components/ui/feedback/Skeleton";
import { LoadingDots } from "../../components/ui/misc/LoadingIndicator";
import { g } from "../../theme/tokens";
import { ROW_MIN_HEIGHT } from "./rowDivider";
import {
    SECTION_BADGE_PX,
    SECTION_HEADER_SX,
    sectionCardSx,
    SECTIONS_GRID_SX,
    SUMMARY_GRID_SX,
} from "./sectionStyles";

const still = {
    "@media (prefers-reduced-motion: reduce)": {
        animation: "none",
        "&::after": { animation: "none" },
    },
} as const;

const Bar = ({ width, height }: { width: number | string; height: number }) => (
    <Skeleton
        height={height}
        sx={{ borderRadius: g.radius.xs, flexShrink: 0, ...still }}
        variant="rectangular"
        width={width}
    />
);

const card = {
    bgcolor: g.surface.default,
    border: `1px solid ${g.border.subtle}`,
    borderRadius: g.radius.md,
    p: 1.5,
    minWidth: 0,
    minHeight: 72,
    display: "flex",
    flexDirection: "column",
    justifyContent: "center",
    gap: 1,
} as const;

/**
 * Today while its one (slow) request is out (MIP-2442): moving dots beside the words, over a
 * placeholder in the shape of the loaded page, so it never looks stuck and nothing jumps when the
 * answer lands. Only the status line is read out; the shapes are decoration.
 */
export const TodaySkeleton = ({ label }: { label: string }) => (
    <Box data-testid="today-skeleton" sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
        <LoadingDots label={label} />
        <Box aria-hidden="true" sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
            <Box sx={{ maxWidth: 360 }}>
                <SkeletonLines lines={2} />
            </Box>
            <Box sx={SUMMARY_GRID_SX}>
                <StatStrip>
                    {[0, 1, 2, 3].map((i) => (
                        <Box key={i} sx={card}>
                            <Bar height={20} width={28} />
                            <Bar height={10} width="60%" />
                        </Box>
                    ))}
                </StatStrip>
                <Box sx={card}>
                    <Bar height={12} width="40%" />
                    <Bar height={8} width="100%" />
                </Box>
            </Box>
            <Box sx={SECTIONS_GRID_SX}>
                {[0, 1, 2, 3].map((i) => (
                    <Box key={i} sx={sectionCardSx("mine", g.border.subtle)}>
                        <Box sx={SECTION_HEADER_SX}>
                            <Bar height={SECTION_BADGE_PX} width={SECTION_BADGE_PX} />
                            <Bar height={12} width="35%" />
                        </Box>
                        <Box sx={{ "& [data-skeleton] > *": { minHeight: ROW_MIN_HEIGHT } }}>
                            <SkeletonRows count={2} twoLines />
                        </Box>
                    </Box>
                ))}
            </Box>
        </Box>
    </Box>
);
