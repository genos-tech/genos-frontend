// Classify an href as either a modal-able target, a same-origin route to
// hand off to react-router, or an external URL to open in a new tab.
//
// Used by the URL-link-modal flow to decide what happens when a user
// clicks a link rendered inside a chat message. The parsing logic mirrors
// the in-feature routing hooks (useChatRouting / useTaskRouting /
// useNoteRouting) so the URL shapes stay consistent — only modify these
// patterns when the routing hooks change.

import { isLegacyNumericId, isV3Uuid } from "./legacyId";

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

export type MilestoneTarget = {
    kind: "milestone";
    projectId: number;
    milestoneId: number;
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

export type TodoTarget = {
    kind: "todo";
    // The group's day bucket (YYYY-MM-DD) — part of the URL so the modal
    // can fetch that day's group when it's outside the loaded window.
    localDate: string;
    itemId?: number;
};

export type ModalTarget =
    | ChatMainTarget
    | ChatThreadTarget
    | TaskTarget
    | MilestoneTarget
    | ChatNoteTarget
    | TaskNoteTarget
    | MyNoteTarget
    | SharedNoteTarget
    | TodoTarget;

export type UrlClassification =
    | ModalTarget
    | { kind: "route"; pathname: string; search: string }
    | { kind: "external" };

const toInt = (s: string | undefined): number | undefined => {
    if (!s) return undefined;
    const n = Number(s);
    return Number.isFinite(n) && n > 0 ? n : undefined;
};

// Post the v3 migration, chat & thread ids in URLs are UUIDs, not the
// integers `toInt` expects (e.g. /workspace/chat/dm/<uuid>/thread/<uuid>).
// Accept either a v3 UUID or a legacy *positive* numeric id, preserving
// the raw value verbatim. The string rides in the `number`-typed
// chatId/threadId slots and is read back as a string by ModalChatView —
// the same legacy-slot convention the v3 adapters use throughout — hence
// the `as unknown as number` casts at the call sites below. Returning the
// integer-coerced value (the old behaviour) silently dropped every UUID
// chat link to a route navigation instead of opening the preview modal.
const toV3Id = (s: string | undefined): string | undefined => {
    if (s === undefined) return undefined;
    if (isV3Uuid(s)) return s;
    return isLegacyNumericId(s) && Number(s) > 0 ? s : undefined;
};

// Like `toV3Id` but accepts the `0` sentinel chat-note URLs use for "not
// in a thread" (`/thread/0/` — the note lives on the parent chat, not a
// thread within it). UUIDs and any non-negative legacy numeric pass.
const toV3IdAllowZero = (s: string | undefined): string | undefined => {
    if (s === undefined || s === "") return undefined;
    if (isV3Uuid(s)) return s;
    return isLegacyNumericId(s) ? s : undefined;
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
    //
    // chatId / threadId are v3 UUIDs post-migration (see `toV3Id`); they
    // ride in the `number`-typed slots via the legacy-slot cast below.
    if (parts[1] === "chat") {
        const chatType = CHAT_TYPE_MAP[parts[2] ?? ""];
        const chatId = toV3Id(parts[3]);
        if (!chatType || !chatId) return route;

        const threadId = toV3Id(segmentAfter(parts, "thread"));
        const messageId = toInt(segmentAfter(parts, "message"));
        const commentId = toInt(segmentAfter(parts, "comment"));

        // Deeper wins: if a thread segment is present, the link author
        // meant the thread, not just the parent chat. (`toV3Id` returns
        // undefined for a `0` thread sentinel, so that falls through to
        // the parent chat, preserving the old numeric behaviour.)
        if (threadId) {
            return {
                chatId: chatId as unknown as number,
                chatType,
                commentId,
                kind: "chatThread",
                messageId,
                threadId: threadId as unknown as number,
            };
        }
        return { chatId: chatId as unknown as number, chatType, kind: "chatMain", messageId };
    }

    // /workspace/tasks/project/:projectId/task/:taskId[/comment/:commentId]   (Phase 2)
    // /workspace/tasks/project/:projectId/milestone/:milestoneId
    if (parts[1] === "tasks" && parts[2] === "project") {
        const projectId = toInt(parts[3]);
        const taskId = toInt(segmentAfter(parts, "task"));
        const milestoneId = toInt(segmentAfter(parts, "milestone"));
        const commentId = toInt(segmentAfter(parts, "comment"));
        if (projectId && taskId) {
            return { commentId, kind: "task", projectId, taskId };
        }
        // A project URL carries either a /task/ or a /milestone/ segment,
        // never both, so the order of these two checks is immaterial.
        if (projectId && milestoneId) {
            return { kind: "milestone", milestoneId, projectId };
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
        // chatId / threadId are v3 UUIDs post-migration (`toV3Id*`); they
        // ride in the `number`-typed slots via the legacy-slot cast. Only
        // `noteId` is used to load the note (ModalNoteView fetches by id),
        // so even though these chat/thread ids aren't consumed downstream,
        // they must still parse for the target to classify as a chatNote
        // rather than dropping to a route navigation. `threadId === 0` is a
        // valid sentinel for "not in a thread" (`toV3IdAllowZero` accepts
        // it; `toV3Id` would reject zero).
        if (parts[2] === "chat" && parts[5] === "thread" && parts[7] === "note") {
            const chatType = CHAT_TYPE_MAP[parts[3] ?? ""];
            const chatId = toV3Id(parts[4]);
            const threadId = toV3IdAllowZero(parts[6]);
            const noteId = toInt(parts[8]);
            if (chatType && chatId && threadId !== undefined && noteId) {
                return {
                    chatId: chatId as unknown as number,
                    chatType,
                    kind: "chatNote",
                    noteId,
                    threadId: threadId as unknown as number,
                };
            }
        }
        return route;
    }

    // /workspace/todo/:localDate[/item/:itemId]
    //
    // localDate is the todo group's day bucket (YYYY-MM-DD). Todos are
    // per-user (self-DM pane), so the id alone identifies the item; the
    // date rides along so the modal can fetch that day's group directly.
    if (parts[1] === "todo") {
        const localDate = /^\d{4}-\d{2}-\d{2}$/.test(parts[2] ?? "") ? parts[2] : undefined;
        if (!localDate) return route;
        return { itemId: toInt(segmentAfter(parts, "item")), kind: "todo", localDate };
    }

    return route;
};
