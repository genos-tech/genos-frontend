/*
 * PUNCH LIST (v3 chatId migration):
 * `HistoryEntry.chatId` is still typed `number` in `useHistory.tsx`
 * (the localStorage persistence layer + the `isHistoryEntry` runtime
 * narrowing check assume integer ids). `ChatProps.chatId` is now
 * `string` post-flip, so the boundary needs a cast — written as
 * `as unknown as number` with this note. Runtime gap: v3-shaped UUID
 * chatIds get persisted as string-disguised-as-number; the runtime
 * narrowing check (`typeof o.chatId === "number"`) silently drops
 * them on reload. Fix properly by flipping `HistoryEntry.chatId` to
 * `string` and updating the consumers in `useHistory.tsx`,
 * `HistoryShell.tsx`, and `HistoryModal.tsx` — follow-on session.
 */
import { useEffect, useRef } from "react";

import { loadV3SpecificMessages } from "../../features/chat/services/loadV3SpecificMessages";
import { loadV3SpecificThreadMessages } from "../../features/chat/services/loadV3SpecificThreadMessages";
import { noteTypeFromBucket } from "../../features/notes/common/utils/noteTypeAlias";
import { isV3Uuid } from "../../utils/legacyId";
import { ChatManagementState } from "../chats/useChatManagement";
import { NoteManagementState } from "../notes/useNoteManagement";
import { SprintMilestoneManagementState } from "../tasks/useSprintMilestoneManagement";
import { TaskManagementState } from "../tasks/useTaskManagement";
import { HistoryEntry, useHistory } from "./useHistory";
import { ProjectManagementState } from "./useProjectManagement";

// Effect-based observer mounted at App level. Watches the canonical
// "currently open" state on each management hook and records a
// HistoryEntry whenever it transitions to a new entity. Dedup is
// handled inside `useHistory.record` (move-to-top + per-kind cap), so
// this hook just needs to fire on every distinct open.

type Props = {
    useCM: ChatManagementState;
    useTM: TaskManagementState;
    useSM: SprintMilestoneManagementState;
    useNM: NoteManagementState;
    usePM: ProjectManagementState;
};

// Pull a short, single-line preview out of a message's plain text.
// Strips control chars, collapses whitespace, takes the first 80 chars.
const firstLine = (text: string | null | undefined): string | null => {
    if (!text) return null;
    const cleaned = text
        .replace(/[\r\n]+/g, " ")
        .replace(/\s+/g, " ")
        .trim();
    if (!cleaned) return null;
    return cleaned.length > 80 ? cleaned.slice(0, 77) + "…" : cleaned;
};

// Walk a BlockNote-style `content` tree and concatenate any leaf `text`
// nodes. Used as a fallback when `contentText` is empty on a message
// (older bubbles persisted before that field was populated still carry
// the rich content under `content`). Also surfaces mention and
// mention-group chips as `@name` tokens so a message that's *only* a
// chip ("@team") still produces a useful preview.
const textFromBlocks = (content: unknown): string => {
    if (!content) return "";
    const parts: string[] = [];
    const walk = (node: unknown) => {
        if (!node) return;
        if (Array.isArray(node)) {
            for (const item of node) walk(item);
            return;
        }
        if (typeof node === "object") {
            const obj = node as Record<string, unknown>;
            const nodeType = obj.type;
            if (nodeType === "mention") {
                const user = (obj.props as Record<string, unknown> | undefined)?.userName;
                if (typeof user === "string" && user) {
                    parts.push(`@${user}`);
                }
            } else if (nodeType === "mentionGroup") {
                const group = (obj.props as Record<string, unknown> | undefined)?.groupName;
                if (typeof group === "string" && group) {
                    parts.push(`@${group}`);
                }
            } else if (typeof obj.text === "string") {
                parts.push(obj.text);
            }
            if (obj.content) walk(obj.content);
            if (obj.children) walk(obj.children);
        }
    };
    walk(content);
    return parts.join(" ");
};

// Best-effort first-line extract: prefer the persisted plain-text
// snapshot, fall back to walking the rich-content tree.
const previewFromMessage = (msg: { contentText?: string; content?: unknown }): string | null => {
    return firstLine(msg.contentText) ?? firstLine(textFromBlocks(msg.content));
};

