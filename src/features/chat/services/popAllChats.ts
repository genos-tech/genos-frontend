import { chatChannel } from "../../../db/workers/channels";
import { AllChatProps } from "../../../types/chat";

export const popAllChats = (): Promise<AllChatProps[]> => {
    return chatChannel.request("popAllChats", {});
};
