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

import { useCoveredOverlay } from "../../components/ui/modal/overlayStack";
import { g } from "../../theme/tokens";
import { SpotlightContent, type SpotlightContentProps } from "./SpotlightContent";

interface Props extends SpotlightContentProps {
    isOpen: boolean;
    onClose: () => void;
}

// Above ServiceSwitcherOverlay (13000).
const SPOTLIGHT_Z_INDEX = 13100;

export const SpotlightOverlay = ({ isOpen, onClose, ...contentProps }: Props) => {
    // A preview opened from a result sits on top of this overlay: its blur is enough (MIP-2556).
    const covered = useCoveredOverlay(isOpen, SPOTLIGHT_Z_INDEX);
    if (!isOpen) return null;

    return (
        <Box
            // Backdrop. Captures clicks outside the sheet to close.
            data-covered={covered || undefined}
            sx={{
                position: "fixed",
                inset: 0,
                zIndex: SPOTLIGHT_Z_INDEX,
                display: "flex",
                alignItems: "flex-start",
                justifyContent: "center",
                // Sit closer to the top on mobile so the overlay uses
                // more of the (already cramped) viewport, and clears
                // the iPhone notch / status bar.
                pt: { xs: "calc(env(safe-area-inset-top, 0px) + 12px)", sm: "12vh" },
                px: { xs: 1, sm: 0 },
                background: g.scrim,
                backdropFilter: covered ? "none" : "blur(2px)",
                WebkitBackdropFilter: covered ? "none" : "blur(2px)",
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
                    // An opaque raised surface (the blur this sheet used to carry
                    // only showed through a 92% fill), so the conversation
                    // header inside it can be the very same color.
                    background: g.surface.raised,
                    border: "1px solid",
                    borderColor: g.border.default,
                    boxShadow: g.shadow.lg,
                    overflow: "hidden",
                }}
            >
                <SpotlightContent {...contentProps} />
            </Sheet>
        </Box>
    );
};
