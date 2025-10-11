import { STORES } from "../db/conf";
import { messageIdWithChatId } from "../db/crud";
import { FlaggedMessageProps } from "../types/chat";

self.onmessage = async (event) => {
    const flaggedMessages: FlaggedMessageProps[] = await messageIdWithChatId({
        storeName: STORES.FLAGGED_MESSAGES,
    });

    // Filter and then sort messages by tsSent in desc
    const sortedFlaggedMessages = [...flaggedMessages].sort(
        (a, b) => new Date(b.tsSent).getTime() - new Date(a.tsSent).getTime()
    );

    self.postMessage(sortedFlaggedMessages);

    self.close(); // Terminates itself
};

export {};
