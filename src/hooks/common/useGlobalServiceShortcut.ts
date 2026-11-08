import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";

import { switchService } from "../../services/serviceSwitch/serviceSwitchStore";
import { currentPlatform, matchesShortcut, type ShortcutId } from "../../shortcuts";

// Ordered list of services. The array index doubles as the service id,
// which is what `mruOrder` stores. Mirrors the NAV_ITEMS table in
// `components/layout/sidebar.tsx` and the OVERLAY_SERVICES table in
// `components/layout/ServiceSwitcherOverlay.tsx` — keep all three in sync.
// (Genos, id 4, is the one exception to the NAV_ITEMS mirror: the sidebar
// renders it as its own dedicated button above the nav list. To-Do, id 5,
// is the other: it has NO page — a stop on it opens the to-do modal over
// whatever page is current, so its `path` is null.)
export const TODO_SERVICE_ID = 5;
const SERVICES_BY_ID: Array<{ id: number; path: string | null }> = [
    { id: 0, path: "/workspace/inbox" },
    { id: 1, path: "/workspace/chat" },
    { id: 2, path: "/workspace/tasks" },
    { id: 3, path: "/workspace/notes" },
    { id: 4, path: "/workspace/genos" },
    { id: TODO_SERVICE_ID, path: null },
];

// The seven action shortcuts, in the order they are tested, and the option
// callback each one runs. The chords themselves are in `src/shortcuts`.
const LETTER_ACTIONS: ReadonlyArray<[ShortcutId, keyof GlobalServiceShortcutOptions]> = [
    ["global.tasksNew", "onOpenTasksAndCreate"],
    ["global.notesNew", "onOpenNotesAndCreate"],
    ["global.calendar", "onOpenCalendarModal"],
    ["global.meetClipboard", "onQuickMeetClipboard"],
    ["global.history", "onOpenHistory"],
    ["global.taskGraph", "onOpenTaskDiagram"],
    ["global.todo", "onOpenTodo"],
];

