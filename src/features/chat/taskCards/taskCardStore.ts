/**
 * The live fields behind the chat's task and milestone cards (MIP-2484).
 *
 * One module-level store, so what was read survives a chat switch. Requests made in the same
 * moment (a screen of cards mounting) go out as one, and a card is told about its own task
 * only, so a batch answer re-renders the cards that changed and no others.
 *
 * A card is read again when its chat message is rewritten (the server and the app rewrite
 * the message when the task changes, and every viewer receives that), when the app itself
 * saved a task, after a reconnect or a return to the tab, and on mount once it is a minute
 * old. The data held is always one viewer's: another signed-in user empties the store.
 */

import { fetchTaskCards } from "./taskCardApi";
import type { LiveCard } from "./taskCardTypes";

export type TaskCardEntry = {
    /** `gone`: the server left it out (deleted, or this viewer may not open it).
     *  `error`: the request failed and there is nothing to show yet. */
    status: "loading" | "ready" | "gone" | "error";
    data?: LiveCard;
};

type Meta = { fetchedAt: number; stamp: number };

export type TaskCardViewer = { accessToken: string | null; userId: string };

const FRESH_MS = 60_000;
const BATCH_MS = 16;
/** The server's cap on one request. */
export const MAX_CARDS_PER_REQUEST = 50;

const entries = new Map<number, TaskCardEntry>();
const meta = new Map<number, Meta>();
const listeners = new Map<number, Set<() => void>>();
const queue = new Set<number>();
const inFlight = new Set<number>();
/** Asked for again while its request was out: that answer may predate the change. */
const again = new Set<number>();

let viewer: TaskCardViewer = { accessToken: null, userId: "" };
let generation = 0;
let timer: ReturnType<typeof setTimeout> | null = null;

const notify = (id: number) => listeners.get(id)?.forEach((cb) => cb());

const put = (id: number, entry: TaskCardEntry) => {
    entries.set(id, entry);
    notify(id);
};

const load = async (ids: number[], token: string) => {
    const sent = generation;
    let cards: LiveCard[] | null = null;
    try {
        cards = await fetchTaskCards(token, ids);
    } catch (e) {
        console.warn("[taskCards] could not load", e);
    }
    if (sent !== generation) return;
    const byId = new Map((cards ?? []).map((card) => [card.taskId, card]));
    for (const id of ids) {
        inFlight.delete(id);
        const held = entries.get(id);
        if (cards === null) {
            // Keep what is on screen; the next signal or mount tries again.
            meta.set(id, { fetchedAt: 0, stamp: meta.get(id)?.stamp ?? 0 });
            if (!held?.data) put(id, { status: "error" });
        } else {
            const data = byId.get(id);
            meta.set(id, { fetchedAt: Date.now(), stamp: meta.get(id)?.stamp ?? 0 });
            // The same answer again keeps the same entry: no re-render.
            if (!data) put(id, { status: "gone" });
            else if (JSON.stringify(held?.data) !== JSON.stringify(data))
                put(id, { status: "ready", data });
        }
        if (again.delete(id)) request(id);
    }
};

const flush = () => {
    timer = null;
    const token = viewer.accessToken;
    if (!token) return;
    const ids = [...queue];
    queue.clear();
    ids.forEach((id) => inFlight.add(id));
    for (let i = 0; i < ids.length; i += MAX_CARDS_PER_REQUEST) {
        void load(ids.slice(i, i + MAX_CARDS_PER_REQUEST), token);
    }
};

function request(id: number) {
    if (inFlight.has(id)) {
        again.add(id);
        return;
    }
    if (!entries.has(id)) entries.set(id, { status: "loading" });
    queue.add(id);
    if (timer === null) timer = setTimeout(flush, BATCH_MS);
}

const drop = () => {
    generation += 1;
    if (timer !== null) clearTimeout(timer);
    timer = null;
    entries.clear();
    meta.clear();
    queue.clear();
    inFlight.clear();
    again.clear();
};

/** Everything held was read with access that may be gone: drop it, read what is on screen. */
export const resetTaskCards = (): void => {
    drop();
    for (const id of listeners.keys()) {
        request(id);
        notify(id);
    }
};

/** Sign-out: nothing this person read stays for the next one in the same tab. */
export const forgetTaskCards = (): void => {
    drop();
    viewer = { accessToken: null, userId: "" };
};

const setViewer = (next: TaskCardViewer) => {
    const changed = viewer.userId !== "" && viewer.userId !== next.userId;
    viewer = next;
    if (changed) resetTaskCards();
    // Asked for while there was no token: send it now.
    if (next.accessToken && queue.size > 0 && timer === null) timer = setTimeout(flush, BATCH_MS);
};

/**
 * Have the card of `taskId` read, unless what is held is fresh. `messageStamp` is the chat
 * message's `tsUpdated`: a later one than last seen means the message was rewritten.
 */
export const ensureTaskCard = (taskId: number, messageStamp: string, who: TaskCardViewer) => {
    setViewer(who);
    const stamp = Date.parse(messageStamp) || 0;
    const seen = meta.get(taskId);
    // No stamp yet (read ahead): nothing to compare with, so nothing was rewritten.
    const rewritten = seen !== undefined && seen.stamp > 0 && stamp > seen.stamp;
    meta.set(taskId, {
        fetchedAt: seen?.fetchedAt ?? 0,
        stamp: Math.max(stamp, seen?.stamp ?? 0),
    });
    const pending = queue.has(taskId) || inFlight.has(taskId);
    if (rewritten) request(taskId);
    else if (!pending && Date.now() - (seen?.fetchedAt ?? 0) >= FRESH_MS) request(taskId);
};

/** Read ahead the cards a chat is about to show, so most of them paint complete. */
export const prefetchTaskCards = (taskIds: number[], who: TaskCardViewer): void => {
    setViewer(who);
    for (const id of taskIds) {
        if (!entries.has(id)) request(id);
    }
};

/** Something about these cards may have changed. Those on screen are read again now, the
 *  rest on their next mount. Without `ids`, all of them. */
export const invalidateTaskCards = (ids?: number[]): void => {
    for (const id of ids ?? [...entries.keys()]) {
        if (!entries.has(id)) continue;
        meta.set(id, { fetchedAt: 0, stamp: meta.get(id)?.stamp ?? 0 });
        if (listeners.has(id)) request(id);
    }
};

/** A milestone's progress moves with its tasks, which do not name it. */
export const invalidateMilestoneCards = (): void => {
    const ids = [...entries].filter(([, e]) => e.data?.kind === "milestone").map(([id]) => id);
    if (ids.length > 0) invalidateTaskCards(ids);
};

export const subscribeTaskCard = (taskId: number, cb: () => void): (() => void) => {
    const set = listeners.get(taskId) ?? new Set();
    set.add(cb);
    listeners.set(taskId, set);
    return () => {
        set.delete(cb);
        if (set.size === 0 && listeners.get(taskId) === set) listeners.delete(taskId);
    };
};

export const getTaskCard = (taskId: number): TaskCardEntry | undefined => entries.get(taskId);
