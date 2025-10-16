import {
    ChatRepository,
    ChatRepositoryFactory,
    MessageRepository,
    ThreadMessageRepository,
} from "../repositories";
import { Chat, ChatMessage, MessageQuery, ThreadMessage } from "../types";

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
    async getDMChats(): Promise<Chat[]> {
        return this.dmChatRepo.getAllChats();
    }

    // Get all GM chats
    async getGMChats(): Promise<Chat[]> {
        return this.gmChatRepo.getAllChats();
    }

    // Get all PM chats
    async getPMChats(): Promise<Chat[]> {
        return this.pmChatRepo.getAllChats();
    }

    // Get DM chat by ID
    async getDMChat(chatId: number): Promise<Chat | null> {
        return this.dmChatRepo.getChat(chatId);
    }

    // Get GM chat by ID
    async getGMChat(chatId: number): Promise<Chat | null> {
        return this.gmChatRepo.getChat(chatId);
    }

    // Get PM chat by ID
    async getPMChat(chatId: number): Promise<Chat | null> {
        return this.pmChatRepo.getChat(chatId);
    }

    // Get latest DM chat
    async getLatestDMChat(): Promise<Chat | null> {
        return this.dmChatRepo.getLatestChat();
    }

    // Get latest GM chat
    async getLatestGMChat(): Promise<Chat | null> {
        return this.gmChatRepo.getLatestChat();
    }

    // Get latest PM chat
    async getLatestPMChat(): Promise<Chat | null> {
        return this.pmChatRepo.getLatestChat();
    }

    // Get DM messages
    async getDMMessages(query: MessageQuery): Promise<ChatMessage[]> {
        return this.dmMessageRepo.getMessages(query);
    }

    // Get GM messages
    async getGMMessages(query: MessageQuery): Promise<ChatMessage[]> {
        return this.gmMessageRepo.getMessages(query);
    }

    // Get PM messages
    async getPMMessages(query: MessageQuery): Promise<ChatMessage[]> {
        return this.pmMessageRepo.getMessages(query);
    }

    // Get DM thread messages
    async getDMThreadMessages(chatId: number, threadId: number): Promise<ThreadMessage[]> {
        return this.dmThreadRepo.getThreadMessages(chatId, threadId);
    }

    // Get GM thread messages
    async getGMThreadMessages(chatId: number, threadId: number): Promise<ThreadMessage[]> {
        return this.gmThreadRepo.getThreadMessages(chatId, threadId);
    }

    // Get PM thread messages
    async getPMThreadMessages(chatId: number, threadId: number): Promise<ThreadMessage[]> {
        return this.pmThreadRepo.getThreadMessages(chatId, threadId);
    }

    // Add DM message
    async addDMMessage(message: ChatMessage): Promise<boolean> {
        return this.dmMessageRepo.addMessage(message);
    }

    // Add GM message
    async addGMMessage(message: ChatMessage): Promise<boolean> {
        return this.gmMessageRepo.addMessage(message);
    }

    // Add PM message
    async addPMMessage(message: ChatMessage): Promise<boolean> {
        return this.pmMessageRepo.addMessage(message);
    }

    // Add DM thread message
    async addDMThreadMessage(message: ThreadMessage): Promise<boolean> {
        return this.dmThreadRepo.addThreadMessage(message);
    }

    // Add GM thread message
    async addGMThreadMessage(message: ThreadMessage): Promise<boolean> {
        return this.gmThreadRepo.addThreadMessage(message);
    }

    // Add PM thread message
    async addPMThreadMessage(message: ThreadMessage): Promise<boolean> {
        return this.pmThreadRepo.addThreadMessage(message);
    }

    // Batch insert DM messages
    async batchInsertDMMessages(messages: ChatMessage[]): Promise<boolean> {
        return this.dmMessageRepo.batchInsertMessages(messages);
    }

    // Batch insert GM messages
    async batchInsertGMMessages(messages: ChatMessage[]): Promise<boolean> {
        return this.gmMessageRepo.batchInsertMessages(messages);
    }

    // Batch insert PM messages
    async batchInsertPMMessages(messages: ChatMessage[]): Promise<boolean> {
        return this.pmMessageRepo.batchInsertMessages(messages);
    }

    // Batch insert DM thread messages
    async batchInsertDMThreadMessages(messages: ThreadMessage[]): Promise<boolean> {
        return this.dmThreadRepo.batchInsertThreadMessages(messages);
    }

    // Batch insert GM thread messages
    async batchInsertGMThreadMessages(messages: ThreadMessage[]): Promise<boolean> {
        return this.gmThreadRepo.batchInsertThreadMessages(messages);
    }

    // Batch insert PM thread messages
    async batchInsertPMThreadMessages(messages: ThreadMessage[]): Promise<boolean> {
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
}
