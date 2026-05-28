import { AllChatProps, MessageProps, ThreadMessageProps } from "../../types/chat";
import {
    ChatRepository,
    ChatRepositoryFactory,
    MessageRepository,
    ThreadMessageRepository,
} from "../repositories";
import { MessageQuery } from "../types";

// Chat service for business logic related to chats
export class ChatService {
    private dmChatRepo: ChatRepository;
    private gmChatRepo: ChatRepository;
    private mdmChatRepo: ChatRepository;
    private pmChatRepo: ChatRepository;
    private dmMessageRepo: MessageRepository;
    private gmMessageRepo: MessageRepository;
    private mdmMessageRepo: MessageRepository;
    private pmMessageRepo: MessageRepository;
    private dmThreadRepo: ThreadMessageRepository;
    private gmThreadRepo: ThreadMessageRepository;
    private mdmThreadRepo: ThreadMessageRepository;
    private pmThreadRepo: ThreadMessageRepository;

    constructor() {
        this.dmChatRepo = ChatRepositoryFactory.createDMChatRepository();
        this.gmChatRepo = ChatRepositoryFactory.createGMChatRepository();
        this.mdmChatRepo = ChatRepositoryFactory.createMDMChatRepository();
        this.pmChatRepo = ChatRepositoryFactory.createPMChatRepository();
        this.dmMessageRepo = ChatRepositoryFactory.createDMMessageRepository();
        this.gmMessageRepo = ChatRepositoryFactory.createGMMessageRepository();
        this.mdmMessageRepo = ChatRepositoryFactory.createMDMMessageRepository();
        this.pmMessageRepo = ChatRepositoryFactory.createPMMessageRepository();
        this.dmThreadRepo = ChatRepositoryFactory.createDMThreadMessageRepository();
        this.gmThreadRepo = ChatRepositoryFactory.createGMThreadMessageRepository();
        this.mdmThreadRepo = ChatRepositoryFactory.createMDMThreadMessageRepository();
        this.pmThreadRepo = ChatRepositoryFactory.createPMThreadMessageRepository();
    }

    // Get all DM chats
    async getDMChats(): Promise<AllChatProps[]> {
        return this.dmChatRepo.getAllChats();
    }

    // Get all GM chats
    async getGMChats(): Promise<AllChatProps[]> {
        return this.gmChatRepo.getAllChats();
    }

    // Get all MDM chats
    async getMDMChats(): Promise<AllChatProps[]> {
        return this.mdmChatRepo.getAllChats();
    }

    // Get all PM chats
    async getPMChats(): Promise<AllChatProps[]> {
        return this.pmChatRepo.getAllChats();
    }

    // Get DM chat by ID
    async getDMChat(chatId: number): Promise<AllChatProps | null> {
        return this.dmChatRepo.getChat(chatId);
    }

    // Get GM chat by ID
    async getGMChat(chatId: number): Promise<AllChatProps | null> {
        return this.gmChatRepo.getChat(chatId);
    }

    // Get MDM chat by ID
    async getMDMChat(chatId: number): Promise<AllChatProps | null> {
        return this.mdmChatRepo.getChat(chatId);
    }

    // Get PM chat by ID
    async getPMChat(chatId: number): Promise<AllChatProps | null> {
        return this.pmChatRepo.getChat(chatId);
    }

    // Get latest DM chat
    async getLatestDMChat(): Promise<AllChatProps | null> {
        return this.dmChatRepo.getLatestChat(1);
    }

    // Get latest GM chat
    async getLatestGMChat(): Promise<AllChatProps | null> {
        return this.gmChatRepo.getLatestChat(2);
    }

    // Get latest MDM chat
    async getLatestMDMChat(): Promise<AllChatProps | null> {
        return this.mdmChatRepo.getLatestChat(4);
    }

    // Get latest PM chat
    async getLatestPMChat(): Promise<AllChatProps | null> {
        return this.pmChatRepo.getLatestChat(3);
    }

    // Get DM messages
    async getDMMessages(query: MessageQuery): Promise<MessageProps[]> {
        return this.dmMessageRepo.getMessages(query);
    }

    // Get GM messages
    async getGMMessages(query: MessageQuery): Promise<MessageProps[]> {
        return this.gmMessageRepo.getMessages(query);
    }

    // Get MDM messages
    async getMDMMessages(query: MessageQuery): Promise<MessageProps[]> {
        return this.mdmMessageRepo.getMessages(query);
    }

