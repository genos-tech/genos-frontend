// Classify an href as either a modal-able target, a same-origin route to
// hand off to react-router, or an external URL to open in a new tab.
//
// Used by the URL-link-modal flow to decide what happens when a user
// clicks a link rendered inside a chat message. The parsing logic mirrors
// the in-feature routing hooks (useChatRouting / useTaskRouting /
// useNoteRouting) so the URL shapes stay consistent — only modify these
// patterns when the routing hooks change.

type ChatType = 1 | 2 | 3 | 4;

const CHAT_TYPE_MAP: Record<string, ChatType> = {
    dm: 1,
    gm: 2,
    mdm: 4,
    pm: 3,
};

export type ChatMainTarget = {
    kind: "chatMain";
    chatType: ChatType;
    chatId: number;
    messageId?: number;
};

export type ChatThreadTarget = {
    kind: "chatThread";
    chatType: ChatType;
    chatId: number;
    threadId: number;
    messageId?: number;
    commentId?: number;
};

export type TaskTarget = {
    kind: "task";
    projectId: number;
    taskId: number;
    commentId?: number;
};

export type ChatNoteTarget = {
    kind: "chatNote";
    chatType: ChatType;
    chatId: number;
    threadId: number;
    noteId: number;
};

export type TaskNoteTarget = {
    kind: "taskNote";
    projectId: number;
    taskId: number;
    noteId: number;
};

export type MyNoteTarget = {
    kind: "myNote";
    noteId: number;
};

export type SharedNoteTarget = {
    kind: "sharedNote";
    noteId: number;
};

export type ModalTarget =
    | ChatMainTarget
    | ChatThreadTarget
    | TaskTarget
    | ChatNoteTarget
    | TaskNoteTarget
    | MyNoteTarget
    | SharedNoteTarget;

export type UrlClassification =
    | ModalTarget
    | { kind: "route"; pathname: string; search: string }
    | { kind: "external" };

const toInt = (s: string | undefined): number | undefined => {
    if (!s) return undefined;
    const n = Number(s);
    return Number.isFinite(n) && n > 0 ? n : undefined;
};

// Like `toInt` but accepts 0. Chat-note URLs use `/thread/0/` as a
// sentinel for "not in a thread" (the note lives on the parent chat,
// not on a thread within it), so we can't reject zero outright.
const toIntAllowZero = (s: string | undefined): number | undefined => {
    if (s === undefined || s === null || s === "") return undefined;
    const n = Number(s);
    return Number.isFinite(n) && n >= 0 ? n : undefined;
};

const segmentAfter = (parts: string[], key: string): string | undefined => {
    const i = parts.indexOf(key);
    return i !== -1 ? parts[i + 1] : undefined;
};

export const parseInternalUrl = (href: string): UrlClassification => {
    let url: URL;
    try {
        url = new URL(href, window.location.href);
    } catch {
        return { kind: "external" };
    }

    if (url.origin !== window.location.origin) {
        return { kind: "external" };
    }

    const parts = url.pathname.split("/").filter(Boolean);
    const route: UrlClassification = {
        kind: "route",
        pathname: url.pathname,
        search: url.search,
    };

    // Only /workspace/* paths can become modal targets. Anything else
    // (e.g. /home, /signin) routes through react-router as-is.
    if (parts[0] !== "workspace") return route;

    // /workspace/chat/{dm|gm|pm|mdm}/:chatId[/thread/:threadId][/message/:id | /comment/:id]
    if (parts[1] === "chat") {
        const chatType = CHAT_TYPE_MAP[parts[2] ?? ""];
        const chatId = toInt(parts[3]);
        if (!chatType || !chatId) return route;

        const threadId = toInt(segmentAfter(parts, "thread"));
        const messageId = toInt(segmentAfter(parts, "message"));
        const commentId = toInt(segmentAfter(parts, "comment"));

        // Deeper wins: if a thread segment is present, the link author
        // meant the thread, not just the parent chat.
        if (threadId) {
            return {
                chatId,
                chatType,
                commentId,
                kind: "chatThread",
                messageId,
                threadId,
            };
        }
        return { chatId, chatType, kind: "chatMain", messageId };
    }

    // /workspace/tasks/project/:projectId/task/:taskId[/comment/:commentId]   (Phase 2)
    if (parts[1] === "tasks" && parts[2] === "project") {
        const projectId = toInt(parts[3]);
        const taskId = toInt(segmentAfter(parts, "task"));
        const commentId = toInt(segmentAfter(parts, "comment"));
        if (projectId && taskId) {
            return { commentId, kind: "task", projectId, taskId };
        }
        return route;
    }

    // /workspace/notes/...
    //
    // Notes URLs use positional indexing rather than `segmentAfter`
    // because the path repeats the literal "task" segment
    // (`/notes/task/project/N/task/M/note/K`), and `parts.indexOf("task")`
    // returns the FIRST occurrence — which is the `notes/task/...` segment,
    // not the `task/M` one we want for `taskId`. Positional fixed-shape
    // lookups are unambiguous and match the URL spec one-to-one.
    if (parts[1] === "notes") {
        if (parts[2] === "my") {
            const noteId = toInt(parts[3]);
            if (noteId) return { kind: "myNote", noteId };
        }
        if (parts[2] === "shared") {
            const noteId = toInt(parts[3]);
            if (noteId) return { kind: "sharedNote", noteId };
        }
        // /workspace/notes/task/project/:projectId/task/:taskId/note/:noteId
        if (
            parts[2] === "task" &&
            parts[3] === "project" &&
            parts[5] === "task" &&
            parts[7] === "note"
        ) {
            const projectId = toInt(parts[4]);
            const taskId = toInt(parts[6]);
            const noteId = toInt(parts[8]);
            if (projectId && taskId && noteId) {
                return { kind: "taskNote", noteId, projectId, taskId };
            }
        }
        // /workspace/notes/chat/{dm|gm|pm|mdm}/:chatId/thread/:threadId/note/:noteId
        //
        // `threadId === 0` is a valid sentinel for "not in a thread" —
        // chat notes can live directly on a chat without a thread.
        // `toIntAllowZero` accepts that; `toInt` would have rejected it
        // and dropped the target back to a route navigation.
        if (parts[2] === "chat" && parts[5] === "thread" && parts[7] === "note") {
            const chatType = CHAT_TYPE_MAP[parts[3] ?? ""];
            const chatId = toInt(parts[4]);
            const threadId = toIntAllowZero(parts[6]);
            const noteId = toInt(parts[8]);
            if (chatType && chatId && threadId !== undefined && noteId) {
                return { chatId, chatType, kind: "chatNote", noteId, threadId };
            }
        }
        return route;
    }

    return route;
};
