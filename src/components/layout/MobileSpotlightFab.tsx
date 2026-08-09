import { useCallback, useEffect, useRef, useState } from "react";
import AutoAwesomeRoundedIcon from "@mui/icons-material/AutoAwesomeRounded";
import { IconButton } from "@mui/joy";
import { useColorScheme } from "@mui/joy/styles";

import { useIsMobile } from "../../hooks/common/useIsMobile";
import { useTranslation } from "../../i18n";
import { purplePalette } from "../../theme/purplePalette";
import {
    clampFabTop,
    FAB_EDGE_GAP,
    FAB_SIZE,
    FabPosition,
    isFabTap,
    readStoredFabPosition,
    resolveFabDrop,
    writeStoredFabPosition,
} from "./spotlightFabPosition";

type MobileSpotlightFabProps = {
    // Fires on tap (never on drag). Navigates to the Genos page —
    // renamed from `onOpenSpotlight` when the FAB's destination changed
    // from the overlay to /workspace/genos.
    onPress: () => void;
};

/** Live value of `--mobile-bottom-inset` (the tab bar, or the keyboard
 *  when it's up). Read from the computed root style rather than
 *  hard-coded so the drag bounds honour the notch and the keyboard the
 *  same way the layouts do. */
const readBottomInset = (): number => {
    const raw = getComputedStyle(document.documentElement).getPropertyValue(
        "--mobile-bottom-inset"
    );
    const parsed = Number.parseFloat(raw);
    return Number.isFinite(parsed) ? parsed : 60;
};

