import { chatChannel } from "../../../db/workers/channels";
import { ThreadMessageProps } from "../../../types/chat";

export const popSpecificThreadMessages = (
    chatId: number,
    threadId: number,
    chatType: number
): Promise<ThreadMessageProps[]> => {
    return chatChannel.request("popSpecificThreadMessages", { chatId, threadId, chatType });
};
