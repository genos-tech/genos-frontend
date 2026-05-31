import { ChatNoteProps, MyNoteProps, TaskNoteProps } from "../../types/notes";
import { NoteRepository, NoteRepositoryFactory } from "../repositories";

// Note service for business logic related to notes
export class NoteService {
    private personalNoteRepo: NoteRepository;
    private taskNoteRepo: NoteRepository;
    private chatNoteRepo: NoteRepository;

    constructor() {
        this.personalNoteRepo = NoteRepositoryFactory.createPersonalNoteRepository();
        this.taskNoteRepo = NoteRepositoryFactory.createTaskNoteRepository();
        this.chatNoteRepo = NoteRepositoryFactory.createChatNoteRepository();
    }

    // Get personal note by ID
    async getPersonalNote(noteId: number): Promise<MyNoteProps | null> {
        return this.personalNoteRepo.getMyNote(noteId);
    }

    // Get task note by ID
    async getTaskNote(noteId: number): Promise<TaskNoteProps | null> {
        return this.taskNoteRepo.getTaskNote(noteId);
    }

    // Get chat note by ID
    async getChatNote(noteId: number): Promise<ChatNoteProps | null> {
        return this.chatNoteRepo.getChatNote(noteId);
    }

    // Get all personal notes
    async getAllPersonalNotes(): Promise<MyNoteProps[]> {
        return this.personalNoteRepo.getAllNotes();
    }

    // Get all task notes
    async getAllTaskNotes(): Promise<any[]> {
        return this.taskNoteRepo.getAllNotes();
    }

    // Get all chat notes
    async getAllChatNotes(): Promise<any[]> {
        return this.chatNoteRepo.getAllNotes();
    }

    // Get personal notes by user
    async getPersonalNotesByUser(userId: string): Promise<MyNoteProps[]> {
        return this.personalNoteRepo.getNotes({ noteType: 1, userId });
    }

    // Get task notes by user
    async getTaskNotesByUser(userId: string): Promise<TaskNoteProps[]> {
        const notes = await this.taskNoteRepo.getNotes({ noteType: 2, userId });
        return notes as TaskNoteProps[];
    }

    // Get chat notes by user
    async getChatNotesByUser(userId: string): Promise<ChatNoteProps[]> {
        const notes = await this.chatNoteRepo.getNotes({ noteType: 3, userId });
        return notes as ChatNoteProps[];
    }

    // Get task notes by task ID
    async getTaskNotesByTaskId(taskId: number): Promise<TaskNoteProps[]> {
        const notes = await this.taskNoteRepo.getNotes({
            noteType: 2,
            userId: "",
            relatedId: taskId,
        });
        return notes as TaskNoteProps[];
    }

    // Get chat notes by chat ID
    async getChatNotesByChatId(chatId: number): Promise<ChatNoteProps[]> {
        const notes = await this.chatNoteRepo.getNotes({
            noteType: 3,
            userId: "",
            relatedId: chatId,
        });
        return notes as ChatNoteProps[];
    }

    // Batch insert personal notes
    async batchInsertPersonalNotes(notes: MyNoteProps[]): Promise<boolean> {
        return this.personalNoteRepo.batchInsertNotes(notes);
    }

    // Batch insert task notes
    async batchInsertTaskNotes(notes: TaskNoteProps[]): Promise<boolean> {
        return this.taskNoteRepo.batchInsertNotes(notes);
    }

    // Batch insert chat notes
    async batchInsertChatNotes(notes: ChatNoteProps[]): Promise<boolean> {
        return this.chatNoteRepo.batchInsertNotes(notes);
    }

    // Add or update personal note
    async savePersonalNote(note: MyNoteProps): Promise<boolean> {
        return this.personalNoteRepo.saveNote(note);
    }

    // Add or update task note
    async saveTaskNote(note: TaskNoteProps): Promise<boolean> {
        return this.taskNoteRepo.saveNote(note);
    }

    // Add or update chat note
    async saveChatNote(note: ChatNoteProps): Promise<boolean> {
        return this.chatNoteRepo.saveNote(note);
    }

    // Delete personal note
    async deletePersonalNote(noteId: number): Promise<boolean> {
        return this.personalNoteRepo.deleteNote(noteId);
    }

    // Delete task note
    async deleteTaskNote(noteId: number): Promise<boolean> {
        return this.taskNoteRepo.deleteNote(noteId);
    }

    // Delete chat note
    async deleteChatNote(noteId: number): Promise<boolean> {
        return this.chatNoteRepo.deleteNote(noteId);
    }

    // Check if personal note exists
    async personalNoteExists(noteId: number): Promise<boolean> {
        return this.personalNoteRepo.noteExists(noteId);
    }

    // Check if task note exists
    async taskNoteExists(noteId: number): Promise<boolean> {
        return this.taskNoteRepo.noteExists(noteId);
    }

    // Check if chat note exists
    async chatNoteExists(noteId: number): Promise<boolean> {
        return this.chatNoteRepo.noteExists(noteId);
    }

    // Get all notes for a user
    async getAllNotesForUser(userId: string): Promise<any[]> {
        const personalNotes = await this.getPersonalNotesByUser(userId);
        const taskNotes = await this.getTaskNotesByUser(userId);
        const chatNotes = await this.getChatNotesByUser(userId);

        return [...personalNotes, ...taskNotes, ...chatNotes].sort(
            (a, b) => new Date(b.tsCreated).getTime() - new Date(a.tsCreated).getTime()
        );
    }
}
