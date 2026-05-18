import { ChatNoteProps, MyNoteProps, TaskNoteProps } from "../../types/notes";
import { INDEX_NAMES, STORES } from "../config";
import { NoteQuery } from "../types";
import { BaseRepository } from "./base";

// Maps a note storeName → the index name used to look up by owner.
const OWNER_INDEX_BY_STORE: Record<string, string> = {
    [STORES.PERSONAL_NOTES]: INDEX_NAMES.PERSONAL_NOTES_OWNER,
    [STORES.TASK_NOTES]: INDEX_NAMES.TASK_NOTES_OWNER,
    [STORES.CHAT_NOTES]: INDEX_NAMES.CHAT_NOTES_OWNER,
};

// Maps a note storeName → (index name, key field) used for the optional
// `relatedId` filter. `relatedId` is the task-id for task notes and the
// chat-id for chat notes. Personal notes have no related entity.
const RELATED_INDEX_BY_STORE: Record<
    string,
    { index: string; field: keyof TaskNoteProps | keyof ChatNoteProps }
> = {
    [STORES.TASK_NOTES]: { index: INDEX_NAMES.TASK_NOTES_TASK, field: "taskId" },
    [STORES.CHAT_NOTES]: { index: INDEX_NAMES.CHAT_NOTES_CHAT, field: "chatId" },
};

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

    // Get notes by query, using indexes instead of scanning every row.
    //
    // Routing:
    //   - When `relatedId` is supplied for task/chat notes, range over the
    //     related-id index (smallest match set; few notes per task/chat).
    //   - Otherwise, range over the owner index (typical case for the
    //     per-user note lists rendered in the sidebar).
    //
    // The narrow result is then filtered for the secondary predicates
    // (`noteType` is always implied by the storeName, but kept for
    // defensive consistency with legacy data).
    async getNotes(query: NoteQuery): Promise<MyNoteProps[] | TaskNoteProps[] | ChatNoteProps[]> {
        try {
            const db = await this.getDB();
            const tx = db.transaction(this.storeName, "readonly");
            const store = tx.objectStore(this.storeName);

            const relatedMapping = RELATED_INDEX_BY_STORE[this.storeName];
            let rows: any[] = [];

            if (query.relatedId !== undefined && query.relatedId !== null && relatedMapping) {
                rows = await store.index(relatedMapping.index).getAll(query.relatedId);
            } else if (query.userId) {
                const ownerIndex = OWNER_INDEX_BY_STORE[this.storeName];
                rows = ownerIndex
                    ? await store.index(ownerIndex).getAll(query.userId)
                    : await store.getAll();
            } else {
                rows = await store.getAll();
            }

            return rows.filter((note) => {
                if (note.noteType !== query.noteType) return false;
                if (query.userId && note.ownerId !== query.userId) return false;
                if (
                    query.relatedId !== undefined &&
                    query.relatedId !== null &&
                    relatedMapping &&
                    note[relatedMapping.field] !== query.relatedId
                ) {
                    return false;
                }
                return true;
            });
        } catch {
            return [];
        }
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
