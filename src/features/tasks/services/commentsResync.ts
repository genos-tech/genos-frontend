import { emitCommentsResync } from "./taskEvents";

/**
 * When to ask for the open task's comments again (MIP-1349).
 *
 * A comment is announced once, over the socket, to whoever is connected at that
 * moment. One announced while the connection was down, or while this device
 * slept, is never replayed, so the open task kept missing it until it was
 * reopened. Two moments mean "we may have missed something":
 *
 *   * the socket connects AGAIN (it dropped and came back), and
 *   * the tab becomes visible after being hidden for a while.
 *
 * Both emit one `genos:comments-resync`; whichever comment views are mounted
 * refetch for the task they show (see `onCommentsResync`).
 */

/** Hidden at least this long before coming back counts as a wake. Shorter is a
 *  tab switch, which misses nothing worth a request. */
export const WAKE_AFTER_HIDDEN_MS = 30_000;

const connectedBefore = new WeakSet<object>();

/**
 * Record that `socket` is connected. True when it had already been connected
 * before, i.e. this connect is a reconnect. A socket's very first connect is not
 * one: the views load their comments themselves when they open.
 */
export const noteSocketConnected = (socket: object): boolean => {
    const reconnect = connectedBefore.has(socket);
    connectedBefore.add(socket);
    return reconnect;
};

/**
 * Emit a resync when the tab comes back after `WAKE_AFTER_HIDDEN_MS` hidden.
 * Returns the function that removes the listener.
 */
export const installCommentsWakeResync = (
    doc: Pick<Document, "addEventListener" | "removeEventListener" | "hidden"> = document,
    now: () => number = Date.now
): (() => void) => {
    let hiddenAt: number | null = doc.hidden ? now() : null;
    const onChange = () => {
        if (doc.hidden) {
            // Keep the FIRST hide: repeated hidden events must not shorten it.
            if (hiddenAt === null) hiddenAt = now();
            return;
        }
        const away = hiddenAt === null ? 0 : now() - hiddenAt;
        hiddenAt = null;
        if (away >= WAKE_AFTER_HIDDEN_MS) emitCommentsResync();
    };
    doc.addEventListener("visibilitychange", onChange);
    return () => doc.removeEventListener("visibilitychange", onChange);
};
