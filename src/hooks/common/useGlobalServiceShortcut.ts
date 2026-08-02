import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";

import { isMac } from "../../utils/platform";

// Ordered list of services. The array index doubles as the service id,
// which is what `mruOrder` stores. Mirrors the NAV_ITEMS table in
// `components/layout/sidebar.tsx` and the OVERLAY_SERVICES table in
// `components/layout/ServiceSwitcherOverlay.tsx` — keep all three in sync.
// (Genos, id 4, is the one exception to the NAV_ITEMS mirror: the sidebar
// renders it as its own dedicated button above the nav list.)
const SERVICES_BY_ID: Array<{ id: number; path: string }> = [
    { id: 0, path: "/workspace/inbox" },
    { id: 1, path: "/workspace/chat" },
    { id: 2, path: "/workspace/tasks" },
    { id: 3, path: "/workspace/notes" },
    { id: 4, path: "/workspace/genos" },
];

// Derive the active service id from the current URL. Returns -1 when the
// URL is not under any known service (e.g. the initial `/workspace` redirect),
// which we treat as "unknown — leave the MRU list alone".
const deriveServiceId = (pathname: string): number => {
    for (const service of SERVICES_BY_ID) {
        if (pathname.includes(service.path)) return service.id;
    }
    return -1;
};

// Build the initial MRU (most-recently-used) order: the current service is
// at position 0; the rest fall back to the static SERVICES_BY_ID order. If
// the current service is unknown (-1) we just use the static order.
const buildInitialMruOrder = (currentServiceId: number): number[] => {
    const ids = SERVICES_BY_ID.map((s) => s.id);
    if (currentServiceId < 0) return ids;
    return [currentServiceId, ...ids.filter((id) => id !== currentServiceId)];
};

export type GlobalServiceShortcutState = {
    /**
     * Position (within `mruOrder`) of the service currently highlighted in
     * the Cmd+Tab–style overlay, or `null` when the overlay is hidden. The
     * actual route does not change until the user releases the hold
     * modifier, mirroring how macOS Cmd+Tab only commits the foreground
     * app on release.
     */
    previewIndex: number | null;
    /**
     * Service ids in most-recently-used order: `mruOrder[0]` is the
     * currently active service, `mruOrder[1]` is the previously active
     * one, etc. Stable for the duration of a cycle gesture (so the
     * overlay does not visually reorder while the user is mid-tap), and
     * promoted whenever the active service (derived from the URL) changes
     * outside a gesture.
     */
    mruOrder: number[];
};

export type GlobalServiceShortcutOptions = {
    /**
     * Fired on `Ctrl+Cmd+T` (mac) / `Ctrl+Alt+T` (other). The callback owns
     * both the navigation to `/workspace/tasks` and the side effect of opening
     * the create-task panel — the hook just intercepts the keypress.
     */
    onOpenTasksAndCreate?: () => void;
    /**
     * Fired on `Ctrl+Cmd+N` (mac) / `Ctrl+Alt+N` (other). The callback owns
     * both the navigation to `/workspace/notes` and the side effect of creating
     * a new top-level My Note.
     */
    onOpenNotesAndCreate?: () => void;
    /**
     * Fired on `Ctrl+Cmd+C` (mac) / `Ctrl+Alt+C` (other). Toggles the global
     * compact calendar modal. The callback resolves to the
     * `CalendarModalContext` opener — no navigation, just a modal
     * over the current route.
     */
    onOpenCalendarModal?: () => void;
    /**
     * Fired on `Ctrl+Cmd+M` (mac) / `Ctrl+Alt+M` (other). Generates a fresh
     * Google Meet link and copies it to the clipboard — no chat post,
     * no surviving calendar event. The handler owns the create →
     * extract-link → delete-event flow; this hook just dispatches.
     */
    onQuickMeetClipboard?: () => void;
    /**
     * Fired on `Ctrl+Cmd+H` (mac) / `Ctrl+Alt+H` (other). Toggles the
     * global History modal — a per-team activity log of chats / tasks /
     * notes the user has opened.
     */
    onOpenHistory?: () => void;
    /**
     * Fired on `Ctrl+Cmd+G` (mac) / `Ctrl+Alt+G` (other). Opens the task
     * graph (React Flow diagram) for the currently previewed task. The
     * handler owns the "no preview task → do nothing" gate; this hook
     * just dispatches the keypress.
     */
    onOpenTaskDiagram?: () => void;
};

