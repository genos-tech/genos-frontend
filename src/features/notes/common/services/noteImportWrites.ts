/**
 * The two writes an import makes against a note that already exists:
 * upload a file to it, and replace its body. Kept apart from
 * `runFolderImport` because that module pulls in the markdown parser and
 * with it the whole BlockNote editor: `useNoteManagement` runs on every
 * page and must not depend on that (see `applyNoteBodyToYjs`).
 */

import { authApi } from "../../../../services/api";
import { UserProps } from "../../../../types/admin";

const API_BASE = import.meta.env.VITE_API_BASE_URL;
const DJANGO_URL = import.meta.env.VITE_DJANGO_URL;

/** Which kind of note the import writes into. Each kind has its own
 *  attachment and update endpoint (and ACL); a chat note's upload also
 *  carries its channel, as the editor's own upload does. */
export type NoteWriteTarget =
    | { kind: "personal" }
    | { kind: "task" }
    | { kind: "chat"; chatType: number; chatId: number; isThread: boolean; threadId: number };

const baseOf = (target?: NoteWriteTarget): string => `/note/${target?.kind ?? "personal"}`;

/**
 * Upload one file against an existing note.
 *
 * Mirrors the editors' own drop/paste upload (`bnMyNoteEditor` and
 * friends) — same endpoint, same field names, same absolute-URL return —
 * because an imported image has to be indistinguishable from a pasted
 * one once it lands. It has to run AFTER the note exists: the endpoint
 * files the attachment under `note_id` and checks the caller's write
 * role on it.
 */
export const uploadNoteAsset = async (args: {
    noteId: number;
    file: File;
    uploaderId: string;
    accessToken: string;
    target?: NoteWriteTarget;
}): Promise<string> => {
    const form = new FormData();
    form.append("note_attachment_file", args.file);
    form.append("note_id", String(args.noteId));
    if (args.target?.kind === "chat") {
        form.append("chat_type", String(args.target.chatType));
        form.append("chat_id", String(args.target.chatId));
        form.append("is_thread", String(args.target.isThread));
        form.append("thread_id", String(args.target.threadId));
    }
    form.append("uploader", args.uploaderId);

    const res = await fetch(`${API_BASE}${baseOf(args.target)}/attachment/`, {
        method: "POST",
        headers: { Authorization: `Bearer ${args.accessToken}` },
        body: form,
    });
    const data = (await res.json().catch(() => null)) as { noteAttachmentUrl?: string } | null;
    if (!res.ok || !data?.noteAttachmentUrl) {
        throw new Error(`upload failed (${res.status})`);
    }
    return `${DJANGO_URL}${data.noteAttachmentUrl}`;
};

/**
 * Rewrite a freshly created note's body to point at uploaded copies.
 *
 * A direct PUT rather than `sendUpdatedMyNote`, which swallows its errors
 * and emits note-mention socket events — neither of which suits an
 * importer that has to report what failed and is writing bodies whose
 * "mentions" are plain text from someone else's workspace.
 */
export const putNoteBody = async (args: {
    myself: UserProps;
    noteId: number;
    title: string;
    body: unknown[];
    accessToken: string;
    target?: NoteWriteTarget;
}): Promise<void> => {
    const api = authApi(args.accessToken);
    if (!api) throw new Error("no auth token");
    await api.put(`${baseOf(args.target)}/`, {
        user_id: args.myself.userId,
        note_id: args.noteId,
        title: args.title,
        body: args.body,
    });
};
