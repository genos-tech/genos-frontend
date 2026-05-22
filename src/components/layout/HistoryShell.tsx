import { useCallback } from "react";
import { useNavigate } from "react-router-dom";

import { ChatManagementState } from "../../hooks/chats/useChatManagement";
import {
    ChatHistoryEntry,
    MilestoneHistoryEntry,
    NoteHistoryEntry,
    TaskHistoryEntry,
    ThreadHistoryEntry,
} from "../../hooks/common/useHistory";
import { useHistoryTracker } from "../../hooks/common/useHistoryTracker";
import { ProjectManagementState } from "../../hooks/common/useProjectManagement";
import { NoteManagementState } from "../../hooks/notes/useNoteManagement";
import { SprintMilestoneManagementState } from "../../hooks/tasks/useSprintMilestoneManagement";
import { TaskManagementState } from "../../hooks/tasks/useTaskManagement";
import { HistoryModal } from "./HistoryModal";

// Mounted inside `<HistoryProvider>` from App.tsx. Owns the
// open-state-keyed modal render and the tracker effects. Lives in its
// own file because `useHistoryTracker` consumes the History context,
// which can only happen below the provider — keeping App.tsx free of
// the indirection.

// Map chat-type numeric codes to their URL segments. Mirrors the
// CHAT_TYPE_REVERSE_MAP used by `useNoteRouting` and `useChatRouting`.
const CHAT_TYPE_PATH: Record<number, string> = {
    1: "dm",
    2: "gm",
    3: "pm",
    4: "mdm",
};

type Props = {
    open: boolean;
    onClose: () => void;
    useCM: ChatManagementState;
    useTM: TaskManagementState;
    useSM: SprintMilestoneManagementState;
    useNM: NoteManagementState;
    usePM: ProjectManagementState;
};

export const HistoryShell = ({ open, onClose, useCM, useTM, useSM, useNM, usePM }: Props) => {
    const navigate = useNavigate();

    // Captures every chat/thread/task/milestone/note open into the
    // History context, fired by transitions on the canonical preview
    // setters in each management hook.
    useHistoryTracker({ useCM, useTM, useSM, useNM });

    // Navigation callbacks — wired inside this component so they can
    // call into the existing management primitives directly rather than
    // forcing every caller to re-implement them. All five close the
    // modal after dispatch so the user lands cleanly on the destination.

    const onOpenChat = useCallback(
        (entry: ChatHistoryEntry) => {
            useCM.moveToSpecificChat(
                entry.chatType,
                entry.chatId,
                0,
                false,
                false,
                useTM.setCurrentPreviewTaskId,
                usePM.setCurrentProject
            );
            onClose();
        },
        [useCM, useTM.setCurrentPreviewTaskId, usePM.setCurrentProject, onClose]
    );

    const onOpenThread = useCallback(
        (entry: ThreadHistoryEntry) => {
            useCM.moveToSpecificChat(
                entry.chatType,
                entry.chatId,
                entry.threadId,
                false,
                true,
                useTM.setCurrentPreviewTaskId,
                usePM.setCurrentProject
            );
            onClose();
        },
        [useCM, useTM.setCurrentPreviewTaskId, usePM.setCurrentProject, onClose]
    );

    const onOpenTask = useCallback(
        (entry: TaskHistoryEntry) => {
            // Use the deep-link URL so the project resolves through the
            // tasks home route — matches the path the Spotlight overlay
            // and notification intents use for task targets.
            if (entry.projectId != null) {
                navigate(`/workspace/tasks/project/${entry.projectId}/task/${entry.taskId}`);
            } else {
                navigate("/workspace/tasks");
                useTM.setCurrentPreviewKind("task");
                useTM.setCurrentPreviewTaskId(entry.taskId);
            }
            onClose();
        },
        [navigate, useTM, onClose]
    );

    const onOpenMilestone = useCallback(
        (entry: MilestoneHistoryEntry) => {
            navigate("/workspace/tasks");
            useTM.setCurrentPreviewKind("milestone");
            useTM.setCurrentPreviewMilestoneId(entry.milestoneId);
            onClose();
        },
        [navigate, useTM, onClose]
    );

    const onOpenNote = useCallback(
        (entry: NoteHistoryEntry) => {
            // Build the deep URL so refresh/back/share restore the note.
            // `loadNote` is driven by the URL effect in `useNoteRouting`,
            // so navigating to the canonical path is sufficient — calling
            // it ourselves would race that effect on the first render.
            // Mirrors the per-noteType branches in
            // `handleSpotlightSelect` (App.tsx).
            // 1 = personal, 2 = task, 3 = chat (matches existing loadNote
            // call sites in FavoriteNoteItem, RecentNoteItem, etc.).
            if (entry.noteType === 1) {
                navigate(`/workspace/notes/my/${entry.noteId}`);
            } else if (entry.noteType === 2 && entry.projectId != null && entry.taskId != null) {
                navigate(
                    `/workspace/notes/task/project/${entry.projectId}` +
                        `/task/${entry.taskId}/note/${entry.noteId}`
                );
            } else if (
                entry.noteType === 3 &&
                entry.chatType != null &&
                entry.chatId != null &&
                entry.threadId != null
            ) {
                const chatTypePath = CHAT_TYPE_PATH[entry.chatType];
                if (chatTypePath) {
                    navigate(
                        `/workspace/notes/chat/${chatTypePath}/${entry.chatId}` +
                            `/thread/${entry.threadId}/note/${entry.noteId}`
                    );
                } else {
                    navigate("/workspace/notes");
                    void useNM.loadNote(entry.noteType, entry.noteId, -1);
                }
            } else {
                // Legacy entries persisted before coordinates were stored,
                // or rows that lack the full chat-note triple. Fall back
                // to the in-app loader; the URL won't deep-link but the
                // note still opens.
                navigate("/workspace/notes");
                void useNM.loadNote(entry.noteType, entry.noteId, -1);
            }
            onClose();
        },
        [navigate, useNM, onClose]
    );

    return (
        <HistoryModal
            open={open}
            onClose={onClose}
            onOpenChat={onOpenChat}
            onOpenMilestone={onOpenMilestone}
            onOpenNote={onOpenNote}
            onOpenTask={onOpenTask}
            onOpenThread={onOpenThread}
        />
    );
};
