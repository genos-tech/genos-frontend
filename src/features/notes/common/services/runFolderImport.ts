/**
 * Executing a `FolderImportPlan` against the server.
 *
 * Walks the planned tree depth-first, creating each folder before the
 * notes and subfolders inside it, because a child needs its parent's id.
 *
 * Sequential on purpose. A Notion export is hundreds of creates against
 * an endpoint with a monthly note quota behind it, and the useful
 * failure mode there is "stopped after 340 of 500, here is what landed"
 * — which needs a known order. Firing them in parallel would trade that
 * for a faster import and a pile of half-created folders whose contents
 * nobody can account for.
 *
 * Note creation goes through the services rather than
 * `handleCreateNewMyNote`: that handler opens a page tab for every note
 * it makes, which is the right call for one note and unusable for four
 * hundred.
 */

import { authApi } from "../../../../services/api";
import { UserProps } from "../../../../types/admin";
import { createEmptyMyNote } from "../../my-notes/services/createEmptyMyNote";
import { createMyNoteFolder } from "../../my-notes/services/createMyNoteFolder";
import { createTeamNoteFolder } from "../../team-notes/services/createTeamNoteFolder";
import type { FolderImportPlan, PlannedFolder, PlannedNote } from "./folderImportPlan";
import { collectRelativeAssetHrefs, resolveAssetPath, rewriteAssetHrefs } from "./noteAssetLinks";
import { markdownToNoteBlocks } from "./noteMarkdown";

const API_BASE = import.meta.env.VITE_API_BASE_URL;
const DJANGO_URL = import.meta.env.VITE_DJANGO_URL;

/**
 * Where the tree is being planted.
 *
 * Personal and team folders are separate APIs — `/note/personal/folder/`
 * against the user, `/note/team/folder/` against the team's ACL — so the
 * caller has to say which tree `parentFolderId` belongs to. The NOTES are
 * the same endpoint either way: a team note is a personal note whose
 * folder happens to be shared.
 */
export type ImportDestination = {
    kind: "personal" | "team";
    /** Folder to import into; null imports into the root of that tree. */
    parentFolderId: number | null;
};

export type FolderImportProgress = {
    /** Notes finished so far, successes and failures alike. */
    done: number;
    total: number;
    /** What is being worked on, for the progress line. */
    label: string;
};

export type FolderImportFailure = { path: string; reason: string };

export type FolderImportResult = {
    foldersCreated: number;
    notesCreated: number;
    assetsUploaded: number;
    /** Links that named a file nothing could be done with: missing from
     *  the picked folder, over the plan's upload ceiling, or refused. */
    assetsFailed: number;
    failures: FolderImportFailure[];
    /** True when the run stopped early because the caller cancelled. */
    cancelled: boolean;
};

export type RunFolderImportArgs = {
    plan: FolderImportPlan;
    destination: ImportDestination;
    myself: UserProps;
    accessToken: string;
    /** Per-file ceiling from the user's plan; null when unknown, which
     *  means "try it and let the server decide". */
    uploadLimitBytes: number | null;
    onProgress?: (progress: FolderImportProgress) => void;
    /** Polled between notes so a long import can be stopped. */
    shouldCancel?: () => boolean;
};