// Extract the trailing messageId from a `moveToSpecificIndex` hint.
// `useChatManagement.moveToSpecificChat` formats it as
// "{chatId}-{messageId}" for chats and "{chatId}-{threadId}-{messageId}"
// for threads. Returns null when no usable id is present (no hint, NaN,
// or 0/sentinel).
const messageIdFromHint = (hint: string | undefined, segments: number): number | null => {
    if (!hint) return null;
    const parts = hint.split("-");
    if (parts.length < segments) return null;
    const raw = Number(parts[segments - 1]);
    if (!Number.isFinite(raw) || raw <= 0) return null;
    return raw;
};

// Resolve the message a `moveToSpecificIndex` hint points at, tolerant of
// BOTH forms the hint can take:
//   - v3 (the common case): the hint IS the message's UUID, set by
//     `useChatRouting` / `moveToSpecificChat` via `resolveV3MessageUuid`.
//   - legacy composite: "{chatId}-{messageId}" / "{chatId}-{threadId}-
//     {messageId}" with the numeric seq in the trailing segment.
// A v3 UUID has 4 dashes, so `messageIdFromHint` split+Number()'d a UUID
// segment to NaN and returned null — silently dropping the deep-linked
// bubble's preview from the history entry. Find by the message's UUID
// field when the hint is a UUID, by seq otherwise.
const findHintedMessage = <T extends { messageId: number }>(
    msgs: readonly T[],
    hint: string | undefined,
    getUuid: (m: T) => string | undefined,
    segments: number
): T | undefined => {
    if (!hint) return undefined;
    if (isV3Uuid(hint)) return msgs.find((m) => getUuid(m) === hint);
    const seq = messageIdFromHint(hint, segments);
    return seq != null ? msgs.find((m) => Number(m.messageId) === seq) : undefined;
};

