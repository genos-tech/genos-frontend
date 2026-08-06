/**
 * Laying a note folder out as paths inside a zip.
 *
 * The mirror of `folderImportPlan`, and deliberately the same shape on
 * disk: a directory per folder, a `.md` per note, and a note that has
 * child notes written as `Roadmap.md` beside a `Roadmap/` directory
 * holding them. That is Notion's own convention, which means an export
 * from here can be dropped straight back into the folder importer and
 * come out as the tree it started as.
 *
 * Pure — folder rows and note metadata in, paths out. No fetching, so
 * the dialog can tell the user what it is about to do before it does it.
 */

import { MyNoteFolderProps, MyNoteMetaProps } from "../../../../types/notes";
import { buildMyNoteTree, collectDescendantFolderIds } from "../../../../utils/note";

export type ExportEntry = {
    /** Path inside the zip WITHOUT the `.md` — a note's images and child
     *  notes live in a directory of this same name, so the two are
     *  derived from one string rather than assembled twice. */
    path: string;
    noteId: number;
    title: string;
};

export type FolderExportPlan = {
    /** Folder being exported; becomes the zip's file name. */
    rootName: string;
    entries: ExportEntry[];
    folderCount: number;
};

/**
 * A single path segment that survives a round trip through a zip and
 * both major filesystems.
 *
 * Deliberately close to `markdownFilename`, minus the extension: the
 * characters Windows rejects, no leading dots (which would hide the file
 * on Unix and confuse the importer's dotfile skip), and short enough
 * that deep nesting doesn't blow a path length limit.
 */
export const safePathSegment = (name: string): string => {
    const cleaned = (name || "")
        .replace(/[\\/:*?"<>|]/g, " ")
        // Control characters are legal in a zip entry and legal in
        // nothing that opens one.
        // eslint-disable-next-line no-control-regex
        .replace(/[\u0000-\u001f]/g, " ")
        .replace(/\s+/g, " ")
        .trim()
        .replace(/^\.+/, "")
        .replace(/\.+$/, "")
        .trim()
        .slice(0, 80)
        .trim();
    return cleaned || "note";
};

/**
 * Make `name` unique among `taken`, appending " (2)", " (3)"…
 *
 * Two notes in one folder are free to share a title — the sidebar shows
 * both — but two entries in one zip directory are not. Tracked
 * case-insensitively because the filesystem on the other end usually is,
 * and a zip that silently loses a file on extraction is worse than one
 * with an awkward name.
 */
const uniqueIn = (taken: Set<string>, name: string): string => {
    const key = (value: string) => value.toLowerCase();
    if (!taken.has(key(name))) {
        taken.add(key(name));
        return name;
    }
    for (let n = 2; ; n += 1) {
        const candidate = `${name} (${n})`;
        if (!taken.has(key(candidate))) {
            taken.add(key(candidate));
            return candidate;
        }
    }
};

export const buildFolderExportPlan = (args: {
    rootFolderId: number;
    rootName: string;
    folders: MyNoteFolderProps[];
    noteMeta: MyNoteMetaProps[];
}): FolderExportPlan => {
    const { rootFolderId, rootName, folders, noteMeta } = args;

    const inScope = collectDescendantFolderIds(folders, rootFolderId);
    const scopedFolders = folders.filter((f) => inScope.has(f.folderId));
    const childFolders = new Map<number, MyNoteFolderProps[]>();
    for (const folder of scopedFolders) {
        if (folder.folderId === rootFolderId) continue;
        const parent = folder.parentFolderId;
        if (parent == null) continue;
        childFolders.set(parent, [...(childFolders.get(parent) ?? []), folder]);
    }

    // Notes hang off their ROOT note's folderId; a child note's own
    // folderId is meaningless (the backend only sets it on roots) and
    // following it would file children twice.
    const noteRoots = buildMyNoteTree(noteMeta);
    const rootsByFolder = new Map<number, ReturnType<typeof buildMyNoteTree>>();
    for (const note of noteRoots) {
        if (note.folderId == null || !inScope.has(note.folderId)) continue;
        rootsByFolder.set(note.folderId, [...(rootsByFolder.get(note.folderId) ?? []), note]);
    }

    const entries: ExportEntry[] = [];
    let folderCount = 0;

    const byName = (a: { name: string }, b: { name: string }) =>
        a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
    const byTitle = (a: { title: string }, b: { title: string }) =>
        a.title.localeCompare(b.title, undefined, { sensitivity: "base" });

    const walkNote = (
        note: ReturnType<typeof buildMyNoteTree>[number],
        dir: string,
        taken: Set<string>
    ) => {
        const name = uniqueIn(taken, safePathSegment(note.title));
        const path = dir ? `${dir}/${name}` : name;
        entries.push({ path, noteId: note.noteId, title: note.title });
        if (note.children.length > 0) {
            // Children go in a directory named after their parent —
            // alongside the parent's own `.md`, which is what makes this
            // readable in Finder and re-importable here.
            const childTaken = new Set<string>();
            for (const child of [...note.children].sort(byTitle)) {
                walkNote(child, path, childTaken);
            }
        }
    };

    const walkFolder = (folderId: number, name: string, dir: string) => {
        const path = dir ? `${dir}/${name}` : name;
        const taken = new Set<string>();

        const subfolders = [...(childFolders.get(folderId) ?? [])].sort(byName);
        for (const sub of subfolders) {
            folderCount += 1;
            walkFolder(sub.folderId, uniqueIn(taken, safePathSegment(sub.name)), path);
        }
        for (const note of [...(rootsByFolder.get(folderId) ?? [])].sort(byTitle)) {
            walkNote(note, path, taken);
        }
    };

    // The exported folder is the zip's top-level directory, so extracting
    // it never sprays files across the download folder.
    walkFolder(rootFolderId, safePathSegment(rootName), "");

    return { rootName, entries, folderCount };
};
