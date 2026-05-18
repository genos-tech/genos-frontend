import { chatChannel } from "../../../db/workers/channels";
import { AllChatProps } from "../../../types/chat";

export const addChat = (chat: AllChatProps, chatType: number): Promise<null> => {
    return chatChannel.request("addChat", { chat, chatType }).then(() => null);
};
