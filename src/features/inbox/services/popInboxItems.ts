import { inboxChannel } from "../../../db/workers/channels";
import { InboxItemProps } from "../../../types/common";

export const popInboxItems = (): Promise<InboxItemProps[]> => {
    return inboxChannel.request("popInboxItems", {});
};
