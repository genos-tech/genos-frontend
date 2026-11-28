import { RefObject, useEffect, useState } from "react";
import { useMediaQuery } from "@mui/material";

import { useIsMobile } from "../../../../hooks/common/useIsMobile";
import { useLongPress } from "../../../../hooks/common/useLongPress";

// A mouse or trackpad. A phone matches neither half, so the "mouse enter" some
// mobile browsers send on a tap does not open the toolbar there.
const MOUSE_QUERY = "(hover: hover) and (pointer: fine)";

/**
 * When a message bubble's action toolbar is on screen (main chat and thread).
 *
 * With a mouse it follows hover. On a phone there is no hover, and an always-on
 * toolbar is visual noise: a long press (~500ms) opens it, and a tap anywhere
 * outside the bubble closes it.
 */
export const useBubbleToolbar = (bubbleRef: RefObject<HTMLElement | null>) => {
    const isMobile = useIsMobile();
    const hasMouse = useMediaQuery(MOUSE_QUERY);
    const [isHovered, setIsHovered] = useState(false);
    const [mobileToolbarOpen, setMobileToolbarOpen] = useState(false);
    // While the More menu — or a dialog it opened — is on screen, keep the
    // toolbar mounted after the cursor leaves the bubble. Without it the hover
    // state flips false and unmounts the menu (or its dialog) out from under
    // the user. It also keeps the bubble tooltip from overlapping the menu.
    const [isMoreMenuOpen, setIsMoreMenuOpen] = useState(false);
    const longPress = useLongPress(() => setMobileToolbarOpen(true), { threshold: 500 });

    // A narrow window with a mouse has the phone layout but can still hover.
    const hoverShows = isHovered && (!isMobile || hasMouse);
    const showUnderBarOption = hoverShows || (isMobile && mobileToolbarOpen) || isMoreMenuOpen;

    // Without this the long-press toolbar would stay forever (no hover-out on touch).
    useEffect(() => {
        if (!mobileToolbarOpen) return;
        const handler = (e: TouchEvent | MouseEvent) => {
            const target = e.target as Node | null;
            if (!target) return;
            if (bubbleRef.current && bubbleRef.current.contains(target)) return;
            setMobileToolbarOpen(false);
        };
        document.addEventListener("touchstart", handler, { passive: true });
        document.addEventListener("mousedown", handler);
        return () => {
            document.removeEventListener("touchstart", handler);
            document.removeEventListener("mousedown", handler);
        };
    }, [mobileToolbarOpen, bubbleRef]);

    return {
        showUnderBarOption,
        isMoreMenuOpen,
        setIsMoreMenuOpen,
        /** True once for the click that ends a long press: that click must do nothing else. */
        consumedTap: longPress.consumedTap,
        /** Spread onto the bubble's row. */
        rowHandlers: {
            onMouseEnter: () => setIsHovered(true),
            onMouseLeave: () => setIsHovered(false),
            onTouchCancel: longPress.onTouchCancel,
            onTouchEnd: longPress.onTouchEnd,
            onTouchMove: longPress.onTouchMove,
            onTouchStart: longPress.onTouchStart,
        },
    };
};
