import { MessageProps } from "../../types/chat";
import { ChatRepositoryFactory } from "../repositories";

self.onmessage = async (event) => {
    const message: MessageProps = event.data.message;
    const chatType: number = event.data.chatType;

    if (chatType === 1) {
        const dmMessageRepo = ChatRepositoryFactory.createDMMessageRepository();
        await dmMessageRepo.put(message);
    } else if (chatType === 2) {
        const gmMessageRepo = ChatRepositoryFactory.createGMMessageRepository();
        await gmMessageRepo.put(message);
    } else if (chatType === 3) {
        const pmMessageRepo = ChatRepositoryFactory.createPMMessageRepository();

        // PM bubbles use `${chatId}-${taskId}` as the IDB primary key,
        // so any incoming PM broadcast for the same task overwrites the
        // existing entry. We defend `taskCommentCount` from two failure
        // modes that would otherwise visibly revert the chip after a
        // user sends a comment:
        //
        //   1. Payloads that omit the field entirely (e.g. older code
        //      paths or future broadcasts that forget it) — preserve
        //      the existing value rather than wiping to undefined.
        //
        //   2. Payloads that carry a STALE lower value due to a backend
        //      race (the auto-bubble's `pm/message/` GET reading the
        //      TaskComments count before the comment INSERT commits in
        //      a sibling thread). Take Math.max so a stale broadcast
        //      can never downgrade a fresher count. Today the count is
        //      monotonically increasing — no comment-DELETE handler
        //      exists — so this is safe; revisit if/when delete lands.
        if (message.messageIdWithChatId) {
            const existing = await pmMessageRepo.get(message.messageIdWithChatId);
            const existingCount =
                existing.success && existing.data?.taskCommentCount !== undefined
                    ? existing.data.taskCommentCount
                    : undefined;
            const incomingCount = message.taskCommentCount;
            if (existingCount !== undefined && incomingCount !== undefined) {
                message.taskCommentCount = Math.max(existingCount, incomingCount);
            } else if (existingCount !== undefined && incomingCount === undefined) {
                message.taskCommentCount = existingCount;
            }
        }
        await pmMessageRepo.put(message);
    } else if (chatType === 4) {
        const mdmMessageRepo = ChatRepositoryFactory.createMDMMessageRepository();
        await mdmMessageRepo.put(message);
    }

    self.postMessage("done");

    self.close(); // Terminates itself
};

export {};
