import { ReactNode, useSyncExternalStore } from "react";

import { toast, ToastDismissReason } from "../../components/ui/feedback/toastStore";

/**
 * Delete (or archive) with an Undo window instead of an "Are you sure?" (MIP-1274).
 *
 *     const run = useUndoableAction();
 *     run({
 *         key: `saved-filter:${id}`,
 *         message: "Saved filter deleted",
 *         errorMessage: "Couldn't delete the saved filter",
 *         commit: () => deleteSavedFilter(id),
 *         onRestore: () => putItBack(),
 *     });
 *
 * The item is hidden at once (the caller hides it, with `useUndoHidden` or its
 * own state), a toast offers Undo for ~8 s, and ONLY when that window ends does
 * `commit` send the real call. Undo sends nothing: the delete never happened.
 * That is the point of deferring over "delete now, restore on Undo": the real
 * call also tells other people, purges the search index, writes history and can
 * fire webhooks, and no restore call takes those back.
 *
 * Nothing is meant to be lost silently. A pending action is committed when
 *   - its toast goes away for any reason but Undo (timeout, closed, pushed off
 *     the screen by newer toasts);
 *   - another action starts (one Undo at a time);
 *   - the route changes (`UndoableRouteFlush`);
 *   - the page is hidden or closed (`pagehide`, `beforeunload`), through
 *     `onExit` when given: an axios call or a socket emit does not survive the
 *     page going away, a `fetch` with `keepalive` does. Against a
 *     cross-origin API that fetch needs a CORS preflight and lands after the
 *     page is gone, so an immediate reload can still show the item for a moment.
 * The state lives in this module, not in a component, so a keep-alive page that
 * never unmounts and a component that unmounts mid-window both behave.
 *
 * A commit that fails puts the item back (`onRestore`) and says so (an error
 * toast), because the item was hidden on the promise that the delete worked.
 *
 * Ctrl/Cmd+Z undoes the pending action when focus is not in a text field: the
 * toast sits at the end of the document, so Tab alone is a long way to Undo.
 */

export type UndoableRun = {
    /** The item's identity, e.g. `task-comment:12:3`. A key already pending or
     *  already deleted is ignored (a double click is one delete). */
    key: string;
    /** "<what> deleted". The Undo label is the localized one from the host. */
    message: ReactNode;
    /** Toast text when `commit` fails. */
    errorMessage: ReactNode;
    /** The real delete. Must REJECT when it did not happen. Runs once. */
    commit: () => Promise<unknown>;
    /** Same delete, for a page that is going away: synchronous, fire and forget
     *  (`fetch(..., { keepalive: true })`). Defaults to `commit`. */
    onExit?: () => void;
    /** Undo, or a commit that failed: put the item back. */
    onRestore?: () => void;
    /** After a commit succeeded. */
    onCommitted?: () => void;
    /**
     * After a commit succeeded, let the list show the key again (default: it
     * stays hidden for the session, right for a hard delete). For a soft delete
     * that can be undone from elsewhere (a task given another status): the
     * hiding was only for the wait, and `onCommitted` has already put the
     * committed state where the list reads it, so nothing flickers. Also lets
     * the same item be deleted again after it was restored.
     */
    releaseOnCommit?: boolean;
    /**
     * Do not commit when the route changes (`UndoableRouteFlush`). For a delete
     * that closes its own preview, which moves the URL a moment after the
     * toast opened and would otherwise end the window at once. The toast timer,
     * another action starting and the page going away still commit it.
     */
    keepOnNavigate?: boolean;
    /** ms the toast stays; default is the toast's own 8 s. */
    duration?: number;
};

type State = "pending" | "committing" | "settled";

type Entry = { run: UndoableRun; state: State; toastId: string; exitSent?: boolean };

/** In flight: waiting for Undo, or committing. */
const entries = new Map<string, Entry>();

/** Keys a list must not show: in flight, plus deleted for good this session
 *  (so an item cannot pop back between the commit and the list refreshing). */
let hidden: ReadonlySet<string> = new Set();

const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

const subscribe = (l: () => void) => {
    listeners.add(l);
    return () => {
        listeners.delete(l);
    };
};

const setHidden = (key: string, on: boolean) => {
    if (hidden.has(key) === on) return;
    const next = new Set(hidden);
    if (on) next.add(key);
    else next.delete(key);
    hidden = next;
    emit();
};

const undo = (entry: Entry) => {
    if (entry.state !== "pending") return;
    entry.state = "settled";
    entries.delete(entry.run.key);
    setHidden(entry.run.key, false);
    entry.run.onRestore?.();
};

