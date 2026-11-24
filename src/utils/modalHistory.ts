/**
 * Browser Back / Forward for modal pages (MIP-2376).
 *
 * Settings and the quick-look preview (task, note, to-do, chat, milestone) are modals, not routes,
 * so the address never changed and Back left the page. Each step a modal takes (opening it,
 * following a link inside it, switching a Settings tab) now pushes ONE history entry that
 * keeps the current address, so:
 *   - Back steps to the previous modal page, and from the first one closes the modal;
 *   - Forward goes to the next page again (after a Back, not after a close; a modal whose open
 *     state its parent owns, like Settings, is walked forward but not reopened by Forward);
 *   - closing the modal (✕, Esc, backdrop) pops its entries, so Back does not reopen it.
 * It adds no UI and no new address: only the history stack changes.
 *
 * One stack serves every modal owner. Each entry is `{ owner, value }`; after any Back / Forward
 * every owner is told what is on top for it (`null` = it is closed). The stack is kept after a
 * Back so Forward can restore it; a new push, or a close, cuts off what lay ahead.
 */

type Entry = { owner: string; value: unknown };
type Listener = (value: unknown | null) => void;

/** The `history.state` key that carries how many entries of the stack are active. */
const MARK = "genosModalDepth";

let stack: Entry[] = [];
let depth = 0;
const listeners = new Map<string, Listener>();
let attached = false;

const depthOf = (state: unknown): number => {
    const raw = (state as Record<string, unknown> | null)?.[MARK];
    return typeof raw === "number" && raw >= 0 ? raw : 0;
};

const withDepth = (n: number): Record<string, unknown> => {
    const base = window.history.state;
    const copy = base && typeof base === "object" ? { ...(base as Record<string, unknown>) } : {};
    copy[MARK] = n;
    return copy;
};

const topFor = (owner: string): unknown | null => {
    for (let i = depth - 1; i >= 0; i--) {
        if (stack[i].owner === owner) return stack[i].value;
    }
    return null;
};

let settleCallbacks: Array<() => void> = [];
// Owners that are closing themselves: the pop they asked for is not news to them.
const quietOwners = new Set<string>();

const onPopState = (event: PopStateEvent) => {
    // A marker with no stack behind it (left over from before a reload, or from a modal that was
    // closed) counts only as far as the stack goes: it never opens anything.
    depth = Math.min(depthOf(event.state), stack.length);
    for (const [owner, listener] of Array.from(listeners)) {
        if (!quietOwners.has(owner)) listener(topFor(owner));
    }
    quietOwners.clear();
    const callbacks = settleCallbacks;
    settleCallbacks = [];
    callbacks.forEach((run) => run());
};

const attach = () => {
    if (attached || typeof window === "undefined") return;
    attached = true;
    // After a reload `history.state` still carries a marker whose stack is gone: drop it.
    if (depthOf(window.history.state) > 0) {
        try {
            window.history.replaceState(withDepth(0), "");
        } catch {
            /* a sandbox that forbids replaceState: the marker is harmless */
        }
    }
    window.addEventListener("popstate", onPopState);
};

/** Subscribes an owner; the returned function unsubscribes it. */
export const subscribeModalHistory = (owner: string, listener: Listener): (() => void) => {
    attach();
    listeners.set(owner, listener);
    return () => {
        if (listeners.get(owner) === listener) listeners.delete(owner);
    };
};

/** Records a modal page: one new history entry at the same address. */
export const pushModalPage = (owner: string, value: unknown): void => {
    attach();
    stack = stack.slice(0, depth);
    stack.push({ owner, value });
    depth = stack.length;
    try {
        window.history.pushState(withDepth(depth), "");
    } catch {
        /* no history API: the modal still works, only without Back */
    }
};

/**
 * Removes the owner's entries from the history (the modal is closing) and calls `then` once the
 * browser has finished, so a navigation that follows (Move to page) lands after, not under, the
 * pop. Without entries it calls `then` at once.
 */
export const closeModalPages = (owner: string, then?: () => void): void => {
    let first = -1;
    for (let i = 0; i < depth; i++) {
        if (stack[i].owner === owner) {
            first = i;
            break;
        }
    }
    if (first < 0) {
        then?.();
        return;
    }
    const steps = depth - first;
    // Keep the owner's own listener quiet for this pop: it is closing itself.
    quietOwners.add(owner);
    settleCallbacks.push(() => {
        // What lay ahead belonged to the modal that just closed: it is not restorable.
        stack = stack.slice(0, first);
        then?.();
    });
    window.history.go(-steps);
};

/** The number of active modal entries (for tests). */
export const modalHistoryDepth = (): number => depth;

/** Clears the stack and the listeners (for tests). */
export const resetModalHistoryForTests = (): void => {
    stack = [];
    depth = 0;
    listeners.clear();
    quietOwners.clear();
    settleCallbacks = [];
    if (attached) window.removeEventListener("popstate", onPopState);
    attached = false;
};
