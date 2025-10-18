import { FlaggedRepository } from "../db/repositories";
import { FlaggedMessageProps } from "../types/chat";

self.onmessage = async (event) => {
    const message: FlaggedMessageProps = event.data.message;

    const flaggedRepo = new FlaggedRepository();
    await flaggedRepo.put(message);

    self.postMessage("done");

    self.close(); // Terminates itself
};

export {};
