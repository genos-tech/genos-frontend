import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";

import { isMac } from "../../utils/platform";

// Ordered list of services. Index === openingService id, so this also drives
// the ArrowLeft / ArrowRight cycle order. Mirrors the NAV_ITEMS table in
// `components/layout/sidebar.tsx` and the OVERLAY_SERVICES table in
// `components/layout/ServiceSwitcherOverlay.tsx` — keep all three in sync.
const SERVICES_BY_ID: Array<{ id: number; path: string }> = [
    { id: 0, path: "/Home/inbox" },
    { id: 1, path: "/Home/chat" },
    { id: 2, path: "/Home/tasks" },
    { id: 3, path: "/Home/notes" },
];

// Letter shortcut map, derived from SERVICES_BY_ID to keep the two in sync.
const SERVICE_BY_KEY: Record<string, { id: number; path: string }> = {
    i: SERVICES_BY_ID[0],
    c: SERVICES_BY_ID[1],
    t: SERVICES_BY_ID[2],
    n: SERVICES_BY_ID[3],
};

export type GlobalServiceShortcutState = {
    /**
     * Index of the service currently highlighted in the Cmd+Tab–style
     * overlay, or `null` when the overlay is hidden. The actual route does
     * not change until the user releases the modifier keys, mirroring how
     * macOS Cmd+Tab only commits the foreground app on release.
     */
    previewIndex: number | null;
};

/**
 * Registers a global keydown listener that switches the active service via
 * keyboard. The modifier combination is `Ctrl+Cmd` on Mac and `Ctrl+Alt` on
 * Windows/Linux:
 *
 *   - <letter>: I -> Inbox, C -> Chats, T -> Tasks, N -> Notes (instant
 *     switch, no overlay).
 *   - ArrowRight / ArrowLeft while the modifiers are held: opens an
 *     overlay and cycles a preview highlight through the service list,
 *     wrapping around. The actual switch is committed only when the user
 *     releases the modifier keys (Mac Cmd+Tab semantics).
 *   - Escape or window blur while the overlay is open: cancel without
 *     navigating.
 *
 * Both modifier combinations are reliably interceptable from JS (unlike
 * Shift+Cmd+T / Shift+Cmd+N, which are swallowed by Chrome before the page
 * sees them) and do not collide with copy/paste/undo, so the listener stays
 * active even while the user is typing in an editor.
 */
export const useGlobalServiceShortcut = (
    openingService: number,
    setOpeningService: (value: number) => void
): GlobalServiceShortcutState => {
    const navigate = useNavigate();
    const [previewIndex, setPreviewIndex] = useState<number | null>(null);

    // Mirror state into refs so the keyup / blur listeners can read the
    // latest values without forcing the effect to re-run (which would
    // detach and re-attach the listeners on every preview change and risk
    // missing a keyup event mid-gesture).
    const previewIndexRef = useRef<number | null>(previewIndex);
    const openingServiceRef = useRef<number>(openingService);

    useEffect(() => {
        previewIndexRef.current = previewIndex;
    }, [previewIndex]);

    useEffect(() => {
        openingServiceRef.current = openingService;
    }, [openingService]);

    useEffect(() => {
        const mac = isMac();

        const commit = (idx: number) => {
            const target = SERVICES_BY_ID[idx];
            if (!target) return;
            setOpeningService(target.id);
            navigate(target.path);
        };

        const handleKeyDown = (e: KeyboardEvent) => {
            const modifiersOk = mac
                ? e.ctrlKey && e.metaKey && !e.altKey && !e.shiftKey
                : e.ctrlKey && e.altKey && !e.metaKey && !e.shiftKey;

            // Escape closes the overlay without committing, regardless of
            // whether the modifiers are still held.
            if (e.key === "Escape" && previewIndexRef.current !== null) {
                e.preventDefault();
                setPreviewIndex(null);
                return;
            }

            if (!modifiersOk) return;

            // Arrow cycling: open the overlay (if not already open) and
            // advance the preview highlight. Do NOT navigate — the commit
            // happens on modifier keyup.
            if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
                e.preventDefault();
                const len = SERVICES_BY_ID.length;
                const delta = e.key === "ArrowRight" ? 1 : -1;
                setPreviewIndex((prev) => {
                    const base = prev ?? openingServiceRef.current;
                    return (base + delta + len) % len;
                });
                return;
            }

            // Letter shortcut: instant switch, no overlay.
            const target = SERVICE_BY_KEY[e.key.toLowerCase()];
            if (!target) return;

            e.preventDefault();
            setOpeningService(target.id);
            navigate(target.path);
        };

        const handleKeyUp = (e: KeyboardEvent) => {
            if (previewIndexRef.current === null) return;

            // Commit when any of the *required* modifiers is released.
            // Matches Cmd+Tab where releasing the held modifier commits
            // the highlighted app.
            const isReleaseKey = mac
                ? e.key === "Meta" || e.key === "Control"
                : e.key === "Control" || e.key === "Alt";
            if (!isReleaseKey) return;

            const idx = previewIndexRef.current;
            setPreviewIndex(null);
            if (idx !== null) commit(idx);
        };

        const handleBlur = () => {
            if (previewIndexRef.current !== null) setPreviewIndex(null);
        };

        document.addEventListener("keydown", handleKeyDown);
        document.addEventListener("keyup", handleKeyUp);
        window.addEventListener("blur", handleBlur);
        return () => {
            document.removeEventListener("keydown", handleKeyDown);
            document.removeEventListener("keyup", handleKeyUp);
            window.removeEventListener("blur", handleBlur);
        };
    }, [setOpeningService, navigate]);

    return { previewIndex };
};
