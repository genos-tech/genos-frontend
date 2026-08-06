/**
 * Turning a `FolderExportPlan` into a zip the user can keep.
 *
 * The mirror of `runFolderImport`, and the same bargain: sequential, so a
 * folder with hundreds of notes reports "42 of 500, currently Roadmap"
 * instead of hammering the API, and so stopping halfway still produces a
 * zip of everything gathered up to that point.
 *
 * Bodies come from one bulk call where the API offers one. `/note/
 * personal/all/` returns every My Note WITH its body, which turns a
 * 500-note export into a single request; it deliberately excludes notes
 * filed in team folders, so a team export falls back to fetching each
 * note on its own. Anything the bulk call missed is fetched individually
 * either way, so a note created since the last sync is never silently
 * dropped.
 *
 * Images are copied into the zip and the links rewritten to point at
 * them. That is what makes the export readable outside Genos — the
 * originals sit behind the API's auth — and it is also exactly the shape
 * `folderImportPlan` reads, so a zip from here re-imports as the tree it
 * came from.
 */

import { UserProps } from "../../../../types/admin";
import { loadAllMyNotes } from "../../my-notes/services/loadAllMyNotes";
import { safePathSegment, type ExportEntry, type FolderExportPlan } from "./folderExportPlan";
import { loadSpecificNote } from "./loadSpecificNote";
import { collectRemoteAssetHrefs, rewriteAssetHrefs } from "./noteAssetLinks";
import { noteBlocksToMarkdown } from "./noteMarkdown";

/**
 * Which tree the folder lives in.
 *
 * Only decides whether the bulk body fetch is worth attempting — the
 * per-note endpoint is the same either way, because a team note is a
 * personal note whose folder happens to be shared.
 */
export type ExportSource = "personal" | "team";

export type FolderExportProgress = {
    /** Notes finished so far, successes and failures alike. */
    done: number;
    total: number;
    /** What is being worked on, for the progress line. */
    label: string;
};

export type FolderExportFailure = { path: string; reason: string };

export type FolderExportResult = {
    /** The zip, ready to hand to `downloadZip`. Null only when the run
     *  was cancelled before anything was gathered. */
    blob: Blob | null;
    fileName: string;
    notesExported: number;
    imagesIncluded: number;
    /** Images whose bytes couldn't be fetched. Their notes still export;
     *  the link is left pointing at the original URL. */
    imagesFailed: number;
    failures: FolderExportFailure[];
    cancelled: boolean;
};

export type RunFolderExportArgs = {
    plan: FolderExportPlan;
    source: ExportSource;
    myself: UserProps;
    accessToken: string;
    onProgress?: (progress: FolderExportProgress) => void;
    /** Polled between notes so a long export can be stopped. */
    shouldCancel?: () => boolean;
};

const errorText = (error: unknown): string =>
    error instanceof Error ? error.message : String(error);

type NoteRow = { noteId?: number; title?: string; body?: unknown };

/**
 * Every My Note keyed by id, or an empty map if the bulk call is not
 * applicable or fails.
 *
 * Failure here is not fatal: the caller falls back to per-note fetches,
 * which are slower but produce the same zip.
 */
const bulkBodies = async (
    myself: UserProps,
    accessToken: string
): Promise<Map<number, NoteRow>> => {
    const out = new Map<number, NoteRow>();
    try {
        const rows = (await loadAllMyNotes(myself, accessToken)) as NoteRow[] | undefined;
        if (Array.isArray(rows)) {
            for (const row of rows) {
                if (typeof row?.noteId === "number") out.set(row.noteId, row);
            }
        }
    } catch {
        // Fall through to per-note fetching.
    }
    return out;
};

/**
 * Name to file an image under, from its URL.
 *
 * Attachments are stored as `notes/personal/<id>/<filename>`, so the last
 * path segment is the name the user uploaded — worth keeping, since it is
 * what they'll see in the zip.
 */
export const assetFileName = (href: string): string => {
    let path = href;
    try {
        path = new URL(href, "http://x").pathname;
    } catch {
        // Keep the raw href; the cleanup below still applies.
    }
    const raw = path.split("/").filter(Boolean).pop() ?? "image";
    let decoded = raw;
    try {
        decoded = decodeURIComponent(raw);
    } catch {
        // A stray "%" is not worth failing an export over.
    }
    const dot = decoded.lastIndexOf(".");
    // Split before sanitizing so the extension survives a long name being
    // truncated — an "image.png" that becomes "image" opens in nothing.
    const stem = dot > 0 ? decoded.slice(0, dot) : decoded;
    const ext =
        dot > 0
            ? decoded
                  .slice(dot)
                  .replace(/[^\w.]/g, "")
                  .slice(0, 12)
            : "";
    return `${safePathSegment(stem)}${ext}`;
};

