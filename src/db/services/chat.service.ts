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
    private pmChatRepo: ChatRepository;
    private dmMessageRepo: MessageRepository;
    private gmMessageRepo: MessageRepository;
    private pmMessageRepo: MessageRepository;
    private dmThreadRepo: ThreadMessageRepository;
    private gmThreadRepo: ThreadMessageRepository;
    private pmThreadRepo: ThreadMessageRepository;

    constructor() {
        this.dmChatRepo = ChatRepositoryFactory.createDMChatRepository();
        this.gmChatRepo = ChatRepositoryFactory.createGMChatRepository();
        this.pmChatRepo = ChatRepositoryFactory.createPMChatRepository();
        this.dmMessageRepo = ChatRepositoryFactory.createDMMessageRepository();
        this.gmMessageRepo = ChatRepositoryFactory.createGMMessageRepository();
        this.pmMessageRepo = ChatRepositoryFactory.createPMMessageRepository();
        this.dmThreadRepo = ChatRepositoryFactory.createDMThreadMessageRepository();
        this.gmThreadRepo = ChatRepositoryFactory.createGMThreadMessageRepository();
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

    // Delete PM thread message
    async deletePMThreadMessage(chatId: number, messageId: number): Promise<boolean> {
        const key = `${chatId}-${messageId}`;
        const result = await this.pmThreadRepo.delete(key);
        return result.success;
    }
}
