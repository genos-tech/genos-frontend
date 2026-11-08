import { inboxChannel } from "../../../db/workers/channels";

/** Write a switched source's new state into the stored Inbox rows (see the contract). */
export const patchInboxAiSource = (req: {
    kind: "digest" | "schedule";
    scheduleId?: string;
    enabled: boolean;
}): Promise<void> => inboxChannel.request("patchInboxAiSource", req);
