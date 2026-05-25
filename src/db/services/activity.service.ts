import { ActivityMessageProps } from "../../types/chat";
import { STORES } from "../config";
import { BaseRepository } from "../repositories";

// Activity message repository
class ActivityMessageRepository extends BaseRepository<ActivityMessageProps> {
    constructor() {
        super(STORES.ACTIVITY_MESSAGES);
    }
}

// Activity service for business logic related to activity messages
export class ActivityService {
    private activityRepo: ActivityMessageRepository;

    constructor() {
        this.activityRepo = new ActivityMessageRepository();
    }

    // Get all activity messages
    async getAllActivityMessages(): Promise<ActivityMessageProps[]> {
        const result = await this.activityRepo.getAll();
        return result.success && result.data ? result.data : [];
    }

    // Get activity message by ID
    async getActivityMessage(activityId: string): Promise<ActivityMessageProps | null> {
        const result = await this.activityRepo.get(activityId);
        return result.success && result.data ? result.data : null;
    }

    // Add activity message
    async addActivityMessage(activityMessage: ActivityMessageProps): Promise<boolean> {
        const result = await this.activityRepo.put(activityMessage);
        return result.success;
    }

    // Batch insert activity messages
    async batchInsertActivityMessages(messages: ActivityMessageProps[]): Promise<boolean> {
        const result = await this.activityRepo.batchInsert(messages);
        return result.success;
    }

    // Delete activity message
    async deleteActivityMessage(activityId: string): Promise<boolean> {
        const result = await this.activityRepo.delete(activityId);
        return result.success;
    }

    // Clear all activity messages
    async clearActivityMessages(): Promise<boolean> {
        const result = await this.activityRepo.clear();
        return result.success;
    }

    // Delete activity rows older than `cutoffIso`. Used after an
    // incremental sync to evict rows that have aged out of the
    // 30-day display window (incremental sync only adds new rows,
    // it never evicts old ones).
    async pruneActivitiesOlderThan(cutoffIso: string): Promise<number> {
        const all = await this.getAllActivityMessages();
        const stale = all.filter((m) => m.tsSent < cutoffIso);
        for (const m of stale) {
            await this.activityRepo.delete(m.activityId);
        }
        return stale.length;
    }
}
