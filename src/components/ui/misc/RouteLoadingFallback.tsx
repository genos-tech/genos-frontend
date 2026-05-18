import { keyframes } from "@emotion/react";
import { Box } from "@mui/joy";

// Minimal fallback shown while a lazy-loaded feature chunk is downloading.
// Sized to match the workspace pane so the layout doesn't reflow when the
// real route mounts. Intentionally side-effect-free (unlike `InitialLoad`,
// which kicks off `loadInitialData`) — this only runs between chunk
// download start and module evaluation, typically a few hundred
// milliseconds on first navigation and instant on subsequent visits.

const dotPulse = keyframes`
    0%, 80%, 100% { transform: scale(0.6); opacity: 0.5; }
    40% { transform: scale(1); opacity: 1; }
`;

export const RouteLoadingFallback = () => (
    <Box
        sx={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flex: 1,
            minHeight: 0,
            height: "100%",
        }}
    >
        <Box sx={{ display: "flex", gap: "12px" }}>
            {[0, 1, 2].map((i) => (
                <Box
                    key={i}
                    sx={{
                        width: "10px",
                        height: "10px",
                        borderRadius: "50%",
                        background: "linear-gradient(135deg, #6366f1 0%, #a855f7 100%)",
                        animation: `${dotPulse} 1.4s ease-in-out infinite`,
                        animationDelay: `${i * 0.16}s`,
                    }}
                />
            ))}
        </Box>
    </Box>
);