// Floating action button for the global Spotlight overlay, reachable from
// every mobile workspace screen. Desktop reaches the same surface via
// Cmd/Ctrl-K and the sidebar's search entry, so this is mobile-only.
//
// DRAGGABLE because a fixed button can't avoid every surface underneath
// it: parked bottom-right it sat exactly on the chat composer's "Send"
// button and swallowed those taps. Rather than pick another corner that
// happens to be free on the screens we thought of, the user drags it
// wherever suits them; it snaps to the nearest side edge and persists.
export const MobileSpotlightFab = ({ onPress }: MobileSpotlightFabProps) => {
    const isMobile = useIsMobile();
    const { mode } = useColorScheme();
    const { t } = useTranslation();

    // `null` until the user moves it: the default anchor stays expressed
    // in CSS (`bottom: calc(var(--BottomTabBar-height) + 16px)`) so it
    // tracks the tab bar / home-indicator inset without JS.
    const [position, setPosition] = useState<FabPosition | null>(readStoredFabPosition);
    // Viewport coords of the button's top-left while a drag is in flight.
    const [dragXY, setDragXY] = useState<{ x: number; y: number } | null>(null);

    // Where the finger grabbed the button, so it doesn't jump on the
    // first move, plus the start point for the tap-vs-drag decision.
    const grabRef = useRef<{ dx: number; dy: number; startX: number; startY: number } | null>(
        null
    );
    // Set on a pointer sequence that turned into a drag, so the synthetic
    // click that follows doesn't also open Spotlight. Same idea as
    // `useLongPress().consumedTap()`.
    const draggedRef = useRef(false);

    // A rotation, or the keyboard opening, can leave a parked button
    // below the fold. Re-clamp against the live viewport instead of
    // trusting the stored number.
    useEffect(() => {
        if (!isMobile) return undefined;
        const reclamp = () =>
            setPosition((prev) =>
                prev === null
                    ? prev
                    : {
                          ...prev,
                          top: clampFabTop(prev.top, {
                              bottomInset: readBottomInset(),
                              viewportHeight: window.innerHeight,
                          }),
                      }
            );
        reclamp();
        window.addEventListener("resize", reclamp);
        window.addEventListener("orientationchange", reclamp);
        return () => {
            window.removeEventListener("resize", reclamp);
            window.removeEventListener("orientationchange", reclamp);
        };
    }, [isMobile]);

    const handlePointerDown = useCallback((e: React.PointerEvent<HTMLButtonElement>) => {
        // Ignore secondary buttons / multi-touch continuations.
        if (!e.isPrimary) return;
        const rect = e.currentTarget.getBoundingClientRect();
        grabRef.current = {
            dx: e.clientX - rect.left,
            dy: e.clientY - rect.top,
            startX: e.clientX,
            startY: e.clientY,
        };
        draggedRef.current = false;
        // Keeps `pointermove` coming to this element once the finger
        // leaves it, which is most of the drag.
        e.currentTarget.setPointerCapture(e.pointerId);
    }, []);

    const handlePointerMove = useCallback((e: React.PointerEvent<HTMLButtonElement>) => {
        const grab = grabRef.current;
        if (grab === null) return;
        if (!draggedRef.current && isFabTap(e.clientX - grab.startX, e.clientY - grab.startY)) {
            // Still within tap tolerance — don't start moving yet, or a
            // slightly sloppy tap would visibly nudge the button.
            return;
        }
        draggedRef.current = true;
        setDragXY({ x: e.clientX - grab.dx, y: e.clientY - grab.dy });
    }, []);

    const endDrag = useCallback((e: React.PointerEvent<HTMLButtonElement>) => {
        const grab = grabRef.current;
        grabRef.current = null;
        setDragXY(null);
        if (grab === null || !draggedRef.current) return;
        const dropped = resolveFabDrop(
            { x: e.clientX - grab.dx, y: e.clientY - grab.dy },
            {
                bottomInset: readBottomInset(),
                viewportHeight: window.innerHeight,
                viewportWidth: window.innerWidth,
            }
        );
        setPosition(dropped);
        writeStoredFabPosition(dropped);
    }, []);

    const handleClick = useCallback(() => {
        // Swallow the click that follows a drag; the flag clears itself so
        // the next real tap fires. Keyboard activation never sets it, so
        // Enter / Space still work.
        if (draggedRef.current) {
            draggedRef.current = false;
            return;
        }
        onPress();
    }, [onPress]);

    if (!isMobile) return null;
    const isDark = mode === "dark";
    const accent = isDark ? purplePalette.dark.accent : purplePalette.light.accent;
    const accentRgb = isDark ? purplePalette.dark.accentRgb : purplePalette.light.accentRgb;

    // Three anchoring modes, in priority order: following the finger,
    // parked where the user dropped it, or the CSS default.
    const anchorSx = dragXY
        ? { left: dragXY.x, top: dragXY.y, right: "auto", bottom: "auto" }
        : position
          ? {
                top: position.top,
                bottom: "auto",
                ...(position.side === "left"
                    ? { left: FAB_EDGE_GAP, right: "auto" }
                    : { right: FAB_EDGE_GAP, left: "auto" }),
            }
          : {
                // 16px gap above the bottom tab bar. The variable already
                // includes the home-indicator inset, so adding it again here
                // would float the button a whole strip too high.
                bottom: `calc(var(--BottomTabBar-height, 60px) + ${FAB_EDGE_GAP}px)`,
                right: FAB_EDGE_GAP,
            };

    return (
        <IconButton
            aria-label={t.layout.mobile.openGenos}
            size="lg"
            sx={{
                position: "fixed",
                ...anchorSx,
                // Above page content (BottomTabBar is 1200) but below
                // MUI Joy Modal (1300) and the SpotlightOverlay (13100).
                zIndex: 1250,
                width: FAB_SIZE,
                height: FAB_SIZE,
                borderRadius: "50%",
                // The browser must not claim the gesture as a scroll, or
                // `pointermove` stops arriving mid-drag.
                touchAction: "none",
                background: `linear-gradient(135deg, ${accent} 0%, rgba(${accentRgb}, 0.8) 100%)`,
                color: "#fff",
                boxShadow: isDark
                    ? `0 8px 24px rgba(${accentRgb}, 0.333), 0 2px 6px rgba(0,0,0,0.4)`
                    : `0 8px 24px rgba(${accentRgb}, 0.333), 0 2px 6px rgba(0,0,0,0.15)`,
                // No position transition while dragging — the button has to
                // track the finger exactly, not ease toward it. The snap on
                // release keeps the eased motion.
                transition: dragXY
                    ? "none"
                    : "transform 0.15s ease, box-shadow 0.15s ease, top 0.2s ease, left 0.2s ease, right 0.2s ease",
                opacity: dragXY ? 0.85 : 1,
                "&:hover": {
                    background: `linear-gradient(135deg, ${accent} 0%, rgba(${accentRgb}, 0.867) 100%)`,
                    transform: "translateY(-2px)",
                    boxShadow: isDark
                        ? `0 12px 28px rgba(${accentRgb}, 0.4), 0 2px 6px rgba(0,0,0,0.5)`
                        : `0 12px 28px rgba(${accentRgb}, 0.4), 0 2px 6px rgba(0,0,0,0.2)`,
                },
                "&:active": {
                    transform: "translateY(0)",
                },
            }}
            onClick={handleClick}
            onPointerCancel={endDrag}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={endDrag}
        >
            {/* Spotlight's brand icon — the same AI "sparkle" the sidebar's
                Spotlight entry uses, so the two entry points read as one
                feature (this used to be a generic magnifier). */}
            <AutoAwesomeRoundedIcon sx={{ fontSize: 24 }} />
        </IconButton>
    );
};
