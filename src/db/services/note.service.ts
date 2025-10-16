import { NoteRepository, NoteRepositoryFactory } from "../repositories";
import { Note, NoteQuery } from "../types";

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
    async getPersonalNote(noteId: number): Promise<Note | null> {
        return this.personalNoteRepo.getNote(noteId);
    }

    // Get task note by ID
    async getTaskNote(noteId: number): Promise<Note | null> {
        return this.taskNoteRepo.getNote(noteId);
    }

    // Get chat note by ID
    async getChatNote(noteId: number): Promise<Note | null> {
        return this.chatNoteRepo.getNote(noteId);
    }

    // Get all personal notes
    async getAllPersonalNotes(): Promise<Note[]> {
        return this.personalNoteRepo.getAllNotes();
    }

    // Get all task notes
    async getAllTaskNotes(): Promise<Note[]> {
        return this.taskNoteRepo.getAllNotes();
    }

    // Get all chat notes
    async getAllChatNotes(): Promise<Note[]> {
        return this.chatNoteRepo.getAllNotes();
    }

    // Get personal notes by user
    async getPersonalNotesByUser(userId: string): Promise<Note[]> {
        return this.personalNoteRepo.getNotes({ type: "personal", userId });
    }

    // Get task notes by user
    async getTaskNotesByUser(userId: string): Promise<Note[]> {
        return this.taskNoteRepo.getNotes({ type: "task", userId });
    }

    // Get chat notes by user
    async getChatNotesByUser(userId: string): Promise<Note[]> {
        return this.chatNoteRepo.getNotes({ type: "chat", userId });
    }

    // Get task notes by task ID
    async getTaskNotesByTaskId(taskId: number): Promise<Note[]> {
        return this.taskNoteRepo.getNotes({ type: "task", userId: "", relatedId: taskId });
    }

    // Get chat notes by chat ID
    async getChatNotesByChatId(chatId: number): Promise<Note[]> {
        return this.chatNoteRepo.getNotes({ type: "chat", userId: "", relatedId: chatId });
    }

    // Add or update personal note
    async savePersonalNote(note: Note): Promise<boolean> {
        return this.personalNoteRepo.saveNote(note);
    }

    // Add or update task note
    async saveTaskNote(note: Note): Promise<boolean> {
        return this.taskNoteRepo.saveNote(note);
    }

    // Add or update chat note
    async saveChatNote(note: Note): Promise<boolean> {
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

    // Search notes by content
    async searchNotesByContent(
        searchTerm: string,
        type?: "personal" | "task" | "chat"
    ): Promise<Note[]> {
        const allNotes: Note[] = [];

        if (!type || type === "personal") {
            allNotes.push(...(await this.getAllPersonalNotes()));
        }
        if (!type || type === "task") {
            allNotes.push(...(await this.getAllTaskNotes()));
        }
        if (!type || type === "chat") {
            allNotes.push(...(await this.getAllChatNotes()));
        }

        return allNotes.filter(
            (note) =>
                note.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                note.content.toLowerCase().includes(searchTerm.toLowerCase())
        );
    }

    // Get notes by date range
    async getNotesByDateRange(
        startDate: number,
        endDate: number,
        type?: "personal" | "task" | "chat"
    ): Promise<Note[]> {
        const allNotes: Note[] = [];

        if (!type || type === "personal") {
            allNotes.push(...(await this.getAllPersonalNotes()));
        }
        if (!type || type === "task") {
            allNotes.push(...(await this.getAllTaskNotes()));
        }
        if (!type || type === "chat") {
            allNotes.push(...(await this.getAllChatNotes()));
        }

        return allNotes.filter((note) => note.createdAt >= startDate && note.createdAt <= endDate);
    }

    // Get all notes for a user
    async getAllNotesForUser(userId: string): Promise<Note[]> {
        const personalNotes = await this.getPersonalNotesByUser(userId);
        const taskNotes = await this.getTaskNotesByUser(userId);
        const chatNotes = await this.getChatNotesByUser(userId);

        return [...personalNotes, ...taskNotes, ...chatNotes].sort(
            (a, b) => b.createdAt - a.createdAt
        );
    }
}
