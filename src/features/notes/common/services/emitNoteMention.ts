import { Socket } from "socket.io-client";

// Build + emit the `note_mention` socket event. Called from each
// `sendUpdated{My,Chat,Task}Note` after the PUT response reports a
// mention delta. Gated on `newly||removed > 0` so a save that didn't
// touch mentions stays silent.
//
// Shape mirrors the task-body `task_body_mention` event but adds note
// coordinates. The Flask handler routes by `note_type` (1=Personal,
// 2=Task, 3=Chat) into the chat-type namespace (6/7/8) used to
// dedupe ActivityFact rows across surfaces.
type NoteMentionPayload = {
    noteType: 1 | 2 | 3;
    noteId: number;
    noteTitle: string;
    tsMentionedAt: string;
    newlyMentionedUserIds: string[];
    allMentionedUserIds: string[];
    removedUserIds: string[];
    // chat-note only
    chatType?: number;
    chatId?: number;
    // task-note only
    projectId?: number;
    taskId?: number;
};

export const emitNoteMention = (socket: Socket | null, payload: NoteMentionPayload): void => {
    if (!socket) return;
    if (payload.newlyMentionedUserIds.length === 0 && payload.removedUserIds.length === 0) {
        return;
    }
    socket.emit("note_mention", {
        note_type: payload.noteType,
        note_id: payload.noteId,
        note_title: payload.noteTitle,
        ts_mentioned_at: payload.tsMentionedAt,
        newly_mentioned_user_ids: payload.newlyMentionedUserIds,
        all_mentioned_user_ids: payload.allMentionedUserIds,
        removed_user_ids: payload.removedUserIds,
        ...(payload.chatType !== undefined ? { chat_type: payload.chatType } : {}),
        ...(payload.chatId !== undefined ? { chat_id: payload.chatId } : {}),
        ...(payload.projectId !== undefined ? { project_id: payload.projectId } : {}),
        ...(payload.taskId !== undefined ? { task_id: payload.taskId } : {}),
    });
};
