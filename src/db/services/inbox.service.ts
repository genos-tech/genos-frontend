import { STORES } from "../config";
import { BaseRepository } from "../repositories";
import { InboxItem } from "../types";

// Inbox item repository
class InboxItemRepository extends BaseRepository<InboxItem> {
    constructor() {
        super(STORES.INBOX);
    }
}

// Inbox service for business logic related to inbox items
export class InboxService {
    private inboxRepo: InboxItemRepository;

    constructor() {
        this.inboxRepo = new InboxItemRepository();
    }

    // Get all inbox items
    async getAllInboxItems(): Promise<InboxItem[]> {
        const result = await this.inboxRepo.getAll();
        return result.success && result.data ? result.data : [];
    }

    // Get inbox item by ID
    async getInboxItem(itemId: string): Promise<InboxItem | null> {
        const result = await this.inboxRepo.get(itemId);
        return result.success && result.data ? result.data : null;
    }

    // Add inbox item
    async addInboxItem(inboxItem: InboxItem): Promise<boolean> {
        const result = await this.inboxRepo.put(inboxItem);
        return result.success;
    }

    // Batch insert inbox items
    async batchInsertInboxItems(items: InboxItem[]): Promise<boolean> {
        const result = await this.inboxRepo.batchInsert(items);
        return result.success;
    }

    // Delete inbox item
    async deleteInboxItem(itemId: string): Promise<boolean> {
        const result = await this.inboxRepo.delete(itemId);
        return result.success;
    }

    // Clear all inbox items
    async clearInboxItems(): Promise<boolean> {
        const result = await this.inboxRepo.clear();
        return result.success;
    }

    // Mark inbox item as read
    async markAsRead(itemId: string): Promise<boolean> {
        const item = await this.getInboxItem(itemId);
        if (!item) return false;

        item.isRead = true;
        return this.addInboxItem(item);
    }

    // Mark inbox item as unread
    async markAsUnread(itemId: string): Promise<boolean> {
        const item = await this.getInboxItem(itemId);
        if (!item) return false;

        item.isRead = false;
        return this.addInboxItem(item);
    }

    // Get unread inbox items
    async getUnreadInboxItems(): Promise<InboxItem[]> {
        const allItems = await this.getAllInboxItems();
        return allItems.filter((item) => !item.isRead);
    }

    // Get read inbox items
    async getReadInboxItems(): Promise<InboxItem[]> {
        const allItems = await this.getAllInboxItems();
        return allItems.filter((item) => item.isRead);
    }
}
