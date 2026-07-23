import { ThreadProps } from "../../../types/chat";

/**
 * Per-chat memory of "which thread was open in this chat".
 *
 * The chat pane and the thread pane are two halves of one view: a thread
 * belongs to exactly one channel, so it must never be on screen next to a
 * different channel, and re-entering a channel should restore the thread
 * the user left open there. Neither followed from the previous design,
 * where `isThreadVisible` / `currentThreadChat` were global and nothing
 * reconciled them against the open chat.
 *
 * Persisted (rather than kept in React state) so the pairing survives a
 * reload — chat has no URL representation for "and its thread was open",
 * only for "this exact thread is the target".
 *
 * Absence of an entry means "closed on purpose": the thread pane's own
 * close / back buttons call `forgetThread`, which is what makes
 * "reopen unless the user closed it manually" work. Merely switching
 * away from a chat leaves the entry intact.
 */

const STORAGE_KEY = "chatThreadMemory";

type ThreadMemory = Record<string, number | string>;

// `chatId` is a v3 UUID string post-flip, but legacy numeric ids still
// reach here from unmigrated callers — stringify both parts so the key is
// stable either way.
const memoryKey = (chatType: number, chatId: number | string): string =>
    `${chatType}:${String(chatId)}`;

const readAll = (): ThreadMemory => {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return {};
        const parsed: unknown = JSON.parse(raw);
        // Guard against a hand-edited / corrupted value: a non-object here
        // would make every read below throw.
        if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) return {};
        return parsed as ThreadMemory;
    } catch {
        return {};
    }
};

const writeAll = (memory: ThreadMemory): void => {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(memory));
    } catch {
        // Quota / private-mode failures are not worth breaking navigation
        // over — the pairing just doesn't survive this session.
    }
};

/**
 * The thread identifier as it appears in the URL.
 *
 * PM threads are addressed by their numeric `taskId`; DM/GM/MDM threads
 * by the thread-root UUID. Storing the wrong one produces a `/thread/…`
 * path that `resolveV3ThreadRootUuid` can't resolve, so the reopen fails
 * silently. `useChatRouting`'s thread-URL effect uses this same helper,
 * so the two can't drift apart.
 */
export const threadUrlToken = (thread: ThreadProps): number | string | undefined =>
    thread.chatType === 3 && thread.taskId ? thread.taskId : thread.threadId;

export const rememberThread = (
    chatType: number,
    chatId: number | string,
    threadToken: number | string
): void => {
    const memory = readAll();
    memory[memoryKey(chatType, chatId)] = threadToken;
    writeAll(memory);
};

export const recallThread = (
    chatType: number,
    chatId: number | string
): number | string | undefined => readAll()[memoryKey(chatType, chatId)];

/**
 * What the URL should describe for the chat that is now open.
 *
 *   "keep-url"        the URL already targets something specific INSIDE
 *                     this chat (a thread / message / comment deep
 *                     link) — it outranks the remembered thread.
 *   "restore-thread"  reopen the thread this chat last had open.
 *   "chat-only"       plain chat view, no thread.
 *
 * The `urlPointsHere` distinction is the whole trick. After switching
 * away from a chat that had a thread open, the URL is left describing
 * the chat we LEFT (`/chat/dm/a/thread/X`), because the main-chat URL
 * effect deliberately bails while a thread is visible and never re-runs
 * once the thread closes. That leftover looks identical to a deep link,
 * so an "is there a /thread/ segment?" test alone reads as "the user
 * asked for this thread" and suppresses the restore forever after.
 *
 * A segment belonging to a DIFFERENT chat than the open one is by
 * definition stale, never a deep link — so only a segment for THIS chat
 * is allowed to win.
 */
export type ThreadRestoreDecision = "keep-url" | "restore-thread" | "chat-only";

export const resolveThreadRestore = ({
    urlChatKey,
    urlHasExplicitTarget,
    mainChatKey,
    remembered,
}: {
    /** `"<chatType>:<chatId>"` parsed from the live URL, if it has one. */
    urlChatKey: string | undefined;
    /** Does the URL carry a thread / message / comment segment? */
    urlHasExplicitTarget: boolean;
    /** `"<chatType>:<chatId>"` of the chat that is now open. */
    mainChatKey: string;
    remembered: number | string | undefined;
}): ThreadRestoreDecision => {
    if (urlChatKey === mainChatKey && urlHasExplicitTarget) return "keep-url";
    if (remembered !== undefined) return "restore-thread";
    return "chat-only";
};

/** `"<chatType>:<chatId>"` — the shared key shape for the helpers above. */
export const chatKey = (chatType: number, chatId: number | string): string =>
    memoryKey(chatType, chatId);

export const forgetThread = (chatType: number, chatId: number | string): void => {
    const memory = readAll();
    const key = memoryKey(chatType, chatId);
    if (!(key in memory)) return;
    delete memory[key];
    writeAll(memory);
};
