import { STORES } from "../config";
import { Note, NoteQuery } from "../types";
import { BaseRepository } from "./base";

// Note repository for managing note data
export class NoteRepository extends BaseRepository<Note> {
    constructor(storeName: string) {
        super(storeName);
    }

    // Get note by ID
    async getNote(noteId: number): Promise<Note | null> {
        const result = await this.get(noteId);
        return result.success && result.data ? result.data : null;
    }

    // Get all notes
    async getAllNotes(): Promise<Note[]> {
        const result = await this.getAll();
        return result.success && result.data ? result.data : [];
    }

    // Get notes by query
    async getNotes(query: NoteQuery): Promise<Note[]> {
        const allNotes = await this.getAllNotes();
        return allNotes.filter((note) => {
            if (note.type !== query.type) return false;
            if (note.userId !== query.userId) return false;
            if (query.relatedId && note.relatedId !== query.relatedId) return false;
            return true;
        });
    }

    // Add or update note
    async saveNote(note: Note): Promise<boolean> {
        const result = await this.put(note);
        return result.success;
    }

    // Delete note
    async deleteNote(noteId: number): Promise<boolean> {
        const result = await this.delete(noteId);
        return result.success;
    }

    // Check if note exists
    async noteExists(noteId: number): Promise<boolean> {
        return this.exists(noteId);
    }
}

// Factory for creating note repositories
export class NoteRepositoryFactory {
    static createPersonalNoteRepository(): NoteRepository {
        return new NoteRepository(STORES.PERSONAL_NOTES);
    }

    static createTaskNoteRepository(): NoteRepository {
        return new NoteRepository(STORES.TASK_NOTES);
    }

    static createChatNoteRepository(): NoteRepository {
        return new NoteRepository(STORES.CHAT_NOTES);
    }
}
