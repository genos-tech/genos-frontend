import { keyframes } from "@emotion/react";
import { Box, Typography } from "@mui/joy";

// The app's pulsing-dots loader with a caption underneath, shared by the task
// / milestone / create pane loader (`TaskPaneLoading`, MIP-962) and the
// service-switch loader (`ServiceSwitchLoader`, MIP-965) so the two read as
// one vocabulary.
//
// Renders a FRAGMENT (the dots row, then the caption) so the host surface
// keeps owning its flex layout and `gap`: the markup `TaskPaneLoading` had
// before this was extracted is byte-for-byte what it renders now.

/**
 * How long the dots and caption stay invisible before they fade in, for a
 * switch. ~ a few frames: longer than a cache-hit swap (which lands within a
 * frame), short enough that a genuinely slow load shows feedback before it
 * feels stuck. The service-switch loader uses it; it equals the task switch's
 * `SWITCH_LOADER_DELAY_MS` (kept as its own literal there so that file keeps
 * exporting only constants for Fast Refresh) and a test holds the two together.
 */
export const LOADING_INDICATOR_DELAY_MS = 150;

const dotPulse = keyframes`
    0%, 80%, 100% { transform: scale(0.6); opacity: 0.5; }
    40% { transform: scale(1); opacity: 1; }
`;

// Delayed variant: the host's SURFACE is visible immediately with no entrance
// animation, so a swap that lands within a frame or two reads as one screen to
// the next with no blank pane. Only the dots + caption are invisible for
// `fadeInDelayMs` and then fade in. `both` fill-mode holds opacity 0 through
// the delay: no timer or state (so it keeps animating while the main thread is
// busy), and a switch that resolves inside the delay never paints the dots at
// all. Under `prefers-reduced-motion` the fade becomes a 1ms opacity step that
// keeps the delay.
const delayedShow = keyframes`
    from { opacity: 0; }
    to { opacity: 1; }
`;

type LoadingIndicatorProps = {
    isDark: boolean;
    /** The caption, e.g. "Loading task…". */
    label: string;
    /** When set, the dots + caption fade in only after this many ms.
     *  Omitted = they show immediately. */
    fadeInDelayMs?: number;
};

export const LoadingIndicator = ({ isDark, label, fadeInDelayMs }: LoadingIndicatorProps) => {
    // Applied to the dots and the caption only (not the host surface).
    const delayedContentSx =
        fadeInDelayMs != null
            ? {
                  animation: `${delayedShow} 0.2s ease-out ${fadeInDelayMs}ms both`,
                  "@media (prefers-reduced-motion: reduce)": {
                      animation: `${delayedShow} 1ms linear ${fadeInDelayMs}ms both`,
                  },
              }
            : undefined;

    return (
        <>
            {/* Pulsing dots — the app's shared loading vocabulary. */}
            <Box sx={{ display: "flex", gap: "12px", ...delayedContentSx }}>
                {[0, 1, 2].map((i) => (
                    <Box
                        key={i}
                        sx={{
                            width: "10px",
                            height: "10px",
                            borderRadius: "50%",
                            background:
                                "linear-gradient(135deg, #6366f1 0%, var(--gp-brand-500) 100%)",
                            animation: `${dotPulse} 1.4s ease-in-out infinite`,
                            animationDelay: `${i * 0.16}s`,
                        }}
                    />
                ))}
            </Box>

            <Typography
                level="body-sm"
                sx={{
                    color: isDark ? "rgba(255,255,255,0.5)" : "rgba(0,0,0,0.45)",
                    letterSpacing: "0.01em",
                    ...delayedContentSx,
                }}
            >
                {label}
            </Typography>
        </>
    );
};
