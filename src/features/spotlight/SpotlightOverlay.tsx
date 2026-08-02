// macOS Spotlight–style global search overlay — the Cmd-K chrome.
//
// UX:
//   - Cmd-K / Ctrl-K toggles open (wired by `useSpotlight`).
//   - Backdrop click closes; Escape closes (handled by the hook).
//
// This component is ONLY the overlay shell: fixed fullscreen backdrop
// + centered MUI Joy `<Sheet>` at zIndex 13000+ to sit above all other
// surfaces (see `components/layout/ServiceSwitcherOverlay.tsx` for the
// prior art). The actual surface — input row, filter chips,
// conversation panel, results list — lives in `SpotlightContent`,
// shared with the full-page Genos surface. Conversation state lives in
// `useSpotlight` at the App root, so closing the overlay (which
// unmounts the content) never loses the conversation.

import { Box, Sheet } from "@mui/joy";
import { useColorScheme } from "@mui/joy/styles";

import { SpotlightContent, type SpotlightContentProps } from "./SpotlightContent";

interface Props extends SpotlightContentProps {
    isOpen: boolean;
    onClose: () => void;
}

export const SpotlightOverlay = ({ isOpen, onClose, ...contentProps }: Props) => {
    const { mode } = useColorScheme();
    const isDark = mode === "dark";

    if (!isOpen) return null;

    return (
        <Box
            // Backdrop. Captures clicks outside the sheet to close.
            sx={{
                position: "fixed",
                inset: 0,
                zIndex: 13100, // above ServiceSwitcherOverlay (13000)
                display: "flex",
                alignItems: "flex-start",
                justifyContent: "center",
                // Sit closer to the top on mobile so the overlay uses
                // more of the (already cramped) viewport, and clears
                // the iPhone notch / status bar.
                pt: { xs: "calc(env(safe-area-inset-top, 0px) + 12px)", sm: "12vh" },
                px: { xs: 1, sm: 0 },
                background: isDark ? "rgba(0,0,0,0.45)" : "rgba(15,15,30,0.25)",
                backdropFilter: "blur(2px)",
                WebkitBackdropFilter: "blur(2px)",
            }}
            onMouseDown={(e) => {
                if (e.target === e.currentTarget) onClose();
            }}
        >
            <Sheet
                variant="soft"
                sx={{
                    // Mobile: use nearly full width so the Ask button
                    // fits on the same row as the input + search icon.
                    // Desktop nudged up to 780px so the input still
                    // breathes after adding the History icon next to Ask.
                    width: { xs: "100%", sm: "min(800px, 93vw)" },
                    // Reserve room for the BottomTabBar so the overlay's
                    // bottom edge doesn't slide under it on mobile.
                    maxHeight: {
                        xs: "calc(100dvh - 24px - var(--BottomTabBar-height, 60px) - env(safe-area-inset-top, 0px))",
                        sm: "70vh",
                    },
                    display: "flex",
                    flexDirection: "column",
                    borderRadius: "16px",
                    backdropFilter: "blur(20px) saturate(180%)",
                    WebkitBackdropFilter: "blur(20px) saturate(180%)",
                    background: isDark
                        ? "rgba(var(--gp-dark-surface-a-rgb), 0.92)"
                        : "rgba(250,248,255,0.96)",
                    border: "1px solid",
                    borderColor: isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)",
                    boxShadow: isDark
                        ? "0 24px 60px rgba(0,0,0,0.6)"
                        : "0 24px 60px rgba(15,15,30,0.2)",
                    overflow: "hidden",
                }}
            >
                <SpotlightContent {...contentProps} />
            </Sheet>
        </Box>
    );
};