    // Get PM messages
    async getPMMessages(query: MessageQuery): Promise<MessageProps[]> {
        return this.pmMessageRepo.getMessages(query);
    }

    // Get DM thread messages
    async getDMThreadMessages(chatId: number, threadId: number): Promise<ThreadMessageProps[]> {
        return this.dmThreadRepo.getThreadMessages(1, chatId, threadId);
    }

    // Get GM thread messages
    async getGMThreadMessages(chatId: number, threadId: number): Promise<ThreadMessageProps[]> {
        return this.gmThreadRepo.getThreadMessages(2, chatId, threadId);
    }

    // Get PM thread messages
    async getPMThreadMessages(chatId: number, threadId: number): Promise<ThreadMessageProps[]> {
        return this.pmThreadRepo.getThreadMessages(3, chatId, threadId);
    }

    // Add DM message
    async addDMMessage(message: MessageProps): Promise<boolean> {
        return this.dmMessageRepo.addMessage(message);
    }

    // Add GM message
    async addGMMessage(message: MessageProps): Promise<boolean> {
        return this.gmMessageRepo.addMessage(message);
    }

    // Add PM message
    async addPMMessage(message: MessageProps): Promise<boolean> {
        return this.pmMessageRepo.addMessage(message);
    }

    // Add DM thread message
    async addDMThreadMessage(message: ThreadMessageProps): Promise<boolean> {
        return this.dmThreadRepo.addThreadMessage(message);
    }

    // Add GM thread message
    async addGMThreadMessage(message: ThreadMessageProps): Promise<boolean> {
        return this.gmThreadRepo.addThreadMessage(message);
    }

    // Add PM thread message
    async addPMThreadMessage(message: ThreadMessageProps): Promise<boolean> {
        return this.pmThreadRepo.addThreadMessage(message);
    }

    // Batch insert DM messages
    async batchInsertDMMessages(messages: MessageProps[]): Promise<boolean> {
        return this.dmMessageRepo.batchInsertMessages(messages);
    }

    // Batch insert GM messages
    async batchInsertGMMessages(messages: MessageProps[]): Promise<boolean> {
        return this.gmMessageRepo.batchInsertMessages(messages);
    }

    // Batch insert MDM messages
    async batchInsertMDMMessages(messages: MessageProps[]): Promise<boolean> {
        return this.mdmMessageRepo.batchInsertMessages(messages);
    }

    // Batch insert PM messages
    async batchInsertPMMessages(messages: MessageProps[]): Promise<boolean> {
        return this.pmMessageRepo.batchInsertMessages(messages);
    }

    // Batch insert DM thread messages
    async batchInsertDMThreadMessages(messages: ThreadMessageProps[]): Promise<boolean> {
        return this.dmThreadRepo.batchInsertThreadMessages(messages);
    }

    // Batch insert GM thread messages
    async batchInsertGMThreadMessages(messages: ThreadMessageProps[]): Promise<boolean> {
        return this.gmThreadRepo.batchInsertThreadMessages(messages);
    }

    // Batch insert MDM thread messages
    async batchInsertMDMThreadMessages(messages: ThreadMessageProps[]): Promise<boolean> {
        return this.mdmThreadRepo.batchInsertThreadMessages(messages);
    }

    // Batch insert PM thread messages
    async batchInsertPMThreadMessages(messages: ThreadMessageProps[]): Promise<boolean> {
        return this.pmThreadRepo.batchInsertThreadMessages(messages);
    }

    // Check if DM chat exists
    async isKnownDMChat(chatId: number): Promise<boolean> {
        return this.dmChatRepo.exists(chatId);
    }

    // Check if GM chat exists
    async isKnownGMChat(chatId: number): Promise<boolean> {
        return this.gmChatRepo.exists(chatId);
    }

    // Check if MDM chat exists
    async isKnownMDMChat(chatId: number): Promise<boolean> {
        return this.mdmChatRepo.exists(chatId);
    }

    // Check if PM chat exists
    async isKnownPMChat(chatId: number): Promise<boolean> {
        return this.pmChatRepo.exists(chatId);
    }

    // Delete DM message
    async deleteDMMessage(chatId: number, messageId: number): Promise<boolean> {
        const key = `${chatId}-${messageId}`;
        const result = await this.dmMessageRepo.delete(key);
        return result.success;
    }

    // Delete GM message
    async deleteGMMessage(chatId: number, messageId: number): Promise<boolean> {
        const key = `${chatId}-${messageId}`;
        const result = await this.gmMessageRepo.delete(key);
        return result.success;
    }