const commit = async (entry: Entry) => {
    if (entry.state !== "pending") return;
    entry.state = "committing";
    // Closes the toast; its own `onClose` finds the state already moved on.
    toast.dismiss(entry.toastId, "timeout");
    try {
        await entry.run.commit();
        entry.state = "settled";
        entries.delete(entry.run.key);
        // Stays hidden unless the caller asked to release it: it is gone for good.
        // `onCommitted` goes first, so a release finds the committed state in place.
        entry.run.onCommitted?.();
        if (entry.run.releaseOnCommit) setHidden(entry.run.key, false);
    } catch (error) {
        console.error("[undoable] commit failed:", error);
        entry.state = "settled";
        entries.delete(entry.run.key);
        setHidden(entry.run.key, false);
        entry.run.onRestore?.();
        toast.error(entry.run.errorMessage);
    }
};

const commitOnExit = (entry: Entry) => {
    if (entry.state !== "pending") return;
    entry.state = "settled";
    entries.delete(entry.run.key);
    // If the page comes back (bfcache, a cancelled `beforeunload` prompt), an
    // Undo that does nothing must not be left on screen.
    toast.dismiss(entry.toastId, "dismiss");
    try {
        if (entry.run.onExit) entry.run.onExit();
        else void entry.run.commit().catch(() => undefined);
    } catch {
        // The page is going away: nothing left to tell.
    }
};

/**
 * Commit every pending action now. `next`: another action is starting.
 * `navigate`: the route changed. `exit`: the page is going away (the commit
 * must not wait for a promise).
 */
export const flushUndoables = (reason: "next" | "navigate" | "exit" = "navigate"): void => {
    for (const entry of [...entries.values()]) {
        if (reason === "navigate" && entry.run.keepOnNavigate) continue;
        if (reason !== "exit") void commit(entry);
        else if (entry.state === "pending") commitOnExit(entry);
        else sendExitAgain(entry);
    }
};

/**
 * A commit that is already running when the page goes away (the toast just
 * timed out) is an axios call or a socket emit, which the page's death
 * abandons. The same delete again through the keepalive path is harmless
 * (every delete here is idempotent) and is the only one that can finish.
 */
const sendExitAgain = (entry: Entry) => {
    if (entry.state !== "committing" || entry.exitSent || !entry.run.onExit) return;
    entry.exitSent = true;
    try {
        entry.run.onExit();
    } catch {
        // The page is going away: nothing left to tell.
    }
};

const onToastClosed = (entry: Entry, reason: ToastDismissReason) => {
    if (reason === "action") return; // Undo already ran
    void commit(entry);
};

export const runUndoable = (run: UndoableRun): void => {
    if (entries.has(run.key) || hidden.has(run.key)) return;
    // One Undo at a time: a second delete makes the first one final.
    flushUndoables("next");
    const entry: Entry = { run, state: "pending", toastId: "" };
    entries.set(run.key, entry);
    setHidden(run.key, true);
    installListeners();
    entry.toastId = toast.undoable(run.message, () => undo(entry), {
        duration: run.duration,
        onClose: (reason) => onToastClosed(entry, reason),
    });
};

const isEditable = (target: EventTarget | null): boolean => {
    const el = target as HTMLElement | null;
    if (!el || typeof el.tagName !== "string") return false;
    return (
        el.isContentEditable ||
        el.tagName === "INPUT" ||
        el.tagName === "TEXTAREA" ||
        el.tagName === "SELECT"
    );
};

const onKeyDown = (e: KeyboardEvent) => {
    if (e.defaultPrevented || e.shiftKey || e.altKey || e.repeat || e.isComposing) return;
    if (!(e.metaKey || e.ctrlKey) || e.key.toLowerCase() !== "z") return;
    if (isEditable(e.target)) return;
    const pending = [...entries.values()].filter((entry) => entry.state === "pending");
    const latest = pending[pending.length - 1];
    if (!latest) return;
    e.preventDefault();
    toast.dismiss(latest.toastId, "action");
    undo(latest);
};

const onPageHide = () => flushUndoables("exit");

let installed = false;
const installListeners = () => {
    if (installed || typeof window === "undefined") return;
    installed = true;
    // Both: `pagehide` is the reliable one on mobile and after bfcache,
    // `beforeunload` covers desktop. The second finds nothing left to do.
    window.addEventListener("pagehide", onPageHide);
    window.addEventListener("beforeunload", onPageHide);
    window.addEventListener("keydown", onKeyDown);
};

/** The runner. Stable, so it is safe in a dependency list. */
export const useUndoableAction = () => runUndoable;

/**
 * Keys a list should leave out (in flight, or deleted this session). The Set
 * is replaced only when a key is added or removed, so it can sit in a `useMemo`
 * dependency list.
 */
export const useUndoHidden = (): ReadonlySet<string> =>
    useSyncExternalStore(
        subscribe,
        () => hidden,
        () => hidden
    );

/** Test helper: forget everything without committing. */
export const __resetUndoables = () => {
    entries.clear();
    hidden = new Set();
    emit();
};
