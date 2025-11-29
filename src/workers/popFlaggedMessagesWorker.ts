import { FlaggedRepository } from "../db/repositories";
import { FlaggedMessageProps } from "../types/chat";

self.onmessage = async (event) => {
    const flaggedRepository = new FlaggedRepository();
    const result = await flaggedRepository.getAll();
    const flaggedMessages: FlaggedMessageProps[] =
        result.success && result.data ? result.data : [];

    // Filter and then sort messages by tsSent in desc
    const sortedFlaggedMessages = [...flaggedMessages].sort(
        (a, b) => new Date(b.tsSent).getTime() - new Date(a.tsSent).getTime()
    );

    self.postMessage(sortedFlaggedMessages);

    self.close(); // Terminates itself
};

export {};