    // Delete PM message
    async deletePMMessage(chatId: number, messageId: number, taskId?: number): Promise<boolean> {
        const key = taskId ? `${chatId}-${taskId}-${messageId}` : `${chatId}-${messageId}`;
        const result = await this.pmMessageRepo.delete(key);
        return result.success;
    }

    async deleteMDMMessage(chatId: number, messageId: number): Promise<boolean> {
        const key = `${chatId}-${messageId}`;
        const result = await this.mdmMessageRepo.delete(key);
        return result.success;
    }

    // Delete DM thread message
    async deleteDMThreadMessage(chatId: number, messageId: number): Promise<boolean> {
        const key = `${chatId}-${messageId}`;
        const result = await this.dmThreadRepo.delete(key);
        return result.success;
    }

    // Delete GM thread message
    async deleteGMThreadMessage(chatId: number, messageId: number): Promise<boolean> {
        const key = `${chatId}-${messageId}`;
        const result = await this.gmThreadRepo.delete(key);
        return result.success;
    }

    // Delete MDM thread message
    async deleteMDMThreadMessage(chatId: number, messageId: number): Promise<boolean> {
        const key = `${chatId}-${messageId}`;
        const result = await this.mdmThreadRepo.delete(key);
        return result.success;
    }

    // Delete PM thread message
    async deletePMThreadMessage(chatId: number, messageId: number): Promise<boolean> {
        const key = `${chatId}-${messageId}`;
        const result = await this.pmThreadRepo.delete(key);
        return result.success;
    }

    // Wipe every row for a single GM/PM chat from IDB — used after the
    // user leaves the group/project so the chat (and all its messages /
    // threads) doesn't linger in cache. We delete the chat-list row,
    // every message via the per-chat index, and every thread message
    // the same way. DM is intentionally excluded — leaving a DM isn't
    // a thing in this app. Failures are swallowed to keep leave UX
    // smooth; worst case a stale row sits in IDB until the next sync.
    async deleteGMChatData(chatId: number): Promise<void> {
        try {
            await this.gmChatRepo.delete(chatId);
            const messages = await this.gmMessageRepo.getMessagesByChatId(2, chatId);
            await Promise.all(
                // Key shape mirrors `deleteGMMessage` above. The stored
                // `messageIdWithChatId` field is typed optional, so we
                // rebuild from `chatId-messageId` to stay type-safe.
                messages.map((m) => this.gmMessageRepo.delete(`${chatId}-${m.messageId}`))
            );
            // Thread messages live in a separate store keyed by
            // `${chatId}-${messageId}` (matches `deleteGMThreadMessage`).
            // `getThreadMessages` takes a threadId, so sweep the thread
            // ids surfaced by parent messages with replies — bounded by
            // how many threads existed, which is small.
            const threadIds = Array.from(
                new Set(messages.filter((m) => (m.numReplies ?? 0) > 0).map((m) => m.messageId))
            );
            for (const threadId of threadIds) {
                const tms = await this.gmThreadRepo.getThreadMessages(2, chatId, threadId);
                await Promise.all(
                    tms.map((tm) => this.gmThreadRepo.delete(`${chatId}-${tm.messageId}`))
                );
            }
        } catch {
            /* best-effort; stale rows will be overwritten by next sync */
        }
    }

    async deletePMChatData(chatId: number): Promise<void> {
        try {
            await this.pmChatRepo.delete(chatId);
            const messages = await this.pmMessageRepo.getMessagesByChatId(3, chatId);
            await Promise.all(
                // PM message keys are `${chatId}-${taskId}-${messageId}`
                // when the message is task-linked, else `${chatId}-${messageId}`.
                // Mirrors `deletePMMessage` above.
                messages.map((m) =>
                    this.pmMessageRepo.delete(
                        m.taskId != null
                            ? `${chatId}-${m.taskId}-${m.messageId}`
                            : `${chatId}-${m.messageId}`
                    )
                )
            );
            const threadIds = Array.from(
                new Set(messages.filter((m) => (m.numReplies ?? 0) > 0).map((m) => m.messageId))
            );
            for (const threadId of threadIds) {
                const tms = await this.pmThreadRepo.getThreadMessages(3, chatId, threadId);
                await Promise.all(
                    tms.map((tm) => this.pmThreadRepo.delete(`${chatId}-${tm.messageId}`))
                );
            }
        } catch {
            /* best-effort; stale rows will be overwritten by next sync */
        }
    }
}