// Derive the active service id from the current URL. Returns -1 when the
// URL is not under any known service (e.g. the initial `/workspace` redirect),
// which we treat as "unknown — leave the MRU list alone".
const deriveServiceId = (pathname: string): number => {
    for (const service of SERVICES_BY_ID) {
        if (service.path !== null && pathname.includes(service.path)) return service.id;
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
    /**
     * Moves the highlight to a tile the pointer is over. Ignored while the
     * overlay is hidden, so a stray hover can never raise it.
     */
    highlight: (positionInMru: number) => void;
    /**
     * Commits the tile at `positionInMru` right away (a click on it) and
     * hides the overlay. The later release of the hold key then has nothing
     * left to commit, so a click never switches twice.
     */
    select: (positionInMru: number) => void;
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
    /**
     * Fired on `Ctrl+Cmd+O` (mac) / `Ctrl+Alt+O` (other). Opens the user's
     * ToDo pane (a sub-pane of the self-DM chat). The handler owns
     * resolving the self-DM, navigating to it and revealing the pane; this
     * hook just dispatches the keypress.
     */
    onOpenTodo?: () => void;
    /**
     * True while the to-do modal is open. To-Do is then the *current*
     * service (first in the MRU order), so a single tap of the cycle goes
     * back to the page underneath — which only has to close the modal.
     */
    isTodoOpen?: boolean;
    /** The cycle landed on the To-Do stop: open the modal (no navigation). */
    onShowTodo?: () => void;
    /** The cycle landed on a page service while the modal is open: close it. */
    onHideTodo?: () => void;
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
 *   - To-Do is a stop too, but it has no page: landing on it opens the to-do
 *     modal over the current page (`onShowTodo`), and while that modal is open
 *     it counts as the current service, so landing on the page underneath
 *     just closes it (`onHideTodo`).
 *   - The overlay's tiles can be hovered (`highlight`) and clicked (`select`).
 *
 * Letter shortcuts (action shortcuts, no overlay):
 *   - `Ctrl+Cmd+<letter>` on Mac, `Ctrl+Alt+<letter>` elsewhere.
 *   - `T` -> open Tasks AND start a new task (via `onOpenTasksAndCreate`).
 *   - `N` -> open Notes AND create a new My Note (via `onOpenNotesAndCreate`).
 *   - `C` -> open the compact calendar modal (via `onOpenCalendarModal`).
 *   - `M` -> generate a Meet link and copy to clipboard (via `onQuickMeetClipboard`).
 *   - `H` -> toggle the global History modal (via `onOpenHistory`).
 *   - `G` -> open the task graph for the current preview task (via `onOpenTaskDiagram`).
 *   - `O` -> toggle the to-do modal (via `onOpenTodo`).
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

    // The to-do modal sits on top of the page, so while it is open it is the
    // service the user is "in"; the URL's service is the one underneath.
    const isTodoOpen = options?.isTodoOpen === true;
    const effectiveServiceId = isTodoOpen ? TODO_SERVICE_ID : currentServiceId;

    const [previewIndex, setPreviewIndex] = useState<number | null>(null);
    const [mruOrder, setMruOrder] = useState<number[]>(() =>
        buildInitialMruOrder(effectiveServiceId)
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
        if (effectiveServiceId < 0) return;
        setMruOrder((prev) => {
            if (prev[0] === effectiveServiceId) return prev;
            return [effectiveServiceId, ...prev.filter((id) => id !== effectiveServiceId)];
        });
    }, [effectiveServiceId]);

    // The listener below is attached once; it reads the URL's service through
    // a ref, like the options, so a commit always sees the current page.
    const currentServiceIdRef = useRef(currentServiceId);
    useEffect(() => {
        currentServiceIdRef.current = currentServiceId;
    }, [currentServiceId]);
    // The commit step lives inside the listener effect (it needs `navigate`);
    // a click on a tile reaches it through this ref.
    const commitRef = useRef<(positionInMru: number) => void>(() => {});

    useEffect(() => {
        const platform = currentPlatform();
        const mac = platform === "mac";

        const commit = (positionInMru: number) => {
            const serviceId = mruOrderRef.current[positionInMru];
            const target = SERVICES_BY_ID[serviceId];
            if (!target) return;
            const todoOpen = optionsRef.current?.isTodoOpen === true;
            if (target.path === null) {
                // To-Do: a modal over the current page, no navigation. If it
                // is already open there is nothing to do.
                if (!todoOpen) optionsRef.current?.onShowTodo?.();
                return;
            }
            if (todoOpen) {
                optionsRef.current?.onHideTodo?.();
                // The page underneath is already where the URL is.
                if (serviceId === currentServiceIdRef.current) return;
            }
            // Cmd+Tab-style commit: shows the "Loading data…" page first when
            // the service changes (MIP-965).
            switchService(navigate, target.path);
        };
        commitRef.current = commit;

        const handleKeyDown = (e: KeyboardEvent) => {
            // Escape closes the overlay without committing, regardless of
            // which modifiers are still held.
            if (e.key === "Escape" && previewIndexRef.current !== null) {
                e.preventDefault();
                setPreviewIndex(null);
                return;
            }

            // Letter shortcuts: action shortcuts (no instant nav). The chords
            // live in the shortcut registry; a letter whose callback was not
            // passed falls through, as it always did. If one fires while a
            // cycle preview is in progress, the preview is canceled and the
            // letter target wins.
            for (const [id, option] of LETTER_ACTIONS) {
                const run = optionsRef.current?.[option] as (() => void) | undefined;
                if (!run || !matchesShortcut(id, e, platform)) continue;
                e.preventDefault();
                if (previewIndexRef.current !== null) setPreviewIndex(null);
                run();
                return;
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

    const highlight = useCallback((positionInMru: number) => {
        if (previewIndexRef.current === null) return;
        previewIndexRef.current = positionInMru;
        setPreviewIndex(positionInMru);
    }, []);

    const select = useCallback((positionInMru: number) => {
        // Clear the ref now, not after the re-render: releasing the hold key
        // right behind the click must find nothing to commit.
        previewIndexRef.current = null;
        setPreviewIndex(null);
        commitRef.current(positionInMru);
    }, []);

    return { previewIndex, mruOrder, highlight, select };
};
