import { chatChannel } from "../../../db/workers/channels";
import { ThreadMessageProps } from "../../../types/chat";

export const addThreadMessage = (
    threadMessage: ThreadMessageProps,
    chatType: number
): Promise<null> => {
    return chatChannel.request("addThreadMessage", { threadMessage, chatType }).then(() => null);
};
