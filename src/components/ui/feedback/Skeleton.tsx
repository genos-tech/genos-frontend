import { Box, CircularProgress, Skeleton, Stack } from "@mui/joy";

import { useTranslation } from "../../../i18n";
import { g } from "../../../theme/tokens";

/**
 * Loading placeholders (MIP-1132). There were 45 raw `CircularProgress`
 * spinners and a single skeleton; a list that is loading looked like an
 * empty list for a moment, or like a jumping page when the rows landed.
 *
 * Use `SkeletonRows` where a LIST or panel of rows is loading (it takes the
 * user's row height, so the page does not move when the data arrives),
 * `SkeletonLines` for a block of text, and `Spinner` only for a small
 * inline wait (a button, a field, one value) where no shape is known.
 *
 * Each one announces itself once as "Loading" (`role="status"`) instead of
 * every bar being read out.
 */

type SkeletonRowsProps = {
    count?: number;
    /** A round avatar at the start of each row (people, chats). */
    avatar?: boolean;
    /** Two lines per row (title + meta) instead of one. */
    twoLines?: boolean;
    /** Accessible name; defaults to the localized "Loading". */
    label?: string;
};

// Widths cycle so a column of bars does not read as a rigid grid.
const WIDTHS = ["72%", "56%", "64%", "48%", "68%", "52%"];

export const SkeletonRows = ({
    count = 5,
    avatar = false,
    twoLines = false,
    label,
}: SkeletonRowsProps) => {
    const { t } = useTranslation();
    return (
        <Box
            aria-busy="true"
            aria-label={label ?? t.common.feedback.loading}
            data-skeleton="rows"
            role="status"
            sx={{ display: "flex", flexDirection: "column", minWidth: 0 }}
        >
            {Array.from({ length: count }, (_, i) => (
                <Stack
                    key={i}
                    alignItems="center"
                    direction="row"
                    spacing={1.25}
                    sx={{
                        minHeight: g.row.current,
                        px: 1.5,
                        py: twoLines ? 0.75 : 0,
                        minWidth: 0,
                    }}
                >
                    {avatar && <Skeleton height={28} variant="circular" width={28} />}
                    <Stack spacing={0.5} sx={{ flex: 1, minWidth: 0 }}>
                        <Skeleton
                            height={12}
                            sx={{ borderRadius: g.radius.xs }}
                            variant="rectangular"
                            width={WIDTHS[i % WIDTHS.length]}
                        />
                        {twoLines && (
                            <Skeleton
                                height={10}
                                sx={{ borderRadius: g.radius.xs }}
                                variant="rectangular"
                                width={WIDTHS[(i + 3) % WIDTHS.length]}
                            />
                        )}
                    </Stack>
                </Stack>
            ))}
        </Box>
    );
};

type SkeletonLinesProps = { lines?: number; label?: string };

export const SkeletonLines = ({ lines = 3, label }: SkeletonLinesProps) => {
    const { t } = useTranslation();
    return (
        <Stack
            aria-busy="true"
            aria-label={label ?? t.common.feedback.loading}
            data-skeleton="lines"
            role="status"
            spacing={0.75}
            sx={{ minWidth: 0 }}
        >
            {Array.from({ length: lines }, (_, i) => (
                <Skeleton
                    key={i}
                    height={12}
                    sx={{ borderRadius: g.radius.xs }}
                    variant="rectangular"
                    width={i === lines - 1 ? "55%" : "100%"}
                />
            ))}
        </Stack>
    );
};

type SpinnerProps = { size?: "sm" | "md"; label?: string };

/** A small inline wait. Not for lists: use `SkeletonRows`. */
export const Spinner = ({ size = "sm", label }: SpinnerProps) => {
    const { t } = useTranslation();
    return (
        <CircularProgress
            aria-label={label ?? t.common.feedback.loading}
            size={size === "sm" ? "sm" : "md"}
            sx={{ "--CircularProgress-size": size === "sm" ? "16px" : "24px" }}
        />
    );
};