/**
 * Registers a global keyboard listener that switches the active service.
 * The active service is read directly from the URL via `useLocation`, and
 * navigation is performed via `useNavigate` — there is no external
 * "openingService" state to keep in sync.
 *
 * Cycle gesture (Cmd+Tab analog, walks the services in MRU order):
 *   - Mac:   hold `Cmd`, tap `Ctrl` to advance the highlight one step.
 *            Release `Cmd` to commit the highlighted service.
 *   - Other: hold `Alt`, tap `Ctrl` to advance. Release `Alt` to commit.
 *   - Holding `Shift` while tapping `Ctrl` cycles backward (mirrors
 *     `Shift+Tab` in macOS Cmd+Tab).
 *   - The first tap jumps to position 1 (the *previously* active service)
 *     so a single tap toggles between the two most-recent services, as in
 *     macOS Cmd+Tab.
 *   - `Escape` or `window.blur` cancels without navigating.
 *
 * Letter shortcuts (action shortcuts, no overlay):
 *   - `Ctrl+Cmd+<letter>` on Mac, `Ctrl+Alt+<letter>` elsewhere.
 *   - `T` -> open Tasks AND start a new task (via `onOpenTasksAndCreate`).
 *   - `N` -> open Notes AND create a new My Note (via `onOpenNotesAndCreate`).
 *   - `C` -> open the compact calendar modal (via `onOpenCalendarModal`).
 *   - `M` -> generate a Meet link and copy to clipboard (via `onQuickMeetClipboard`).
 *   - `H` -> toggle the global History modal (via `onOpenHistory`).
 *   - `G` -> open the task graph for the current preview task (via `onOpenTaskDiagram`).
 *   - If a letter shortcut fires while a cycle preview is in progress, the
 *     preview is canceled and the letter target wins.
 *   - Each letter is wired through a callback so this hook stays free of
 *     route / state dependencies on Tasks and Notes.
 */
