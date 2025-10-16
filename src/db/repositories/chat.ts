import { INDEX_NAMES, STORES } from "../config";
import { Chat, ChatMessage, MessageQuery, ThreadMessage } from "../types";
import { BaseRepository } from "./base";

// Chat repository for managing chat-related data
export class ChatRepository extends BaseRepository<Chat> {
    constructor() {
        super(STORES.DM_CHATS); // Default to DM chats, can be overridden
    }

    // Get chat by ID
    async getChat(chatId: number): Promise<Chat | null> {
        const result = await this.get(chatId);
        return result.success && result.data ? result.data : null;
    }

    // Get all chats
    async getAllChats(): Promise<Chat[]> {
        const result = await this.getAll();
        return result.success && result.data ? result.data : [];
    }

    // Get latest chat
    async getLatestChat(): Promise<Chat | null> {
        try {
            const db = await this.getDB();
            const tx = db.transaction(this.storeName, "readonly");
            const store = tx.objectStore(this.storeName);
            const index = store.index(INDEX_NAMES.DM_CHATS);
            const cursor = await index.openCursor(null, "prev");
            return cursor ? cursor.value : null;
        } catch {
            return null;
        }
    }

    // Update chat
    async updateChat(chat: Chat): Promise<boolean> {
        const result = await this.put(chat);
        return result.success;
    }
}

// Message repository for managing chat messages
export class MessageRepository extends BaseRepository<ChatMessage> {
    constructor(storeName: string) {
        super(storeName);
    }

    // Get messages by chat ID
    async getMessagesByChatId(chatId: number): Promise<ChatMessage[]> {
        try {
            const db = await this.getDB();
            const tx = db.transaction(this.storeName, "readonly");
            const store = tx.objectStore(this.storeName);
            const index = store.index(INDEX_NAMES.DM_MESSAGES);
            const messages = await index.getAll(chatId);
            return messages;
        } catch {
            return [];
        }
    }

    // Get messages with query parameters
    async getMessages(query: MessageQuery): Promise<ChatMessage[]> {
        try {
            const db = await this.getDB();
            const tx = db.transaction(this.storeName, "readonly");
            const store = tx.objectStore(this.storeName);
            const index = store.index(INDEX_NAMES.DM_MESSAGES);

            let messages = await index.getAll(query.chatId);

            // Apply limit and offset if provided
            if (query.limit) {
                const offset = query.offset || 0;
                messages = messages.slice(offset, offset + query.limit);
            }

            return messages;
        } catch {
            return [];
        }
    }

    // Add message
    async addMessage(message: ChatMessage): Promise<boolean> {
        const result = await this.put(message);
        return result.success;
    }

    // Batch insert messages
    async batchInsertMessages(messages: ChatMessage[]): Promise<boolean> {
        const result = await this.batchInsert(messages);
        return result.success;
    }
}

// Thread message repository
export class ThreadMessageRepository extends BaseRepository<ThreadMessage> {
    constructor(storeName: string) {
        super(storeName);
    }

    // Get thread messages by chat ID and thread ID
    async getThreadMessages(chatId: number, threadId: number): Promise<ThreadMessage[]> {
        try {
            const db = await this.getDB();
            const tx = db.transaction(this.storeName, "readonly");
            const store = tx.objectStore(this.storeName);
            const index = store.index(INDEX_NAMES.DM_THREAD_MESSAGES_COMPOUND);
            const messages = await index.getAll([chatId, threadId]);
            return messages;
        } catch {
            return [];
        }
    }

    // Add thread message
    async addThreadMessage(message: ThreadMessage): Promise<boolean> {
        const result = await this.put(message);
        return result.success;
    }

    // Batch insert thread messages
    async batchInsertThreadMessages(messages: ThreadMessage[]): Promise<boolean> {
        const result = await this.batchInsert(messages);
        return result.success;
    }
}

// Factory for creating chat repositories
export class ChatRepositoryFactory {
    static createDMChatRepository(): ChatRepository {
        return new ChatRepository();
    }

    static createGMChatRepository(): ChatRepository {
        const repo = new ChatRepository();
        (repo as any).storeName = STORES.GM_CHATS;
        return repo;
    }

    static createPMChatRepository(): ChatRepository {
        const repo = new ChatRepository();
        (repo as any).storeName = STORES.PM_CHATS;
        return repo;
    }

    static createDMMessageRepository(): MessageRepository {
        return new MessageRepository(STORES.DM_MESSAGES);
    }

    static createGMMessageRepository(): MessageRepository {
        return new MessageRepository(STORES.GM_MESSAGES);
    }

    static createPMMessageRepository(): MessageRepository {
        return new MessageRepository(STORES.PM_MESSAGES);
    }

    static createDMThreadMessageRepository(): ThreadMessageRepository {
        return new ThreadMessageRepository(STORES.DM_THREAD_MESSAGES);
    }

    static createGMThreadMessageRepository(): ThreadMessageRepository {
        return new ThreadMessageRepository(STORES.GM_THREAD_MESSAGES);
    }

    static createPMThreadMessageRepository(): ThreadMessageRepository {
        return new ThreadMessageRepository(STORES.PM_THREAD_MESSAGES);
    }
}
