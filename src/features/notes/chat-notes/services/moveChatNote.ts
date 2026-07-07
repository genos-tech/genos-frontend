import axios from "axios";

import { authApi } from "../../../../services/api";
import { UserProps } from "../../../../types/admin";

// Re-anchor a chat note (and, server-side, its whole descendant
// subtree) to a different channel. Thread anchoring is cleared on move
// (the old thread root lives in the old channel). `channelId` is the
// v3 channel UUID — typed loose because ChatNoteMetaProps.chatId is
// declared number but carries the UUID string post-flip.
export const moveChatNote = async (
    myself: UserProps,
    noteId: number,
    chatType: number,
    channelId: string | number,
    accessToken: string | null
) => {
    try {
        const api = authApi(accessToken);
        if (api) {
            const res = await api.put("/note/chat/move/", {
                team_id: myself.teamId,
                user_id: myself.userId,
                note_id: noteId,
                chat_type: chatType,
                channel_id: String(channelId),
            });
            return res.data;
        } else {
            console.error("Unauthorized. Auth toke is not found.");
        }
    } catch (error: unknown) {
        if (axios.isAxiosError(error)) {
            console.error("API error:", error.response?.status, error.response?.data);
        } else {
            console.error("Unexpected error:", error);
        }
    }
    return undefined;
};
