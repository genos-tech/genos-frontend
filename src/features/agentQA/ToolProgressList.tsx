// Agent activity strip — renders each tool the agent has fired so the
// user sees progress in real time. Used by every agent surface
// (Spotlight, per-thread Ask, future per-note Ask) so the surfaces
// report progress identically.
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
import type { ToolEvent } from "./types";

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

// "230ms" below a second, "1.8s" above — SI notation, deliberately not
// localized (matches how every locale reads durations in tech UIs, so
// the strip and the per-turn total can share it without label props).
export const formatDurationMs = (ms: number): string =>
    ms < 1000 ? `${Math.max(ms, 0)}ms` : `${(ms / 1000).toFixed(1)}s`;

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
            {/* Server-measured execution time (absent while pending, on
                cache hits, and against older backends). Dim + tabular so
                a column of steps reads like a profile. */}
            {typeof event.duration_ms === "number" && (
                <Typography
                    level="body-xs"
                    sx={{
                        flexShrink: 0,
                        whiteSpace: "nowrap",
                        fontVariantNumeric: "tabular-nums",
                        color: isDark ? DARK_TEXT_MEDIUM : "text.tertiary",
                        opacity: isDark ? 0.8 : 1,
                    }}
                >
                    {formatDurationMs(event.duration_ms)}
                </Typography>
            )}
        </Box>
    );
};