export const useGlobalServiceShortcut = (
    options?: GlobalServiceShortcutOptions
): GlobalServiceShortcutState => {
    const navigate = useNavigate();
    const location = useLocation();
    const currentServiceId = useMemo(
        () => deriveServiceId(location.pathname),
        [location.pathname]
    );

    const [previewIndex, setPreviewIndex] = useState<number | null>(null);
    const [mruOrder, setMruOrder] = useState<number[]>(() =>
        buildInitialMruOrder(currentServiceId)
    );

    // Mirror state into refs so the keydown / keyup / blur listeners can
    // read the latest values without forcing the effect to re-run (which
    // would detach and re-attach the listeners on every state change and
    // risk missing a keyup event mid-gesture).
    const previewIndexRef = useRef<number | null>(previewIndex);
    const mruOrderRef = useRef<number[]>(mruOrder);
    // Callbacks come from App.tsx as inline arrow functions, so their
    // identity changes every render. Stash them in a ref so the
    // listener always sees the latest closure without re-attaching.
    const optionsRef = useRef<GlobalServiceShortcutOptions | undefined>(options);

    useEffect(() => {
        previewIndexRef.current = previewIndex;
    }, [previewIndex]);

    useEffect(() => {
        mruOrderRef.current = mruOrder;
    }, [mruOrder]);

    useEffect(() => {
        optionsRef.current = options;
    }, [options]);

    // Promote the active service to the front of the MRU list whenever the
    // URL crosses into a different service — whether triggered by the
    // cycle, a letter shortcut, the sidebar, or any other navigation.
    // Skipped while a cycle preview is in progress so the overlay does not
    // visually reorder mid-tap, and skipped for unknown services (-1).
    useEffect(() => {
        if (previewIndexRef.current !== null) return;
        if (currentServiceId < 0) return;
        setMruOrder((prev) => {
            if (prev[0] === currentServiceId) return prev;
            return [currentServiceId, ...prev.filter((id) => id !== currentServiceId)];
        });
    }, [currentServiceId]);

    useEffect(() => {
        const mac = isMac();

        const commit = (positionInMru: number) => {
            const serviceId = mruOrderRef.current[positionInMru];
            const target = SERVICES_BY_ID[serviceId];
            if (!target) return;
            navigate(target.path);
        };

        const handleKeyDown = (e: KeyboardEvent) => {
            // Escape closes the overlay without committing, regardless of
            // which modifiers are still held.
            if (e.key === "Escape" && previewIndexRef.current !== null) {
                e.preventDefault();
                setPreviewIndex(null);
                return;
            }

            // Letter shortcuts: action shortcuts (no instant nav).
            // Allow Shift either way so an in-progress backward-cycle
            // (Shift held) still surrenders to a letter press.
            const lettersModifiersOk = mac
                ? e.ctrlKey && e.metaKey && !e.altKey
                : e.ctrlKey && e.altKey && !e.metaKey;
            if (lettersModifiersOk) {
                const key = e.key.toLowerCase();
                if (key === "t" && optionsRef.current?.onOpenTasksAndCreate) {
                    e.preventDefault();
                    if (previewIndexRef.current !== null) setPreviewIndex(null);
                    optionsRef.current.onOpenTasksAndCreate();
                    return;
                }
                if (key === "n" && optionsRef.current?.onOpenNotesAndCreate) {
                    e.preventDefault();
                    if (previewIndexRef.current !== null) setPreviewIndex(null);
                    optionsRef.current.onOpenNotesAndCreate();
                    return;
                }
                if (key === "c" && optionsRef.current?.onOpenCalendarModal) {
                    e.preventDefault();
                    if (previewIndexRef.current !== null) setPreviewIndex(null);
                    optionsRef.current.onOpenCalendarModal();
                    return;
                }
                if (key === "m" && optionsRef.current?.onQuickMeetClipboard) {
                    e.preventDefault();
                    if (previewIndexRef.current !== null) setPreviewIndex(null);
                    optionsRef.current.onQuickMeetClipboard();
                    return;
                }
                if (key === "h" && optionsRef.current?.onOpenHistory) {
                    e.preventDefault();
                    if (previewIndexRef.current !== null) setPreviewIndex(null);
                    optionsRef.current.onOpenHistory();
                    return;
                }
                if (key === "g" && optionsRef.current?.onOpenTaskDiagram) {
                    e.preventDefault();
                    if (previewIndexRef.current !== null) setPreviewIndex(null);
                    optionsRef.current.onOpenTaskDiagram();
                    return;
                }
            }

            // Cycle gesture: hold-key (Cmd/mac, Alt/other) is held AND the
            // event itself is the Ctrl tap. Each Ctrl keydown advances the
            // preview. Shift inverts the direction.
            const holdHeld = mac ? e.metaKey : e.altKey;
            const isCycleTap = e.key === "Control";
            // Disallow the "wrong" modifier (e.g. Alt held on mac) so we
            // never collide with system shortcuts.
            const wrongModifierHeld = mac ? e.altKey : e.metaKey;
            if (holdHeld && isCycleTap && !wrongModifierHeld) {
                e.preventDefault();
                const len = mruOrderRef.current.length;
                if (len === 0) return;
                const delta = e.shiftKey ? -1 : 1;
                setPreviewIndex((prev) => {
                    // First tap: jump straight to position 1 (the
                    // previously active service) on forward cycles or
                    // position len-1 on backward cycles, matching Cmd+Tab.
                    if (prev === null) {
                        return delta === 1 ? 1 % len : (len - 1) % len;
                    }
                    return (prev + delta + len) % len;
                });
                return;
            }
        };

        const handleKeyUp = (e: KeyboardEvent) => {
            if (previewIndexRef.current === null) return;

            // Commit only when the *hold* key is released. Releasing Ctrl
            // (the cycle key) just ends a tap and must NOT commit, or the
            // user could never advance more than once.
            const isHoldRelease = mac ? e.key === "Meta" : e.key === "Alt";
            if (!isHoldRelease) return;

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
    }, [navigate]);

    return { previewIndex, mruOrder };
};
