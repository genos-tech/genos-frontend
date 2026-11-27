import { PartialBlock } from "@blocknote/core";
import { Socket } from "socket.io-client";

import { emitRequestError } from "../../../../services/requestErrorNotifier";
import { UserProps } from "../../../../types/admin";
import { isRetryableSaveError } from "../../../tasks/services/isRetryableSaveError";
import { bodyFingerprint, isKeepingStopped } from "../../../tasks/services/unsavedTaskBody";
import { inNoteTurn } from "../hooks/noteSaveSession";
import { loadSpecificNote } from "./loadSpecificNote";
import { EditableNote, saveNote } from "./saveNote";
import { forgetUnsavedNoteBody, readUnsavedNoteBody } from "./unsavedNoteBody";

/**
 * Saves what a record holds for this note, if that is still safe. It takes the note's turn, so a
 * save made meanwhile follows it. `isSuperseded`: the person has typed in the open editor, so its
 * own autosave is the newer one. Resolves with the note as stored, else `null`.
 */
export const repairUnsavedNoteBody = async ({
    myself,
    noteType,
    noteId,
    accessToken,
    socket,
    isSuperseded,
}: {
    myself: UserProps;
    noteType: 1 | 2 | 3;
    noteId: number;
    accessToken: string;
    socket: Socket | null;
    isSuperseded: () => boolean;
}): Promise<EditableNote | null> => {
    const noteKey = `${noteType}-${noteId}`;
    if (!readUnsavedNoteBody(myself.userId, noteKey)) return null;
    return inNoteTurn(noteKey, async () => {
        // Read again: the save this waited for may have settled it.
        const record = readUnsavedNoteBody(myself.userId, noteKey);
        if (!record) return null;
        // The server's own copy, never the cached one. Unreachable: keep the record.
        const stored = await loadSpecificNote(myself, noteType, noteId, accessToken);
        if (!stored || stored.error) return null;
        if (readUnsavedNoteBody(myself.userId, noteKey)?.at !== record.at) return null;
        if (isSuperseded() || isKeepingStopped()) return null;

        const server = bodyFingerprint(stored.body);
        if (server === bodyFingerprint(record.body) || !record.bases.includes(server)) {
            forgetUnsavedNoteBody(myself.userId, noteKey);
            return null;
        }
        const note = { ...(stored as EditableNote), body: record.body as PartialBlock[] };
        try {
            await saveNote(note, myself, accessToken, socket);
        } catch (error) {
            console.error("Could not save the note text kept in this browser:", error);
            if (!isRetryableSaveError(error)) {
                // Refused again (no longer allowed to edit it): say so, and stop trying.
                emitRequestError("noteNotSaved");
                forgetUnsavedNoteBody(myself.userId, noteKey);
            }
            return null;
        }
        forgetUnsavedNoteBody(myself.userId, noteKey);
        return note;
    });
};
