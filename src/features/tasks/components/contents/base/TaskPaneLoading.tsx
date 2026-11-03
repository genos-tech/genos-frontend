import { Box, Sheet } from "@mui/joy";

import { LoadingIndicator } from "../../../../../components/ui/misc/LoadingIndicator";

// Loading state for the task / milestone / create panes.
//
// Those panes stay mounted while their content is fetched by id (see the
// TaskHomeLayout mount guard) — for the 1–2s of a cold by-id load the pane
// would otherwise be blank. This fills that gap with the app's standard
// pulsing-dots loader (matches `RouteLoadingFallback`) inside a Sheet sized
// to the pane (`minHeight: 500`, same rounding / gradient / accent bar as
// `TaskPreviewLayout`), so the surface reads as the same pane and nothing
// reflows when the real content swaps in.

// The delayed variant (task SWITCH) keeps the card SURFACE (Sheet, gradient,
// accent bar) visible immediately with no entrance animation, so a swap that
// lands within a frame or two reads as card-to-card with no blank pane. The
// dots + caption, and their delayed fade, live in the shared
// `LoadingIndicator`.

type TaskPaneLoadingProps = {
    isDark: boolean;
    // Accessible + visible caption, e.g. "Loading task…". Kept as a prop so
    // the same loader serves the task, milestone, and create panes.
    label: string;
    // When set, the card surface shows immediately but the dots + caption fade
    // in only after this many ms. For the task-SWITCH case: a cache-hit swap
    // lands within a frame, and flashing dots on every click would blink.
    // Omitted = everything shows immediately (first open, chat,
    // milestone/create panes), the original behaviour.
    fadeInDelayMs?: number;
};

export const TaskPaneLoading = ({ isDark, label, fadeInDelayMs }: TaskPaneLoadingProps) => {
    return (
        <Sheet
            aria-busy="true"
            aria-label={label}
            role="status"
            sx={{
                // Fill the pane's full height. The parent (`ls.mainPanel`) is a
                // `flex-direction: column` box at `100dvh`; the loaded task fills
                // it because its content is tall, so the loader must grow the same
                // way instead of collapsing to `minHeight`. `flex: 1` fills a flex
                // parent; `minHeight` is the floor for any non-flex mount site.
                flex: 1,
                minHeight: 500,
                borderRadius: "16px",
                p: 0,
                overflow: "hidden",
                background: isDark
                    ? "linear-gradient(180deg, rgba(22,22,28,0.98) 0%, rgba(18,18,24,1) 100%)"
                    : "linear-gradient(180deg, rgba(255,255,255,0.98) 0%, rgba(252,252,255,1) 100%)",
                border: "1px solid",
                borderColor: isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.08)",
                boxShadow: isDark
                    ? "0 8px 32px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.03)"
                    : "0 8px 32px rgba(0,0,0,0.08), inset 0 1px 0 rgba(255,255,255,0.8)",
                position: "relative",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                gap: 2.5,
                // Delayed variant: no entrance animation — the surface is the
                // stand-in for the outgoing card and must not itself flash.
                animation: fadeInDelayMs != null ? "none" : "slideIn 0.3s ease-out",
                "@keyframes slideIn": {
                    from: { opacity: 0, transform: "translateY(8px)" },
                    to: { opacity: 1, transform: "translateY(0)" },
                },
            }}
        >
            {/* Accent bar — mirrors the loaded pane's top edge. */}
            <Box
                sx={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    right: 0,
                    height: "3px",
                    background:
                        "linear-gradient(90deg, #6366f1 0%, var(--gp-brandalt-500) 50%, var(--gp-brand-500) 100%)",
                    borderRadius: "16px 16px 0 0",
                    opacity: 0.8,
                }}
            />

            <LoadingIndicator fadeInDelayMs={fadeInDelayMs} isDark={isDark} label={label} />
        </Sheet>
    );
};
