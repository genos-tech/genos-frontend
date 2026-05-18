// Notes-channel handlers. Consolidates the 3 single-purpose note workers
// (addNote, checkNoteExists, loadAllNotes).

import { loadAllChatNotes } from "../../../features/notes/chat-notes/services/loadAllChatNotes";
import { loadAllMyNotes } from "../../../features/notes/my-notes/services/loadAllMyNotes";
import { loadAllTaskNotes } from "../../../features/notes/task-notes/services/loadAllTaskNotes";
import type { ChatNoteProps, MyNoteProps, TaskNoteProps } from "../../../types/notes";
import { NoteRepositoryFactory } from "../../repositories";
import { NoteService } from "../../services";
import type { NotesRequests } from "../contracts";
import type { HandlerMap } from "../poolWorker";

const BATCH_SIZE = 1000;

// Shared service instance — the old loadAllNotesWorker allocated a fresh
// `new NoteService()` for every 1000-row batch (three loops, so 3× per type).
const noteService = new NoteService();

export const notesHandlers: HandlerMap<NotesRequests> = {
    addNote: async ({ note, noteType }) => {
        if (noteType === 1) {
            const repo = NoteRepositoryFactory.createPersonalNoteRepository();
            await repo.put(note);
        } else if (noteType === 2) {
            const repo = NoteRepositoryFactory.createTaskNoteRepository();
            await repo.put(note);
        } else if (noteType === 3) {
            const repo = NoteRepositoryFactory.createChatNoteRepository();
            await repo.put(note);
        }
    },

    checkNoteExists: async ({ noteId, noteType }) => {
        if (noteType === 1) return noteService.personalNoteExists(noteId);
        if (noteType === 2) return noteService.taskNoteExists(noteId);
        if (noteType === 3) return noteService.chatNoteExists(noteId);
        return false;
    },

    loadAllNotes: async ({ myself, accessToken }) => {
        const personalRepo = NoteRepositoryFactory.createPersonalNoteRepository();
        const taskRepo = NoteRepositoryFactory.createTaskNoteRepository();
        const chatRepo = NoteRepositoryFactory.createChatNoteRepository();

        // Three independent clears → run in parallel.
        await Promise.all([personalRepo.clear(), taskRepo.clear(), chatRepo.clear()]);

        const [myNotes, taskNotes, chatNotes] = await Promise.all([
            loadAllMyNotes(myself, accessToken) as Promise<MyNoteProps[]>,
            loadAllTaskNotes(myself, accessToken) as Promise<TaskNoteProps[]>,
            loadAllChatNotes(myself, accessToken) as Promise<ChatNoteProps[]>,
        ]);

        for (let i = 0; i < myNotes.length; i += BATCH_SIZE) {
            await noteService.batchInsertPersonalNotes(myNotes.slice(i, i + BATCH_SIZE));
        }
        for (let i = 0; i < taskNotes.length; i += BATCH_SIZE) {
            await noteService.batchInsertTaskNotes(taskNotes.slice(i, i + BATCH_SIZE));
        }
        for (let i = 0; i < chatNotes.length; i += BATCH_SIZE) {
            await noteService.batchInsertChatNotes(chatNotes.slice(i, i + BATCH_SIZE));
        }
    },
};