const errorText = (error: unknown): string =>
    error instanceof Error ? error.message : String(error);

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
const uploadNoteAsset = async (args: {
    noteId: number;
    file: File;
    uploaderId: string;
    accessToken: string;
}): Promise<string> => {
    const form = new FormData();
    form.append("note_attachment_file", args.file);
    form.append("note_id", String(args.noteId));
    form.append("uploader", args.uploaderId);

    const res = await fetch(`${API_BASE}/note/personal/attachment/`, {
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
const putNoteBody = async (args: {
    myself: UserProps;
    noteId: number;
    title: string;
    body: unknown[];
    accessToken: string;
}): Promise<void> => {
    const api = authApi(args.accessToken);
    if (!api) throw new Error("no auth token");
    await api.put("/note/personal/", {
        user_id: args.myself.userId,
        note_id: args.noteId,
        title: args.title,
        body: args.body,
    });
};

export const runFolderImport = async ({
    plan,
    destination,
    myself,
    accessToken,
    uploadLimitBytes,
    onProgress,
    shouldCancel,
}: RunFolderImportArgs): Promise<FolderImportResult> => {
    const result: FolderImportResult = {
        foldersCreated: 0,
        notesCreated: 0,
        assetsUploaded: 0,
        assetsFailed: 0,
        failures: [],
        cancelled: false,
    };
    let done = 0;

    const createFolder = async (name: string, parentFolderId: number | null): Promise<number> => {
        if (destination.kind === "team") {
            // `visibility: null` inherits the parent's access, which is
            // what keeps an imported subtree reachable by exactly the
            // people who can already reach the folder it landed in.
            const created = await createTeamNoteFolder(
                myself,
                { name, parentFolderId, visibility: null },
                accessToken
            );
            if (!created) throw new Error("folder create failed");
            return created.folderId;
        }
        const created = await createMyNoteFolder(myself, name, parentFolderId, accessToken);
        if (!created) throw new Error("folder create failed");
        return created.folderId;
    };

    const importNote = async (note: PlannedNote, folderId: number | null, path: string) => {
        onProgress?.({ done, total: plan.noteCount, label: path });
        try {
            const markdown = await note.file.text();
            const body = await markdownToNoteBlocks(markdown);

            const created = (await createEmptyMyNote(
                myself,
                null,
                note.title,
                accessToken,
                folderId,
                body
            )) as { noteId?: number } | undefined;
            if (!created?.noteId) throw new Error("note create failed");
            result.notesCreated += 1;

            // Images can only be attached once the note has an id, so
            // the body written above still carries the export's own
            // relative links. Upload what they point at, then write the
            // body a second time with the real URLs. Notes with no
            // images — the overwhelming majority — never get here.
            const hrefs = collectRelativeAssetHrefs(body);
            if (hrefs.length > 0) {
                const uploaded = new Map<string, string>();
                for (const href of hrefs) {
                    const file = plan.assets.get(resolveAssetPath(note.sourceDir, href));
                    if (!file || (uploadLimitBytes != null && file.size > uploadLimitBytes)) {
                        result.assetsFailed += 1;
                        continue;
                    }
                    try {
                        uploaded.set(
                            href,
                            await uploadNoteAsset({
                                noteId: created.noteId,
                                file,
                                uploaderId: myself.userId,
                                accessToken,
                            })
                        );
                        result.assetsUploaded += 1;
                    } catch {
                        // One dead image shouldn't cost the note it's in.
                        result.assetsFailed += 1;
                    }
                }
                if (uploaded.size > 0) {
                    await putNoteBody({
                        myself,
                        noteId: created.noteId,
                        title: note.title,
                        body: rewriteAssetHrefs(body, uploaded),
                        accessToken,
                    });
                }
            }
        } catch (error) {
            result.failures.push({ path, reason: errorText(error) });
        } finally {
            done += 1;
            onProgress?.({ done, total: plan.noteCount, label: path });
        }
    };

    const walk = async (folder: PlannedFolder, folderId: number | null, prefix: string) => {
        for (const note of folder.notes) {
            if (shouldCancel?.()) {
                result.cancelled = true;
                return;
            }
            await importNote(note, folderId, prefix ? `${prefix}/${note.title}` : note.title);
        }
        for (const child of folder.folders) {
            if (shouldCancel?.()) {
                result.cancelled = true;
                return;
            }
            const path = prefix ? `${prefix}/${child.name}` : child.name;
            let childId: number;
            try {
                childId = await createFolder(child.name, folderId);
                result.foldersCreated += 1;
            } catch (error) {
                // Without an id there is nowhere to put this subtree, so
                // record it once and move on rather than dumping its
                // whole contents into the parent.
                result.failures.push({ path, reason: errorText(error) });
                continue;
            }
            await walk(child, childId, path);
            if (result.cancelled) return;
        }
    };

    await walk(plan.root, destination.parentFolderId, "");
    onProgress?.({ done, total: plan.noteCount, label: "" });
    return result;
};
