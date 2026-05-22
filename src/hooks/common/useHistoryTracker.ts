import { useEffect, useRef } from "react";

import { ChatManagementState } from "../chats/useChatManagement";
import { NoteManagementState } from "../notes/useNoteManagement";
import { SprintMilestoneManagementState } from "../tasks/useSprintMilestoneManagement";
import { TaskManagementState } from "../tasks/useTaskManagement";
import { HistoryEntry, useHistory } from "./useHistory";

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
};

export const useHistoryTracker = ({ useCM, useTM, useSM, useNM }: Props) => {
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
        const threadSuffix = currentThreadChat.displayId || `#${currentThreadChat.threadId}`;
        const entry: HistoryEntry = {
            kind: "thread",
            chatType: currentThreadChat.chatType,
            chatId: currentThreadChat.chatId,
            threadId: currentThreadChat.threadId,
            label: `${parentName} › ${threadSuffix}`,
            openedAt: Date.now(),
        };
        record(entry);
    }, [currentThreadChat, record]);

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
        const entry: HistoryEntry = {
            kind: "task",
            taskId: currentPreviewTaskId,
            projectId,
            label: title,
            openedAt: Date.now(),
        };
        record(entry);
    }, [currentPreviewTaskId, currentPreviewKind, currentPreviewTask, allTasks, record]);

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
        const entry: HistoryEntry = {
            kind: "milestone",
            milestoneId: currentPreviewMilestoneId,
            projectId,
            label,
            openedAt: Date.now(),
        };
        record(entry);
    }, [currentPreviewMilestoneId, currentPreviewKind, projectMilestones, record]);

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
    useEffect(() => {
        if (!currentTaskNote || !currentTaskNote.noteId) return;
        const key = `note:${currentTaskNote.noteType}:${currentTaskNote.noteId}`;
        if (lastNoteKeyRef.current === key) return;
        lastNoteKeyRef.current = key;
        const entry: HistoryEntry = {
            kind: "note",
            noteType: currentTaskNote.noteType,
            noteId: currentTaskNote.noteId,
            projectId: currentTaskNote.projectId ?? null,
            taskId: currentTaskNote.taskId ?? null,
            label: currentTaskNote.title || `#${currentTaskNote.noteId}`,
            openedAt: Date.now(),
        };
        record(entry);
    }, [currentTaskNote, record]);

    const currentChatNote = useNM.currentChatNote;
    useEffect(() => {
        if (!currentChatNote || !currentChatNote.noteId) return;
        const key = `note:${currentChatNote.noteType}:${currentChatNote.noteId}`;
        if (lastNoteKeyRef.current === key) return;
        lastNoteKeyRef.current = key;
        const entry: HistoryEntry = {
            kind: "note",
            noteType: currentChatNote.noteType,
            noteId: currentChatNote.noteId,
            chatType: currentChatNote.chatType ?? null,
            chatId: currentChatNote.chatId ?? null,
            isThread: currentChatNote.isThread ?? null,
            threadId: currentChatNote.threadId ?? null,
            label: currentChatNote.title || `#${currentChatNote.noteId}`,
            openedAt: Date.now(),
        };
        record(entry);
    }, [currentChatNote, record]);
};