/**
 * Fetch an attachment's bytes.
 *
 * Media is role-gated, and the gate accepts either a bearer token or the
 * session's HttpOnly cookie. Both are tried because which one works
 * depends on how the deployment is fronted, and the cost of a second
 * attempt is far smaller than the cost of a zip full of missing images.
 */
const fetchAsset = async (href: string, accessToken: string): Promise<Blob> => {
    try {
        const res = await fetch(href, {
            headers: { Authorization: `Bearer ${accessToken}` },
        });
        if (res.ok) return await res.blob();
    } catch {
        // Try the cookie path before giving up.
    }
    const res = await fetch(href, { credentials: "include" });
    if (!res.ok) throw new Error(`fetch failed (${res.status})`);
    return await res.blob();
};

/** Percent-encode a zip-relative path for use inside a markdown link. */
const encodePath = (path: string): string =>
    path
        .split("/")
        .map((segment) => encodeURIComponent(segment))
        .join("/");

export const runFolderExport = async ({
    plan,
    source,
    myself,
    accessToken,
    onProgress,
    shouldCancel,
}: RunFolderExportArgs): Promise<FolderExportResult> => {
    const JSZip = (await import("jszip")).default;
    const zip = new JSZip();

    const result: FolderExportResult = {
        blob: null,
        fileName: `${safePathSegment(plan.rootName)}.zip`,
        notesExported: 0,
        imagesIncluded: 0,
        imagesFailed: 0,
        failures: [],
        cancelled: false,
    };

    const total = plan.entries.length;
    const cached = source === "personal" ? await bulkBodies(myself, accessToken) : new Map();

    const loadBody = async (entry: ExportEntry): Promise<NoteRow> => {
        const hit = cached.get(entry.noteId);
        if (hit && Array.isArray(hit.body)) return hit;
        const fresh = (await loadSpecificNote(myself, 1, entry.noteId, accessToken)) as
            | (NoteRow & { error?: string })
            | undefined;
        if (!fresh || fresh.error) throw new Error(fresh?.error ?? "not found");
        return fresh;
    };

    // Assets are keyed by their URL across the whole export, so the same
    // image referenced by two notes is fetched once — Notion exports in
    // particular repeat a header image on every page in a database.
    const fetched = new Map<string, Blob | null>();

    for (const entry of plan.entries) {
        if (shouldCancel?.()) {
            result.cancelled = true;
            break;
        }
        onProgress?.({
            done: result.notesExported + result.failures.length,
            total,
            label: entry.title,
        });

        try {
            const note = await loadBody(entry);
            const body = Array.isArray(note.body) ? note.body : [];

            // A note's images live in the directory named after it —
            // the same one its child notes go in, which is Notion's
            // layout and what our importer expects to find.
            const dirName = entry.path.split("/").pop() ?? "note";
            const replacements = new Map<string, string>();
            const usedNames = new Set<string>();

            for (const href of collectRemoteAssetHrefs(body)) {
                let blob = fetched.get(href);
                if (blob === undefined) {
                    try {
                        blob = await fetchAsset(href, accessToken);
                    } catch {
                        blob = null;
                    }
                    fetched.set(href, blob);
                }
                if (!blob) {
                    result.imagesFailed += 1;
                    continue;
                }
                let name = assetFileName(href);
                while (usedNames.has(name.toLowerCase())) name = `_${name}`;
                usedNames.add(name.toLowerCase());

                zip.file(`${entry.path}/${name}`, blob);
                replacements.set(href, encodePath(`${dirName}/${name}`));
                result.imagesIncluded += 1;
            }

            const markdown = await noteBlocksToMarkdown(rewriteAssetHrefs(body, replacements));
            zip.file(`${entry.path}.md`, markdown);
            result.notesExported += 1;
        } catch (error) {
            result.failures.push({ path: entry.path, reason: errorText(error) });
        }
    }

    onProgress?.({
        done: result.notesExported + result.failures.length,
        total,
        label: "",
    });

    if (result.notesExported > 0) {
        result.blob = await zip.generateAsync({ type: "blob" });
    }
    return result;
};

/** Trigger a browser download of an export's zip. */
export const downloadZip = (fileName: string, blob: Blob): void => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    a.remove();
    // Give the click a tick to start the download before revoking.
    setTimeout(() => URL.revokeObjectURL(url), 1000);
};
