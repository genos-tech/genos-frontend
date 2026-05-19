import { chatChannel } from "../../../db/workers/channels";
import { MessageProps } from "../../../types/chat";

export const popSpecificMessages = (chatId: number, chatType: number): Promise<MessageProps[]> => {
    return chatChannel.request("popSpecificMessages", { chatId, chatType });
};
