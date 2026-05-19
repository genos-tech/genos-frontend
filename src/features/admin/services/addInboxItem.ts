import { inboxChannel } from "../../../db/workers/channels";
import { InboxItemProps } from "../../../types/common";

export const addInboxItem = (inboxItem: InboxItemProps): Promise<null> => {
    return inboxChannel.request("addInboxItem", { inboxItem }).then(() => null);
};
