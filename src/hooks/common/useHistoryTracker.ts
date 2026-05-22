import { useEffect, useRef } from "react";

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
        if (!currentMainChat || currentMainChat.chatId == null || currentMainChat.chatId === -1) {
            return;
        }
        const key = `chat:${currentMainChat.chatType}:${currentMainChat.chatId}`;
        if (lastChatKeyRef.current === key) return;
        lastChatKeyRef.current = key;
        const label =
            currentMainChat.chatName ||
            (currentMainChat.dmPartnerUser?.userName ?? `#${currentMainChat.chatId}`);
        const entry: HistoryEntry = {
            kind: "chat",
            chatType: currentMainChat.chatType,
            chatId: currentMainChat.chatId,
            label,
            openedAt: Date.now(),
        };
        record(entry);
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
        const key = `thread:${currentThreadChat.chatType}:${currentThreadChat.chatId}:${currentThreadChat.threadId}`;
        if (lastThreadKeyRef.current === key) return;
        lastThreadKeyRef.current = key;
        const parentName = currentThreadChat.chatName || `#${currentThreadChat.chatId}`;
        // Find the parent message the thread hangs off of, in the
        // currently-loaded main chat. If `currentMainChat` is the
        // parent chat of this thread, its messages contain the bubble
        // with the matching `threadId`. Falls back to null when the
        // parent chat isn't loaded yet — the row will then show just
        // the parent chat name + Thread chip.
        let parentMessageText: string | null = null;
        if (
            currentMainChat &&
            currentMainChat.chatType === currentThreadChat.chatType &&
            currentMainChat.chatId === currentThreadChat.chatId
        ) {
            const parent = currentMainChat.messages.find(
                (m) => m.threadId === currentThreadChat.threadId
            );
            if (parent) parentMessageText = firstLine(parent.contentText);
        }
        const entry: HistoryEntry = {
            kind: "thread",
            chatType: currentThreadChat.chatType,
            chatId: currentThreadChat.chatId,
            threadId: currentThreadChat.threadId,
            parentMessageText,
            label: parentName,
            openedAt: Date.now(),
        };
        record(entry);
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
            taskId: currentPreviewTaskId,
            projectId,
            projectName,
            label: title,
            openedAt: Date.now(),
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
            milestoneId: currentPreviewMilestoneId,
            projectId,
            projectName,
            label,
            openedAt: Date.now(),
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
    useEffect(() => {
        if (!currentMyNote || !currentMyNote.noteId) return;
        const key = `note:${currentMyNote.noteType}:${currentMyNote.noteId}`;
        if (lastNoteKeyRef.current === key) return;
        lastNoteKeyRef.current = key;
        const entry: HistoryEntry = {
            kind: "note",
            noteType: currentMyNote.noteType,
            noteId: currentMyNote.noteId,
            label: currentMyNote.title || `#${currentMyNote.noteId}`,
            openedAt: Date.now(),
        };
        record(entry);
    }, [currentMyNote, record]);

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
            noteType: currentTaskNote.noteType,
            noteId: currentTaskNote.noteId,
            projectId: currentTaskNote.projectId ?? null,
            taskId: currentTaskNote.taskId ?? null,
            projectName,
            taskTitle,
            label: currentTaskNote.title || `#${currentTaskNote.noteId}`,
            openedAt: Date.now(),
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
                          c.chatId === currentChatNote.chatId
                  )?.chatName ?? null)
                : null;
        const entry: HistoryEntry = {
            kind: "note",
            noteType: currentChatNote.noteType,
            noteId: currentChatNote.noteId,
            chatType: currentChatNote.chatType ?? null,
            chatId: currentChatNote.chatId ?? null,
            isThread: currentChatNote.isThread ?? null,
            threadId: currentChatNote.threadId ?? null,
            chatName,
            label: currentChatNote.title || `#${currentChatNote.noteId}`,
            openedAt: Date.now(),
        };
        record(entry);
    }, [currentChatNote, allChatsForNotes, record]);
};
