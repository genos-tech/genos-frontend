import { forwardRef, ReactNode } from "react";
import { Box, Sheet } from "@mui/joy";

// Shared visual frame for the task / milestone preview panes.
//
// Both `TaskPreview` and `MilestonePreviewInner` rendered the same
// outer `<Sheet>` + the same three wrapper `<Box>`s (header, main
// content, tabs). Pass 1 of the merge extracts that frame here so the
// branches diverge only on the actual slot contents.
//
// Things that stay slotted (not centralized) because the branches
// genuinely differ:
//   - `accent`: task uses a dark/light gradient pair at 0.8 opacity;
//     milestone uses a single dark gradient at full opacity. The
//     pre-refactor JSX preserved that visual distinction; we keep it
//     intact by letting each caller pass its own accent JSX.
//   - `header`: task delegates to `TaskTitleBlock`; milestone uses a
//     hand-rolled header with a flag icon, status transition buttons,
//     a chip, a MoreMenu, a close button, and a free-text title input.
//   - `mainContent`: task includes the optional PR-card list; both
//     branches embed the same MainBlock / BodyBlock / SubTasksBlock
//     trio but with kind-specific props.
//   - `tabs`: milestone only mounts this when `milestone.taskId != null`.
//     Callers pass `null` (or omit) to suppress the wrapper entirely.
type TaskPreviewLayoutProps = {
    isDark: boolean;
    accent: ReactNode;
    header: ReactNode;
    mainContent: ReactNode;
    tabs?: ReactNode;
};

// `forwardRef` so the task branch can still scroll the outer sheet to
// the top on task switch (see the two scroll-management effects in
// `TaskPreview`). The milestone branch never reads the ref and simply
// omits it.
export const TaskPreviewLayout = forwardRef<HTMLDivElement, TaskPreviewLayoutProps>(
    function TaskPreviewLayout({ isDark, accent, header, mainContent, tabs }, ref) {
        return (
            <Sheet
                ref={ref}
                className={`custom-scrollbar-${isDark ? "dark" : "light"}`}
                sx={{
                    minHeight: 500,
                    borderRadius: "16px",
                    p: 0,
                    overflowY: "auto",
                    overflowX: "hidden",
                    background: isDark
                        ? "linear-gradient(180deg, rgba(22,22,28,0.98) 0%, rgba(18,18,24,1) 100%)"
                        : "linear-gradient(180deg, rgba(255,255,255,0.98) 0%, rgba(252,252,255,1) 100%)",
                    border: "1px solid",
                    borderColor: isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.08)",
                    boxShadow: isDark
                        ? "0 8px 32px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.03)"
                        : "0 8px 32px rgba(0,0,0,0.08), inset 0 1px 0 rgba(255,255,255,0.8)",
                    position: "relative",
                    animation: "slideIn 0.3s ease-out",
                    "@keyframes slideIn": {
                        from: { opacity: 0, transform: "translateY(8px)" },
                        to: { opacity: 1, transform: "translateY(0)" },
                    },
                }}
            >
                {accent}

                <Box
                    sx={{
                        p: 2.5,
                        pt: 3,
                        borderBottom: "1px solid",
                        borderColor: isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)",
                    }}
                >
                    {header}
                </Box>

                <Box sx={{ p: 2.5 }}>{mainContent}</Box>

                {tabs != null && (
                    <Box
                        sx={{
                            borderTop: "1px solid",
                            borderColor: isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)",
                            background: isDark ? "rgba(255,255,255,0.01)" : "rgba(0,0,0,0.01)",
                        }}
                    >
                        {tabs}
                    </Box>
                )}
            </Sheet>
        );
    }
);
