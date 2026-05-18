import axios from "axios";

import { getMessages } from "../../../../i18n";
import { authApi } from "../../../../services/api";
import { UserProps } from "../../../../types/admin";
import { ChatNoteProps } from "../../../../types/notes";

export const sendUpdatedChatNote = async (
    myself: UserProps,
    updatedNote: ChatNoteProps,
    accessToken: string | null,
    setErrorMessage?: (value: string) => void
) => {
    try {
        const api = authApi(accessToken);
        if (api) {
            const res = await api.put("/note/chat/", {
                user_id: myself.userId,
                note_id: updatedNote.noteId,
                parent_note_id: updatedNote.parentNoteId,
                title: updatedNote.title,
                body: updatedNote.body,
            });
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
