import { Box, Skeleton, Stack } from "@mui/joy";

/**
 * Placeholder rows shown while a cold channel's first message page is in
 * flight. Before this, opening a never-synced chat rendered an empty
 * scroller for the whole round-trip, which reads as "this chat is empty"
 * or "the app is broken" rather than "loading".
 *
 * Alternating alignment mimics the sent/received rhythm of a real
 * conversation so the pane's shape doesn't jump when the messages land.
 */

// Widths cycle so the placeholder doesn't look like a rigid grid.
const ROWS = [
    { align: "flex-start", width: "62%" },
    { align: "flex-start", width: "44%" },
    { align: "flex-end", width: "55%" },
    { align: "flex-start", width: "70%" },
    { align: "flex-end", width: "38%" },
    { align: "flex-start", width: "50%" },
] as const;

export const MessageListSkeleton = () => (
    <Box
        aria-busy="true"
        aria-live="polite"
        sx={{ flex: 1, minHeight: 0, px: 1.5, py: 1, overflow: "hidden" }}
    >
        <Stack spacing={2} sx={{ justifyContent: "flex-end", height: "100%" }}>
            {ROWS.map((row, i) => (
                <Stack
                    key={i}
                    direction="row"
                    spacing={1.5}
                    sx={{ alignItems: "flex-start", justifyContent: row.align }}
                >
                    {row.align === "flex-start" && (
                        <Skeleton height={32} variant="circular" width={32} />
                    )}
                    <Stack spacing={0.5} sx={{ width: row.width, maxWidth: 520 }}>
                        <Skeleton level="body-xs" variant="text" width="30%" />
                        <Skeleton height={38} sx={{ borderRadius: "8px" }} variant="rectangular" />
                    </Stack>
                </Stack>
            ))}
        </Stack>
    </Box>
);
