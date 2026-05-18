import { chatChannel } from "../../../db/workers/channels";
import { MessageProps } from "../../../types/chat";

export const addMessage = (message: MessageProps, chatType: number): Promise<null> => {
    return chatChannel.request("addMessage", { message, chatType }).then(() => null);
};
