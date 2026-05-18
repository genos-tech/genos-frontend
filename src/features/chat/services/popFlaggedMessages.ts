import { chatChannel } from "../../../db/workers/channels";
import { FlaggedMessageProps } from "../../../types/chat";

export const popFlaggedMessages = (): Promise<FlaggedMessageProps[]> => {
    return chatChannel.request("popFlaggedMessages", {});
};
