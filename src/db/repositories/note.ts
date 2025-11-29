import { ChatNoteProps, MyNoteProps, TaskNoteProps } from "../../types/notes";
import { STORES } from "../config";
import { NoteQuery } from "../types";
import { BaseRepository } from "./base";

// Note repository for managing note data
export class NoteRepository extends BaseRepository<MyNoteProps | TaskNoteProps | ChatNoteProps> {
    constructor(storeName: string) {
        super(storeName);
    }

    // Get note by ID
    async getMyNote(noteId: number): Promise<MyNoteProps | null> {
        const result = await this.get(noteId);
        return result.success && result.data ? result.data : null;
    }

    // Get task note by ID
    async getTaskNote(noteId: number): Promise<TaskNoteProps | null> {
        const result = await this.get(noteId);
        if (
            result.success &&
            result.data &&
            "projectId" in result.data &&
            "taskId" in result.data
        ) {
            return result.data as TaskNoteProps;
        }
        return null;
    }

    // Get chat note by ID
    async getChatNote(noteId: number): Promise<ChatNoteProps | null> {
        const result = await this.get(noteId);
        if (
            result.success &&
            result.data &&
            "chatType" in result.data &&
            "chatId" in result.data &&
            "isThread" in result.data &&
            "threadId" in result.data
        ) {
            return result.data as ChatNoteProps;
        }
        return null;
    }

    // Get all notes
    async getAllNotes(): Promise<MyNoteProps[] | TaskNoteProps[] | ChatNoteProps[]> {
        const result = await this.getAll();
        return result.success && result.data ? result.data : [];
    }

    // Get notes by query
    async getNotes(query: NoteQuery): Promise<MyNoteProps[] | TaskNoteProps[] | ChatNoteProps[]> {
        const allNotes = await this.getAllNotes();
        return allNotes.filter((note) => {
            if (note.noteType !== query.noteType) return false;
            if (note.ownerId !== query.userId) return false;
            if (query.relatedId && note.noteId !== query.relatedId) return false;
            return true;
        });
    }

    // Batch insert notes
    async batchInsertNotes(
        notes: MyNoteProps[] | TaskNoteProps[] | ChatNoteProps[]
    ): Promise<boolean> {
        const result = await this.batchInsert(notes);
        return result.success;
    }

    // Add or update note
    async saveNote(note: MyNoteProps | TaskNoteProps | ChatNoteProps): Promise<boolean> {
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
