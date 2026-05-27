// Agent activity strip — renders each tool the agent has fired so the
// user sees progress in real time. Used by both SpotlightOverlay (the
// global agent surface) and ThreadAskModal (the per-thread agent
// surface) so the two surfaces report progress identically.
//
// Rules:
//   - Pending step → spinner + the tool name with a short arg preview
//   - Done step    → green ✓ + the backend-produced `summary`
//   - Errored step → red ✗ + the tool name and the error text
//
// `humanReadableCall` is the fallback label for pending events where
// the backend hasn't yet sent a summary.

import { Box, CircularProgress, Typography } from "@mui/joy";

import { DARK_TEXT_STRONG } from "./markdownAnswerSx";
import type { ToolEvent } from "./useSpotlight";

// Mid-strength dark-mode body color used only here; kept local rather
// than threading through markdownAnswerSx since it's an intermediate
// state (pending-tool label) the typography block doesn't cover.
const DARK_TEXT_MEDIUM = "#cebfeb";

export const humanReadableCall = (e: ToolEvent): string => {
    const argPreview =
        Object.keys(e.arguments).length > 0
            ? Object.entries(e.arguments)
                  .slice(0, 2)
                  .map(([k, v]) => `${k}=${JSON.stringify(v)}`)
                  .join(", ")
            : "";
    return argPreview ? `${e.tool_name}(${argPreview})` : e.tool_name;
};

interface ToolProgressListProps {
    events: ToolEvent[];
    isDark: boolean;
}

export const ToolProgressList = ({ events, isDark }: ToolProgressListProps) => {
    if (events.length === 0) return null;
    return (
        <Box
            sx={{
                display: "flex",
                flexDirection: "column",
                gap: 0.25,
                mb: 0.75,
                pl: 0.25,
                borderLeft: "2px solid",
                borderColor: isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.08)",
            }}
        >
            {events.map((e) => (
                <ToolProgressRow key={`${e.step}:${e.tool_name}`} event={e} isDark={isDark} />
            ))}
        </Box>
    );
};

const ToolProgressRow = ({ event, isDark }: { event: ToolEvent; isDark: boolean }) => {
    const isPending = event.status === "pending";
    const isError = event.status === "error";

    const label = event.summary || humanReadableCall(event);

    return (
        <Box
            sx={{
                display: "flex",
                alignItems: "center",
                gap: 0.75,
                pl: 1,
                py: 0.25,
                fontSize: "0.9375rem",
            }}
        >
            {isPending && (
                <CircularProgress size="sm" sx={{ "--CircularProgress-size": "11px" }} />
            )}
            {!isPending && !isError && (
                <Box
                    component="span"
                    sx={{
                        color: "success.500",
                        fontWeight: 700,
                        width: 14,
                        textAlign: "center",
                    }}
                >
                    ✓
                </Box>
            )}
            {isError && (
                <Box
                    component="span"
                    sx={{
                        color: "danger.500",
                        fontWeight: 700,
                        width: 14,
                        textAlign: "center",
                    }}
                >
                    ✗
                </Box>
            )}
            <Typography
                level="body-sm"
                sx={{
                    opacity: isPending ? (isDark ? 1 : 0.8) : 1,
                    color: isError
                        ? "danger.500"
                        : isDark
                          ? isPending
                              ? DARK_TEXT_MEDIUM
                              : DARK_TEXT_STRONG
                          : undefined,
                }}
            >
                {isError ? `${event.tool_name}: ${event.error}` : label}
            </Typography>
        </Box>
    );
};