export const useHistoryTracker = ({ useCM, useTM, useSM, useNM, usePM }: Props) => {
    const { record } = useHistory();

    // Track the last-recorded key per channel so re-renders with
    // unchanged state don't repeatedly push the same entry. The
    // record() dedup catches duplicates too, but skipping at this
    // layer avoids unnecessary state updates / writes.
    const lastChatKeyRef = useRef<string | null>(null);
    const lastThreadKeyRef = useRef<string | null>(null);
    const lastTaskKeyRef = useRef<string | null>(null);
    const lastMilestoneKeyRef = useRef<string | null>(null);
    const lastNoteKeyRef = useRef<string | null>(null);

    // Chats
    const currentMainChat = useCM.currentMainChat;
    useEffect(() => {
        // `chatId === ""` is the v3-flipped "uninitialized chat"
        // sentinel (replaces legacy `=== -1`).
        if (!currentMainChat || currentMainChat.chatId == null || currentMainChat.chatId === "") {
            return;
        }
        // `moveToSpecificIndex` is the canonical "URL targets a specific
        // bubble" signal — set by both `moveToSpecificChat` and the URL
        // effect in `useChatRouting`. Format: "{chatId}-{messageId}".
        const chatType = currentMainChat.chatType;
        const chatId = currentMainChat.chatId;
        const hint = currentMainChat.moveToSpecificIndex;
        const targetMsg = findHintedMessage(
            currentMainChat.messages,
            hint,
            (m) => m.messageIdWithChatId,
            2
        );
        // Derive the seq for the history entry from the resolved bubble
        // (works for both UUID and legacy-composite hints). Fall back to
        // the legacy seq parse only for non-UUID hints whose bubble isn't
        // in the loaded slice yet (the async block below fills the text).
        const messageId = targetMsg
            ? Number(targetMsg.messageId)
            : isV3Uuid(hint)
              ? null
              : messageIdFromHint(hint, 2);
        const messageText: string | null = targetMsg ? previewFromMessage(targetMsg) : null;
        // The ref encodes "have we recorded this (chat, message, text)
        // exact state already?" — including `messageText` means if a
        // later effect run finds the bubble in `messages` (Virtuoso
        // paginated it in) we re-record once and `mergeAndCap` upserts
        // the entry with the now-known text instead of leaving the row
        // stuck on the `Message #id` stub.
        const refKey = `chat:${chatType}:${chatId}:${messageId ?? 0}:${messageText ? "1" : "0"}`;
        if (lastChatKeyRef.current === refKey) return;
        lastChatKeyRef.current = refKey;
        const label =
            currentMainChat.chatName || (currentMainChat.dmPartnerUser?.userName ?? `#${chatId}`);
        record({
            // See file-header punch-list note: HistoryEntry.chatId
            // is still typed number; cast at the write boundary.
            chatId: chatId as unknown as number,
            chatType,
            kind: "chat",
            label,
            messageId,
            messageText,
            openedAt: Date.now(),
        });
        // Async fallback: `currentMainChat.messages` is just the slice
        // Virtuoso has paged in — when the user deep-links to an older
        // bubble it may not be in that slice. The IDB store has the
        // full chat history, so hit it directly. The follow-up
        // `record()` upserts the same entry (same `keyForEntry`).
        //
        // No cancellation: `currentMainChat` is touched by every chat
        // event (new socket message, read-status tick, etc.), so a
        // cleanup-based cancel would race with the IDB read and
        // silently drop the result. We always want whatever text we
        // can find; `mergeAndCap` keys by (chat, messageId) so a late
        // record still lands on the right entry.
        if (messageText == null && hint) {
            // v3 source. `chatId` is the v3 channel UUID (typed `number`
            // per legacy `HistoryEntry`, runtime string).
            // `loadV3SpecificMessages` triggers `syncChannel` + reads the
            // snapshot, returning legacy-shape MessageProps. Resolve the
            // hinted bubble (by UUID or seq) and record its seq + preview.
            void loadV3SpecificMessages(chatId as unknown as string, chatType).then((all) => {
                const found = findHintedMessage(all, hint, (m) => m.messageIdWithChatId, 2);
                const text = found ? previewFromMessage(found) : null;
                if (!found || !text) return;
                const seq = Number(found.messageId);
                lastChatKeyRef.current = `chat:${chatType}:${chatId}:${seq}:1`;
                record({
                    chatId: chatId as unknown as number,
                    chatType,
                    kind: "chat",
                    label,
                    messageId: seq,
                    messageText: text,
                    openedAt: Date.now(),
                });
            });
        }
    }, [currentMainChat, record]);

    // Threads
    const currentThreadChat = useCM.currentThreadChat;
    useEffect(() => {
        if (
            !currentThreadChat ||
            currentThreadChat.chatId == null ||
            currentThreadChat.threadId == null ||
            currentThreadChat.threadId === 0
        ) {
            return;
        }
        // Thread `moveToSpecificIndex` format: "{chatId}-{threadId}-{messageId}".
        const chatType = currentThreadChat.chatType;
        const chatId = currentThreadChat.chatId;
        const threadId = currentThreadChat.threadId;
        const hint = currentThreadChat.moveToSpecificIndex;
        const targetMsg = findHintedMessage(
            currentThreadChat.messages,
            hint,
            (m) => m.messageIdWithChatIdAndThreadId,
            3
        );
        const messageId = targetMsg
            ? Number(targetMsg.messageId)
            : isV3Uuid(hint)
              ? null
              : messageIdFromHint(hint, 3);
        const messageText: string | null = targetMsg ? previewFromMessage(targetMsg) : null;
        // Same retry-on-text pattern as the chat effect — see comment
        // there for the rationale.
        const refKey = `thread:${chatType}:${chatId}:${threadId}:${messageId ?? 0}:${messageText ? "1" : "0"}`;
        if (lastThreadKeyRef.current === refKey) return;
        lastThreadKeyRef.current = refKey;
        const parentName = currentThreadChat.chatName || `#${chatId}`;
        // Find the parent message the thread hangs off of, in the
        // currently-loaded main chat. If `currentMainChat` is the
        // parent chat of this thread, its messages contain the bubble
        // with the matching `threadId`. Falls back to null when the
        // parent chat isn't loaded yet — the row will then show just
        // the parent chat name + Thread chip.
        let parentMessageText: string | null = null;
        if (
            currentMainChat &&
            currentMainChat.chatType === chatType &&
            // `currentMainChat.chatId` is v3 string; `chatId` here is
            // from `ThreadProps` (still legacy `number`). Compare as
            // strings to bridge.
            currentMainChat.chatId === String(chatId)
        ) {
            const parent = currentMainChat.messages.find((m) => m.threadId === threadId);
            if (parent) parentMessageText = firstLine(parent.contentText);
        }
        record({
            chatId,
            chatType,
            kind: "thread",
            label: parentName,
            messageId,
            messageText,
            openedAt: Date.now(),
            parentMessageText,
            threadId,
        });
        // Async IDB fallback for the targeted in-thread bubble — same
        // story as the chat effect: the in-memory `messages` slice is
        // only the part Virtuoso loaded. No cancellation — see the
        // matching comment in the chat effect for why.
        if (messageText == null && hint) {
            // v3 source. `chatId` carries the channel UUID and
            // `threadId` carries the parent message's UUID via the
            // legacy `number` slot — same cast pattern. Resolve the
            // hinted reply (by UUID or seq) and record its seq + preview.
            void loadV3SpecificThreadMessages(
                chatId as unknown as string,
                threadId as unknown as string,
                chatType
            ).then((all) => {
                const found = findHintedMessage(
                    all,
                    hint,
                    (m) => m.messageIdWithChatIdAndThreadId,
                    3
                );
                const text = found ? previewFromMessage(found) : null;
                if (!found || !text) return;
                const seq = Number(found.messageId);
                lastThreadKeyRef.current = `thread:${chatType}:${chatId}:${threadId}:${seq}:1`;
                record({
                    chatId,
                    chatType,
                    kind: "thread",
                    label: parentName,
                    messageId: seq,
                    messageText: text,
                    openedAt: Date.now(),
                    parentMessageText,
                    threadId,
                });
            });
        }
    }, [currentThreadChat, currentMainChat, record]);

    // Tasks
    const currentPreviewTaskId = useTM.currentPreviewTaskId;
    const currentPreviewKind = useTM.currentPreviewKind;
    const allTasks = useTM.allTasks;
    const currentPreviewTask = useTM.currentPreviewTask;
    useEffect(() => {
        if (currentPreviewKind !== "task") return;
        if (!currentPreviewTaskId || currentPreviewTaskId === -1) return;
        const key = `task:${currentPreviewTaskId}`;
        if (lastTaskKeyRef.current === key) return;
        // Resolve title: prefer the already-loaded preview object,
        // otherwise fall back to the task-table row, otherwise skip until
        // a title is available.
        let title: string | null = null;
        let projectId: number | null = null;
        if (currentPreviewTask && Number(currentPreviewTask.id) === Number(currentPreviewTaskId)) {
            title = currentPreviewTask.title || null;
            projectId = currentPreviewTask.project?.projectId ?? null;
        }
        if (!title) {
            const row = allTasks.find((t) => Number(t.id) === Number(currentPreviewTaskId));
            if (row) {
                title = row.title || null;
                projectId = row.projectId ?? null;
            }
        }
        if (!title) return;
        lastTaskKeyRef.current = key;
        const projectName =
            projectId != null
                ? (usePM.teamProjects.find((p) => p.projectId === projectId)?.projectName ?? null)
                : null;
        const entry: HistoryEntry = {
            kind: "task",
            label: title,
            openedAt: Date.now(),
            projectId,
            projectName,
            taskId: currentPreviewTaskId,
        };
        record(entry);
    }, [
        currentPreviewTaskId,
        currentPreviewKind,
        currentPreviewTask,
        allTasks,
        usePM.teamProjects,
        record,
    ]);

    // Milestones
    const currentPreviewMilestoneId = useTM.currentPreviewMilestoneId;
    const projectMilestones = useSM.projectMilestones;
    useEffect(() => {
        if (currentPreviewKind !== "milestone") return;
        if (!currentPreviewMilestoneId || currentPreviewMilestoneId === -1) return;
        const key = `milestone:${currentPreviewMilestoneId}`;
        if (lastMilestoneKeyRef.current === key) return;
        // projectMilestones is `Record<number, Milestone[]>`. The
        // milestone could live under any project; scan all buckets.
        let label: string | null = null;
        let projectId: number | null = null;
        for (const [pidStr, list] of Object.entries(projectMilestones)) {
            const found = list.find((m) => m.milestoneId === currentPreviewMilestoneId);
            if (found) {
                label = found.title || null;
                projectId = Number(pidStr);
                break;
            }
        }
        if (!label) return;
        lastMilestoneKeyRef.current = key;
        const projectName =
            projectId != null
                ? (usePM.teamProjects.find((p) => p.projectId === projectId)?.projectName ?? null)
                : null;
        const entry: HistoryEntry = {
            kind: "milestone",
            label,
            milestoneId: currentPreviewMilestoneId,
            openedAt: Date.now(),
            projectId,
            projectName,
        };
        record(entry);
    }, [
        currentPreviewMilestoneId,
        currentPreviewKind,
        projectMilestones,
        usePM.teamProjects,
        record,
    ]);

    // Notes — three independent channels (My / Task / Chat). Only one
    // is set at a time in practice; the lastNoteKeyRef is shared so
    // the same noteId in different surfaces still dedups within the
    // notes tab.
    const currentMyNote = useNM.currentMyNote;
    // My / Shared / Team notes all arrive here as noteType 1, so the
    // history row has to record the sidebar BUCKET instead — otherwise
    // every one of them renders with the "My note" chip. The bucket
    // lives on the tab; nothing on the note itself distinguishes them.
    const activeNoteTab = useNM.tabsApi.activeTab;
    const myNoteBucket =
        activeNoteTab?.kind === "my" ? (activeNoteTab.bucket ?? "my") : ("my" as const);
    const teamNoteFolders = useNM.teamNoteFolders;
    const teamNoteMeta = useNM.teamNoteMeta;
    useEffect(() => {
        if (!currentMyNote || !currentMyNote.noteId) return;
        const bucketNoteType = noteTypeFromBucket(myNoteBucket);
        const key = `note:${bucketNoteType}:${currentMyNote.noteId}`;
        if (lastNoteKeyRef.current === key) return;
        lastNoteKeyRef.current = key;

        // Team rows carry their folder as the subtitle, the way a task
        // note carries its project — it's the context that makes the
        // row identifiable at a glance. Captured at open time so a later
        // rename doesn't rewrite old history.
        let folderName: string | null = null;
        if (bucketNoteType === 8) {
            const folderId = teamNoteMeta.find((n) => n.noteId === currentMyNote.noteId)?.folderId;
            folderName = teamNoteFolders.find((f) => f.folderId === folderId)?.name ?? null;
        }

        const entry: HistoryEntry = {
            kind: "note",
            label: currentMyNote.title || `#${currentMyNote.noteId}`,
            noteId: currentMyNote.noteId,
            noteType: bucketNoteType,
            folderName,
            openedAt: Date.now(),
        };
        record(entry);
    }, [currentMyNote, myNoteBucket, teamNoteMeta, teamNoteFolders, record]);

    const currentTaskNote = useNM.currentTaskNote;
    const allTasksForNotes = useTM.allTasks;
    useEffect(() => {
        if (!currentTaskNote || !currentTaskNote.noteId) return;
        const key = `note:${currentTaskNote.noteType}:${currentTaskNote.noteId}`;
        if (lastNoteKeyRef.current === key) return;
        lastNoteKeyRef.current = key;
        const projectName =
            currentTaskNote.projectId != null
                ? (usePM.teamProjects.find((p) => p.projectId === currentTaskNote.projectId)
                      ?.projectName ?? null)
                : null;
        const taskTitle =
            currentTaskNote.taskId != null
                ? (allTasksForNotes.find((t) => Number(t.id) === Number(currentTaskNote.taskId))
                      ?.title ?? null)
                : null;
        const entry: HistoryEntry = {
            kind: "note",
            label: currentTaskNote.title || `#${currentTaskNote.noteId}`,
            noteId: currentTaskNote.noteId,
            noteType: currentTaskNote.noteType,
            openedAt: Date.now(),
            projectId: currentTaskNote.projectId ?? null,
            projectName,
            taskId: currentTaskNote.taskId ?? null,
            taskTitle,
        };
        record(entry);
    }, [currentTaskNote, usePM.teamProjects, allTasksForNotes, record]);

    const currentChatNote = useNM.currentChatNote;
    const allChatsForNotes = useCM.allChats;
    useEffect(() => {
        if (!currentChatNote || !currentChatNote.noteId) return;
        const key = `note:${currentChatNote.noteType}:${currentChatNote.noteId}`;
        if (lastNoteKeyRef.current === key) return;
        lastNoteKeyRef.current = key;
        const chatName =
            currentChatNote.chatType != null && currentChatNote.chatId != null
                ? (allChatsForNotes.find(
                      (c) =>
                          c.chatType === currentChatNote.chatType &&
                          // `c.chatId` is v3 string; `currentChatNote.chatId`
                          // is still legacy number on the note shape. Bridge
                          // with String().
                          c.chatId === String(currentChatNote.chatId)
                  )?.chatName ?? null)
                : null;
        const entry: HistoryEntry = {
            chatId: currentChatNote.chatId ?? null,
            chatName,
            chatType: currentChatNote.chatType ?? null,
            isThread: currentChatNote.isThread ?? null,
            kind: "note",
            label: currentChatNote.title || `#${currentChatNote.noteId}`,
            noteId: currentChatNote.noteId,
            noteType: currentChatNote.noteType,
            openedAt: Date.now(),
            threadId: currentChatNote.threadId ?? null,
        };
        record(entry);
    }, [currentChatNote, allChatsForNotes, record]);
};
