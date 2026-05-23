import axios from "axios";
import { Socket } from "socket.io-client";

import { getMessages } from "../../../../i18n";
import { authApi } from "../../../../services/api";
import { UserProps } from "../../../../types/admin";
import { TaskNoteProps } from "../../../../types/notes";
import { emitNoteMention } from "../../common/services/emitNoteMention";

export const sendUpdatedTaskNote = async (
    myself: UserProps,
    updatedNote: TaskNoteProps,
    accessToken: string | null,
    socket: Socket | null,
    setErrorMessage?: (value: string) => void
) => {
    try {
        const api = authApi(accessToken);
        if (api) {
            const res = await api.put("/note/task/", {
                user_id: myself.userId,
                note_id: updatedNote.noteId,
                parent_note_id: updatedNote.parentNoteId,
                title: updatedNote.title,
                body: updatedNote.body,
            });
            if (res?.data) {
                emitNoteMention(socket, {
                    noteType: 2,
                    noteId: updatedNote.noteId,
                    noteTitle: updatedNote.title,
                    tsMentionedAt: res.data.ts_updated_at ?? new Date().toISOString(),
                    newlyMentionedUserIds: res.data.newly_mentioned_user_ids ?? [],
                    allMentionedUserIds: res.data.all_mentioned_user_ids ?? [],
                    removedUserIds: res.data.removed_user_ids ?? [],
                    projectId: updatedNote.projectId,
                    taskId: updatedNote.taskId,
                });
            }
        } else {
            console.error("Unauthorized. Auth toke is not found.");
            if (setErrorMessage) {
                setErrorMessage(getMessages().notes.errors.unauthorizedToken);
            }
        }
    } catch (error: unknown) {
        if (axios.isAxiosError(error)) {
            if (error.response?.status === 400) {
                console.error("HTTP 400 error:", error.response?.data);
                if (setErrorMessage) {
                    setErrorMessage(getMessages().notes.errors.messageIdExists);
                }
            } else if (error.response?.status === 401) {
                console.error("HTTP 401 error:", error.response?.data);
                if (setErrorMessage) {
                    setErrorMessage(getMessages().notes.errors.unauthorizedLoginAgain);
                }
            } else {
                console.error("API error:", error.response?.status, error.response?.data);
            }
        } else {
            console.error("Unexpected error:", error);
        }
    }
};
