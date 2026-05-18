import { chatChannel } from "../../../db/workers/channels";
import { FlaggedMessageProps } from "../../../types/chat";

export const addFlaggedMessage = (message: FlaggedMessageProps): Promise<null> => {
    return chatChannel.request("addFlaggedMessage", { message }).then(() => null);
};
