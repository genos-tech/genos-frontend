import { useEffect } from "react";
import { useNavigate } from "react-router-dom";

// Ordered list of services. Index === openingService id, so this also drives
// the ArrowLeft / ArrowRight cycle order. Mirrors the NAV_ITEMS table in
// `components/layout/sidebar.tsx`.
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

const isMac = (): boolean => {
    if (typeof navigator === "undefined") return false;
    const platform = (navigator.platform || "").toLowerCase();
    if (platform.includes("mac")) return true;
    return /macintosh|mac os x/i.test(navigator.userAgent || "");
};

/**
 * Registers a global keydown listener that switches the active service via
 * keyboard. The modifier combination is `Ctrl+Cmd` on Mac and `Ctrl+Alt` on
 * Windows/Linux:
 *
 *   - <letter>: I -> Inbox, C -> Chats, T -> Tasks, N -> Notes.
 *   - ArrowRight: cycle forward through the service list (wraps Notes -> Inbox).
 *   - ArrowLeft:  cycle backward through the service list (wraps Inbox -> Notes).
 *
 * Both modifier combinations are reliably interceptable from JS (unlike
 * Shift+Cmd+T / Shift+Cmd+N, which are swallowed by Chrome before the page
 * sees them) and do not collide with copy/paste/undo, so the listener stays
 * active even while the user is typing in an editor.
 */
export const useGlobalServiceShortcut = (
    openingService: number,
    setOpeningService: (value: number) => void
) => {
    const navigate = useNavigate();

    useEffect(() => {
        const mac = isMac();

        const handler = (e: KeyboardEvent) => {
            const modifiersOk = mac
                ? e.ctrlKey && e.metaKey && !e.altKey && !e.shiftKey
                : e.ctrlKey && e.altKey && !e.metaKey && !e.shiftKey;
            if (!modifiersOk) return;

            // Arrow cycling: ArrowRight = next, ArrowLeft = prev. Wrap around
            // since there are only four services and cycling end-to-end is
            // the standard "switch tab" behavior.
            if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
                const len = SERVICES_BY_ID.length;
                const delta = e.key === "ArrowRight" ? 1 : -1;
                // `+ len` keeps the modulo positive when delta is -1.
                const nextIdx = (openingService + delta + len) % len;
                const target = SERVICES_BY_ID[nextIdx];

                e.preventDefault();
                setOpeningService(target.id);
                navigate(target.path);
                return;
            }

            // Letter shortcut.
            const target = SERVICE_BY_KEY[e.key.toLowerCase()];
            if (!target) return;

            e.preventDefault();
            setOpeningService(target.id);
            navigate(target.path);
        };

        document.addEventListener("keydown", handler);
        return () => document.removeEventListener("keydown", handler);
    }, [openingService, setOpeningService, navigate]);
};
