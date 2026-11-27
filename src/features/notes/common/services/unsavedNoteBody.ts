/**
 * The note words this browser could not be sure it saved (MIP-2463): the page was reloaded or
 * closed, the save made while leaving the note failed, or the server refused a save. The words are
 * in the editor (the collab document) but not in the stored note. The same rule as the task
 * description (`unsavedTaskBody`, MIP-2455): a record holds the text typed here and `bases`, the
 * stored bodies it can be on top of. On the next open the text is saved ONLY IF the server still
 * holds one of them, so a write made since (a teammate, an AI app, another device) is never
 * overwritten.
 */
import { PartialBlock } from "@blocknote/core";

import { bodyFingerprint, isKeepingStopped } from "../../../tasks/services/unsavedTaskBody";

// Swept on sign-out (`signOutLeftovers`).
export const UNSAVED_NOTE_BODY_PREFIX = "genos.unsavedNoteBody.v1.";

// Old text brought back after this long would surprise more than it would help.
const KEEP_FOR_MS = 7 * 24 * 60 * 60 * 1000;

export type UnsavedNoteBody = { body: PartialBlock[]; bases: string[]; at: number };

/** `noteKey` is `<noteType>-<noteId>`. */
const keyOf = (userId: string, noteKey: string) =>
    `${UNSAVED_NOTE_BODY_PREFIX}${userId}.${noteKey}`;

export const readUnsavedNoteBody = (userId: string, noteKey: string): UnsavedNoteBody | null => {
    try {
        const raw = localStorage.getItem(keyOf(userId, noteKey));
        if (!raw) return null;
        const record = JSON.parse(raw) as UnsavedNoteBody;
        if (Date.now() - record.at <= KEEP_FOR_MS) return record;
        localStorage.removeItem(keyOf(userId, noteKey));
        return null;
    } catch {
        return null;
    }
};

const write = (userId: string, noteKey: string, record: UnsavedNoteBody | null) => {
    try {
        if (record) localStorage.setItem(keyOf(userId, noteKey), JSON.stringify(record));
        else localStorage.removeItem(keyOf(userId, noteKey));
    } catch {
        // Storage full or unavailable: the repair is a safety net, never a requirement.
    }
};

export const forgetUnsavedNoteBody = (userId: string, noteKey: string) =>
    write(userId, noteKey, null);

// Bodies on their way to the server: each may or may not arrive.
const inFlight = new Map<string, string[]>();

/** A save of this note's body is going out. Call the result when its request is over. */
export const trackNoteBodySave = (noteKey: string, body: PartialBlock[]): (() => void) => {
    const sent = bodyFingerprint(body);
    const list = inFlight.get(noteKey) ?? [];
    inFlight.set(noteKey, [...list, sent]);
    return () => {
        const now = [...(inFlight.get(noteKey) ?? [])];
        const at = now.indexOf(sent);
        if (at !== -1) now.splice(at, 1);
        inFlight.set(noteKey, now);
    };
};

/** `base` is the stored body (`bodyFingerprint`) the words were typed on top of. */
export const keepUnsavedNoteBody = (
    userId: string,
    noteKey: string,
    body: PartialBlock[],
    base: string
) => {
    if (isKeepingStopped()) return;
    write(userId, noteKey, {
        body,
        bases: [base, ...(inFlight.get(noteKey) ?? [])],
        at: Date.now(),
    });
};

/**
 * A save of this note was stored. `startedAt` is when it took the text; `typed`, that the person
 * had typed in the editor it came from.
 */
export const settleUnsavedNoteBody = (
    userId: string,
    noteKey: string,
    sent: PartialBlock[],
    { startedAt, typed }: { startedAt: number; typed: boolean }
) => {
    const record = readUnsavedNoteBody(userId, noteKey);
    if (!record) return;
    const fingerprint = bodyFingerprint(sent);
    if (fingerprint === bodyFingerprint(record.body)) {
        write(userId, noteKey, null);
        return;
    }
    // Words kept after that save set out are newer than it: still unsaved, now on top of it.
    if (record.at > startedAt) write(userId, noteKey, { ...record, bases: [fingerprint] });
    // A later save that only restates what was stored (a rename made before the editor had the
    // words) says nothing about them. One the person typed in, or with other text, is newer.
    else if (typed || !record.bases.includes(fingerprint)) write(userId, noteKey, null);
};
