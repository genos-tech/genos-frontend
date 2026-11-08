import { Box, CircularProgress, Skeleton, Stack, Typography } from "@mui/joy";

import { useTranslation } from "../../../i18n";
import { g } from "../../../theme/tokens";

/**
 * Loading placeholders (MIP-1132). There were 45 raw `CircularProgress`
 * spinners and a single skeleton; a list that is loading looked like an
 * empty list for a moment, or like a jumping page when the rows landed.
 *
 * Use `SkeletonRows` where a LIST or panel of rows is loading (it takes the
 * user's row height, so the page does not move when the data arrives),
 * `SkeletonLines` for a block of text, and `Spinner` for a wait with no
 * known shape (a field, one value, a dialog body, a page).
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

// Joy's pulse is decoration: still under `prefers-reduced-motion`.
const still = {
    "@media (prefers-reduced-motion: reduce)": {
        animation: "none",
        "&::after": { animation: "none" },
    },
} as const;

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
                    {avatar && <Skeleton height={28} sx={still} variant="circular" width={28} />}
                    <Stack spacing={0.5} sx={{ flex: 1, minWidth: 0 }}>
                        <Skeleton
                            height={12}
                            sx={{ borderRadius: g.radius.xs, ...still }}
                            variant="rectangular"
                            width={WIDTHS[i % WIDTHS.length]}
                        />
                        {twoLines && (
                            <Skeleton
                                height={10}
                                sx={{ borderRadius: g.radius.xs, ...still }}
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
                    sx={{ borderRadius: g.radius.xs, ...still }}
                    variant="rectangular"
                    width={i === lines - 1 ? "55%" : "100%"}
                />
            ))}
        </Stack>
    );
};

type SpinnerSize = "xs" | "sm" | "md" | "lg";
type SpinnerProps = {
    /** xs 12 (beside a line of text), sm 16 (in a field/menu row), md 24 (a dialog body), lg 40 (a page). */
    size?: SpinnerSize;
    label?: string;
    /**
     * Visible words beside the spinner ("Finishing sign-in..."). Use it when
     * the wait can last seconds (a page, an AI answer). It also names the
     * spinner for assistive tech, so `label` is not needed with it.
     */
    caption?: string;
    /** Put the caption under the spinner instead of beside it. */
    stacked?: boolean;
};

const SPINNER_PX: Record<SpinnerSize, string> = { xs: "12px", sm: "16px", md: "24px", lg: "40px" };

/**
 * One spinner for everything that is not a list (MIP-1173). Decision rule:
 * inside a button -> the Button's own `loading` prop; a LIST or table that
 * is loading -> `SkeletonRows`; a block of text -> `SkeletonLines`; a field,
 * a menu row or one value -> `Spinner`; a dialog body or a whole page ->
 * `Spinner` with a `caption`.
 */
export const Spinner = ({ size = "sm", label, caption, stacked = false }: SpinnerProps) => {
    const { t } = useTranslation();
    const indicator = (
        <CircularProgress
            // With a caption the wrapper's status already says it in words: the ring
            // is decoration then, or a screen reader would read it three times.
            aria-hidden={caption ? true : undefined}
            aria-label={caption ? undefined : (label ?? t.common.feedback.loading)}
            size={size === "xs" || size === "sm" ? "sm" : "md"}
            sx={{ "--CircularProgress-size": SPINNER_PX[size], flexShrink: 0 }}
        />
    );
    if (!caption) return indicator;
    return (
        <Stack
            alignItems="center"
            direction={stacked ? "column" : "row"}
            role="status"
            spacing={stacked ? 1.5 : 1}
            sx={{ minWidth: 0 }}
        >
            {indicator}
            <Typography level="body-sm" sx={{ color: g.text.secondary, minWidth: 0 }}>
                {caption}
            </Typography>
        </Stack>
    );
};
