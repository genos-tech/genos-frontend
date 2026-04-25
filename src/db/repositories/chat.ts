import { AllChatProps, MessageProps, ThreadMessageProps } from "../../types/chat";
import { INDEX_NAMES, STORES } from "../config";
import { MessageQuery } from "../types";
import { BaseRepository } from "./base";

const ChatIndexMap = {
    1: INDEX_NAMES.DM_CHATS,
    2: INDEX_NAMES.GM_CHATS,
    3: INDEX_NAMES.PM_CHATS,
    4: INDEX_NAMES.MDM_CHATS,
};

const MessageIndexMap = {
    1: INDEX_NAMES.DM_MESSAGES,
    2: INDEX_NAMES.GM_MESSAGES,
    3: INDEX_NAMES.PM_MESSAGES,
    4: INDEX_NAMES.MDM_MESSAGES,
};

const MessageCompoundIndexMap = {
    1: INDEX_NAMES.DM_MESSAGES_COMPOUND,
    2: INDEX_NAMES.GM_MESSAGES_COMPOUND,
    3: INDEX_NAMES.PM_MESSAGES_COMPOUND,
    4: INDEX_NAMES.MDM_MESSAGES_COMPOUND,
};

const ThreadMessageIndexMap = {
    1: INDEX_NAMES.DM_THREAD_MESSAGES,
    2: INDEX_NAMES.GM_THREAD_MESSAGES,
    3: INDEX_NAMES.PM_THREAD_MESSAGES,
    4: INDEX_NAMES.MDM_THREAD_MESSAGES,
};

const ThreadMessageCompoundIndexMap = {
    1: INDEX_NAMES.DM_THREAD_MESSAGES_COMPOUND,
    2: INDEX_NAMES.GM_THREAD_MESSAGES_COMPOUND,
    3: INDEX_NAMES.PM_THREAD_MESSAGES_COMPOUND,
    4: INDEX_NAMES.MDM_THREAD_MESSAGES_COMPOUND,
};

// Chat repository for managing chat-related data
export class ChatRepository extends BaseRepository<AllChatProps> {
    constructor(storeName: string) {
        super(storeName);
    }

    // Get chat by ID
    async getChat(chatId: number): Promise<AllChatProps | null> {
        const result = await this.get(chatId);
        return result.success && result.data ? result.data : null;
    }

    // Get all chats
    async getAllChats(): Promise<AllChatProps[]> {
        const result = await this.getAll();
        return result.success && result.data ? result.data : [];
    }

    // Get latest chat
    async getLatestChat(chatType: number): Promise<AllChatProps | null> {
        try {
            const db = await this.getDB();
            const tx = db.transaction(this.storeName, "readonly");
            const store = tx.objectStore(this.storeName);
            const index = store.index(ChatIndexMap[chatType as keyof typeof ChatIndexMap]);
            const cursor = await index.openCursor(null, "prev");
            return cursor ? cursor.value : null;
        } catch {
            return null;
        }
    }

    // Update chat
    async updateChat(chat: AllChatProps): Promise<boolean> {
        const result = await this.put(chat);
        return result.success;
    }
}

// Message repository for managing chat messages
export class MessageRepository extends BaseRepository<MessageProps> {
    constructor(storeName: string) {
        super(storeName);
    }

    // Get messages by chat ID
    async getMessagesByChatId(chatType: number, chatId: number): Promise<MessageProps[]> {
        try {
            const db = await this.getDB();
            const tx = db.transaction(this.storeName, "readonly");
            const store = tx.objectStore(this.storeName);
            const index = store.index(MessageIndexMap[chatType as keyof typeof MessageIndexMap]);
            const messages = await index.getAll(chatId);
            return messages;
        } catch {
            return [];
        }
    }

    // Get messages with query parameters
    async getMessages(query: MessageQuery): Promise<MessageProps[]> {
        try {
            const db = await this.getDB();
            const tx = db.transaction(this.storeName, "readonly");
            const store = tx.objectStore(this.storeName);
            const index = store.index(
                MessageIndexMap[query.chatType as keyof typeof MessageIndexMap]
            );

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
    async addMessage(message: MessageProps): Promise<boolean> {
        const result = await this.put(message);
        return result.success;
    }

    // Batch insert messages
    async batchInsertMessages(messages: MessageProps[]): Promise<boolean> {
        const result = await this.batchInsert(messages);
        return result.success;
    }
}

// Thread message repository
export class ThreadMessageRepository extends BaseRepository<ThreadMessageProps> {
    constructor(storeName: string) {
        super(storeName);
    }

    // Get thread messages by chat ID and thread ID
    async getThreadMessages(
        chatType: number,
        chatId: number,
        threadId: number
    ): Promise<ThreadMessageProps[]> {
        try {
            const db = await this.getDB();
            const tx = db.transaction(this.storeName, "readonly");
            const store = tx.objectStore(this.storeName);
            const index = store.index(
                ThreadMessageIndexMap[chatType as keyof typeof ThreadMessageIndexMap]
            );
            const messages = await index.getAll([chatId, threadId]);
            return messages;
        } catch {
            return [];
        }
    }

    // Add thread message
    async addThreadMessage(message: ThreadMessageProps): Promise<boolean> {
        const result = await this.put(message);
        return result.success;
    }

    // Batch insert thread messages
    async batchInsertThreadMessages(messages: ThreadMessageProps[]): Promise<boolean> {
        const result = await this.batchInsert(messages);
        return result.success;
    }
}

// Factory for creating chat repositories
export class ChatRepositoryFactory {
    static createDMChatRepository(): ChatRepository {
        return new ChatRepository(STORES.DM_CHATS);
    }

    static createGMChatRepository(): ChatRepository {
        const repo = new ChatRepository(STORES.GM_CHATS);
        (repo as any).storeName = STORES.GM_CHATS;
        return repo;
    }

    static createMDMChatRepository(): ChatRepository {
        const repo = new ChatRepository(STORES.MDM_CHATS);
        (repo as any).storeName = STORES.MDM_CHATS;
        return repo;
    }

    static createPMChatRepository(): ChatRepository {
        const repo = new ChatRepository(STORES.PM_CHATS);
        (repo as any).storeName = STORES.PM_CHATS;
        return repo;
    }

    static createDMMessageRepository(): MessageRepository {
        return new MessageRepository(STORES.DM_MESSAGES);
    }

    static createGMMessageRepository(): MessageRepository {
        return new MessageRepository(STORES.GM_MESSAGES);
    }

    static createMDMMessageRepository(): MessageRepository {
        return new MessageRepository(STORES.MDM_MESSAGES);
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

    static createMDMThreadMessageRepository(): ThreadMessageRepository {
        return new ThreadMessageRepository(STORES.MDM_THREAD_MESSAGES);
    }

    static createPMThreadMessageRepository(): ThreadMessageRepository {
        return new ThreadMessageRepository(STORES.PM_THREAD_MESSAGES);
    }
}
