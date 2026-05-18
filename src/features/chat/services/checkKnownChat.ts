import { chatChannel } from "../../../db/workers/channels";

export const checkKnownChat = (chatId: number, chatType: number): Promise<boolean> => {
    return chatChannel.request("checkKnownChat", { chatId, chatType });
};
