import { RefObject } from "react";
import { PartialBlock } from "@blocknote/core";
import { Socket } from "socket.io-client";

import { UserProps } from "../../../../types/admin";
import { createRetryBackoff } from "../../../tasks/utils/retryBackoff";
import { EditableNote, saveNote } from "../services/saveNote";

// How long a save waits for an earlier one of the same note before it goes anyway: a request
// that never answers must not stop every later save.
const EARLIER_SAVE_WAIT_MS = 30_000;

/** What the save engine knows about ONE note an editor shows. See `useNoteEditorCore`. */
export type NoteSaveSession<T extends EditableNote> = {
    key: string;
    noteKey: string;
    note: T | null;
    body: PartialBlock[] | undefined;
    edited: boolean;
    pendingTitle: string | null;
    /** The body (JSON) of the last save the server accepted. */
    confirmedBody: string | null;
    /** Replaced by a restore: nothing it still holds may be sent. */
    dropped: boolean;
    onNoteUpdate?: (updatedNote: T) => void;
    /** Filled by the editor: its document as it is now. */
    bodyReadRef: RefObject<(() => PartialBlock[]) | null>;
    backoff: ReturnType<typeof createRetryBackoff>;
};

export const createNoteSaveSession = <T extends EditableNote>(
    key: string,
    note: T | null
): NoteSaveSession<T> => ({
    key,
    noteKey: note ? `${note.noteType}-${note.noteId}` : "",
    note,
    body: note?.body as PartialBlock[] | undefined,
    edited: false,
    pendingTitle: null,
    confirmedBody: null,
    dropped: false,
    bodyReadRef: { current: null },
    backoff: createRetryBackoff(),
});

// The last save of each note still on its way, across every panel that shows it.
const inFlight = new Map<string, Promise<void>>();

type Payload = {
    note: EditableNote;
    myself: UserProps;
    accessToken: string;
    socket: Socket | null;
};

/**
 * Saves of one note go out one at a time. Two in flight can land in either order, and the older
 * text landing last is what the note then keeps (MIP-2454).
 *
 * `build` runs when this save's turn comes, so it carries the text as it is by then; `null` means
 * there is nothing to send. Resolves to whether something was stored.
 */
export const sendNoteSave = async <T extends EditableNote>(
    session: NoteSaveSession<T>,
    build: () => Payload | null
): Promise<boolean> => {
    const key = session.noteKey;
    const earlier = inFlight.get(key);
    let done = () => {};
    const mine = new Promise<void>((resolve) => (done = resolve));
    inFlight.set(key, mine);
    try {
        if (earlier) {
            let timer: ReturnType<typeof setTimeout> | undefined;
            await Promise.race([
                earlier,
                new Promise((resolve) => (timer = setTimeout(resolve, EARLIER_SAVE_WAIT_MS))),
            ]);
            clearTimeout(timer);
        }
        const payload = build();
        if (!payload) return false;
        await saveNote(payload.note, payload.myself, payload.accessToken, payload.socket);
        return true;
    } finally {
        done();
        if (inFlight.get(key) === mine) inFlight.delete(key);
    }
};
