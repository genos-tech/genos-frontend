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

import { fmt, getMessages } from "../../../../i18n";
import { UserProps } from "../../../../types/admin";
import { createEmptyMyNote } from "../../my-notes/services/createEmptyMyNote";
import { createMyNoteFolder } from "../../my-notes/services/createMyNoteFolder";
import { createTeamNoteFolder } from "../../team-notes/services/createTeamNoteFolder";
import type { FolderImportPlan, PlannedFolder, PlannedNote } from "./folderImportPlan";
import { externalizeDataUriImages, withoutDataUriImages } from "./importDataUriImages";
import { importHtmlNote, type HtmlImportWarning } from "./importHtmlNote";
import { collectRelativeAssetHrefs, resolveAssetPath, rewriteAssetHrefs } from "./noteAssetLinks";
import { putNoteBody, uploadNoteAsset } from "./noteImportWrites";
import { markdownToNoteBlocks } from "./noteMarkdown";

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
    /** HTML pages stored as notes (MIP-2215); they are also counted in `notesCreated`. Present
     *  only when the run met an HTML page. */
    htmlNotesCreated?: number;
    /** Pages the scan found parts in that the sandbox will not show: the page and the finding codes. */
    htmlWarnings?: { path: string; warnings: HtmlImportWarning[] }[];
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

    // Set when the server says the plan has no HTML notes: the rest of the pages are not sent (each
    // would get the same answer), and every one is reported as a failure with that reason.
    let htmlNotOnPlan = false;

    // An HTML page is stored as a page through the import endpoint, never parsed into blocks. A
    // refusal (plan, size, count, rate) is that page's failure and the run goes on with the next.
    const importHtmlPage = async (note: PlannedNote, folderId: number | null, path: string) => {
        const messages = getMessages().notes.htmlImport;
        if (htmlNotOnPlan) {
            result.failures.push({ path, reason: messages.notOnPlan });
            return;
        }
        const html = await note.file.text();
        const outcome = await importHtmlNote({
            accessToken,
            teamId: myself.teamId,
            html,
            title: note.title,
            target:
                destination.kind === "team" && folderId != null
                    ? { kind: "team", folderId }
                    : { kind: "personal", folderId },
        });
        if (outcome.status === "not-on-plan") {
            htmlNotOnPlan = true;
            result.failures.push({ path, reason: messages.notOnPlan });
            return;
        }
        if (outcome.status === "refused") {
            result.failures.push({ path, reason: outcome.reason });
            return;
        }
        result.notesCreated += 1;
        result.htmlNotesCreated = (result.htmlNotesCreated ?? 0) + 1;
        if (outcome.warnings.length > 0) {
            (result.htmlWarnings ??= []).push({ path, warnings: outcome.warnings });
        }
    };

    const importNote = async (note: PlannedNote, folderId: number | null, path: string) => {
        onProgress?.({ done, total: plan.noteCount, label: path });
        if (note.format === "html") {
            try {
                await importHtmlPage(note, folderId, path);
            } catch (error) {
                result.failures.push({ path, reason: errorText(error) });
            } finally {
                done += 1;
                onProgress?.({ done, total: plan.noteCount, label: path });
            }
            return;
        }
        try {
            const markdown = await note.file.text();
            const body = await markdownToNoteBlocks(markdown);

            const created = (await createEmptyMyNote(
                myself,
                null,
                note.title,
                accessToken,
                folderId,
                // Created without any `data:` pixels (the API refuses a
                // body over ~2.5 MB); they are uploaded below.
                withoutDataUriImages(body)
            )) as { noteId?: number } | undefined;
            if (!created?.noteId) throw new Error("note create failed");
            result.notesCreated += 1;

            // Images can only be attached once the note has an id, so
            // the body written above still carries the export's own
            // relative links. Upload what they point at, then write the
            // body a second time with the real URLs. Notes with no
            // images — the overwhelming majority — never get here.
            let finalBody: unknown[] = body;
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
                finalBody = rewriteAssetHrefs(finalBody, uploaded);
            }

            // Pictures embedded as `data:` URIs (a Google Docs export)
            // go through the same upload, so the note body stays small.
            // One that cannot be moved stays inline and is counted.
            const dataImages = await externalizeDataUriImages({
                body: finalBody,
                uploadLimitBytes,
                placeholderText: (n) =>
                    fmt(getMessages().notes.importMd.imagePlaceholder, { index: n }),
                upload: (file) =>
                    uploadNoteAsset({
                        noteId: created.noteId as number,
                        file,
                        uploaderId: myself.userId,
                        accessToken,
                    }),
            });
            finalBody = dataImages.body;
            result.assetsUploaded += dataImages.report.uploaded;
            result.assetsFailed += dataImages.report.warnings.length;

            if (finalBody !== body) {
                await putNoteBody({
                    myself,
                    noteId: created.noteId,
                    title: note.title,
                    body: finalBody,
                    accessToken,
                });
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
