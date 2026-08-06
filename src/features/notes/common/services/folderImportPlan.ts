/**
 * Turning a picked directory into a folder/note tree.
 *
 * `<input webkitdirectory>` hands back a FLAT list where each file knows
 * its path through `webkitRelativePath`
 * ("Export/Projects abc…/Roadmap def….md"). Everything in this module is
 * derived from those strings and nothing else — no network, no reads — so
 * the preview the user confirms and the import that runs afterwards are
 * the same function, and the mapping can be tested without a browser.
 *
 * The mapping itself: every directory becomes a note folder, every
 * markdown file becomes a note in it. Two wrinkles come from Notion,
 * which is what this exists for.
 */

import { titleFromFilename } from "./noteMarkdown";

const MARKDOWN_RE = /\.(md|markdown|txt)$/i;

/**
 * Notion stamps every export with the page's own id — on the `.md` file
 * and again on the folder holding its children ("Roadmap 1f2e…"). It is
 * never something anyone wants in a note title.
 *
 * Matched strictly: a space, then either 32 hex characters or a dashed
 * UUID, then end of name. Loosening this to "trailing hex-ish word"
 * would eat real titles ("Build 2024", "Rev deadbeef").
 */
const NOTION_ID_SUFFIX =
    /\s+(?:[0-9a-f]{32}|[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i;

/** "Roadmap 1f2e3d…" → "Roadmap". Falls back to the original when the
 *  id is the whole name, so nothing ends up nameless. */
export const stripNotionId = (name: string): string => {
    const stripped = name.replace(NOTION_ID_SUFFIX, "").trim();
    return stripped || name.trim();
};

export type PlannedNote = {
    title: string;
    file: File;
    /** Directory the file was read from, relative to the picked folder.
     *  Relative image links resolve against THIS, which is not always the
     *  folder the note ends up in — a Notion page merged into its own
     *  folder (below) moves down a level while its links do not. */
    sourceDir: string;
};

export type PlannedFolder = {
    name: string;
    folders: PlannedFolder[];
    notes: PlannedNote[];
};

export type FolderImportPlan = {
    /** The picked directory itself. Its own name is dropped: its CONTENTS
     *  land in the chosen destination, which is what "import this folder
     *  into here" means for every other importer. */
    root: PlannedFolder;
    folderCount: number;
    noteCount: number;
    /** Every non-markdown file, keyed by path relative to the picked
     *  folder. The pool that relative links in the notes resolve against;
     *  anything nothing links to is simply never uploaded. */
    assets: Map<string, File>;
};

type Dir = {
    /** Display name — what the note folder gets called. */
    name: string;
    /** Path relative to the picked folder, in on-disk names. */
    path: string;
    dirs: Map<string, Dir>;
    files: File[];
};

const newDir = (name: string, path: string): Dir => ({
    name,
    path,
    dirs: new Map(),
    files: [],
});

const byName = (a: { name: string }, b: { name: string }) =>
    a.name.localeCompare(b.name, undefined, { sensitivity: "base" });

const byTitle = (a: { title: string }, b: { title: string }) =>
    a.title.localeCompare(b.title, undefined, { sensitivity: "base" });

/**
 * Path segments below the picked directory.
 *
 * `webkitRelativePath` always leads with the picked directory's own name,
 * which is dropped. A file without one (a plain multi-file selection)
 * counts as sitting at the top level.
 */
const segmentsBelowRoot = (file: File): string[] => {
    const rel = file.webkitRelativePath;
    if (!rel) return [file.name];
    const parts = rel.split("/").filter(Boolean);
    return parts.length > 1 ? parts.slice(1) : parts;
};

const descend = (root: Dir, parts: string[]): Dir => {
    let cur = root;
    let path = "";
    for (const raw of parts) {
        path = path ? `${path}/${raw}` : raw;
        let next = cur.dirs.get(raw);
        if (!next) {
            next = newDir(stripNotionId(raw), path);
            cur.dirs.set(raw, next);
        }
        cur = next;
    }
    return cur;
};

const planDir = (dir: Dir): PlannedFolder => {
    const childDirs = [...dir.dirs.values()].sort(byName);

    // A Notion page that has sub-pages is exported TWICE: as
    // "Roadmap <id>.md" holding its own content, and as a
    // "Roadmap <id>/" folder holding its children. They are one page, so
    // the note is filed INSIDE its folder rather than left beside it —
    // otherwise every parent page in the tree shows up as a stray note
    // sitting next to a folder of the same name.
    const ownNote = new Map<Dir, PlannedNote>();
    const loose: PlannedNote[] = [];

    for (const file of dir.files) {
        const note: PlannedNote = {
            title: stripNotionId(titleFromFilename(file.name)),
            file,
            sourceDir: dir.path,
        };
        const twin = childDirs.find((d) => d.name === note.title && !ownNote.has(d));
        if (twin) ownNote.set(twin, note);
        else loose.push(note);
    }

    return {
        name: dir.name,
        folders: childDirs.map((child) => {
            const planned = planDir(child);
            const own = ownNote.get(child);
            // The page's own content leads its children.
            return own ? { ...planned, notes: [own, ...planned.notes] } : planned;
        }),
        notes: loose.sort(byTitle),
    };
};

const countFolder = (folder: PlannedFolder): { folders: number; notes: number } => {
    let folders = 0;
    let notes = folder.notes.length;
    for (const child of folder.folders) {
        const sub = countFolder(child);
        folders += 1 + sub.folders;
        notes += sub.notes;
    }
    return { folders, notes };
};

export const buildFolderImportPlan = (files: File[]): FolderImportPlan => {
    const root = newDir("", "");
    const assets = new Map<string, File>();

    for (const file of files) {
        const parts = segmentsBelowRoot(file);
        if (parts.length === 0) continue;
        const fileName = parts[parts.length - 1];
        // Finder and Notion both leave droppings (.DS_Store, __MACOSX).
        if (fileName.startsWith(".")) continue;
        if (parts.some((p) => p === "__MACOSX")) continue;

        if (MARKDOWN_RE.test(fileName)) {
            descend(root, parts.slice(0, -1)).files.push(file);
        } else {
            assets.set(parts.join("/"), file);
        }
    }

    const planned = planDir(root);
    const counts = countFolder(planned);
    return {
        root: planned,
        folderCount: counts.folders,
        noteCount: counts.notes,
        assets,
    };
};

export type PlanRow = { kind: "folder" | "note"; label: string; depth: number };

/** The plan as indented rows, in the order the import will create them.
 *  Drives the preview, so what the user confirms is what runs. */
export const describePlan = (folder: PlannedFolder, depth = 0): PlanRow[] => {
    const rows: PlanRow[] = [];
    for (const note of folder.notes) {
        rows.push({ kind: "note", label: note.title, depth });
    }
    for (const child of folder.folders) {
        rows.push({ kind: "folder", label: child.name, depth });
        rows.push(...describePlan(child, depth + 1));
    }
    return rows;
};
