import { STORES } from "../config";
import { BaseRepository } from "../repositories";
import { FlaggedMessage } from "../types";

// Flagged message repository
class FlaggedMessageRepository extends BaseRepository<FlaggedMessage> {
    constructor() {
        super(STORES.FLAGGED_MESSAGES);
    }
}

// Flagged service for business logic related to flagged messages
export class FlaggedService {
    private flaggedRepo: FlaggedMessageRepository;

    constructor() {
        this.flaggedRepo = new FlaggedMessageRepository();
    }

    // Get all flagged messages
    async getAllFlaggedMessages(): Promise<FlaggedMessage[]> {
        const result = await this.flaggedRepo.getAll();
        return result.success && result.data ? result.data : [];
    }

    // Get flagged message by ID
    async getFlaggedMessage(flaggedMessageId: string): Promise<FlaggedMessage | null> {
        const result = await this.flaggedRepo.get(flaggedMessageId);
        return result.success && result.data ? result.data : null;
    }

    // Add flagged message
    async addFlaggedMessage(flaggedMessage: FlaggedMessage): Promise<boolean> {
        const result = await this.flaggedRepo.put(flaggedMessage);
        return result.success;
    }

    // Batch insert flagged messages
    async batchInsertFlaggedMessages(messages: FlaggedMessage[]): Promise<boolean> {
        const result = await this.flaggedRepo.batchInsert(messages);
        return result.success;
    }

    // Delete flagged message
    async deleteFlaggedMessage(flaggedMessageId: string): Promise<boolean> {
        const result = await this.flaggedRepo.delete(flaggedMessageId);
        return result.success;
    }

    // Clear all flagged messages
    async clearFlaggedMessages(): Promise<boolean> {
        const result = await this.flaggedRepo.clear();
        return result.success;
    }
}
