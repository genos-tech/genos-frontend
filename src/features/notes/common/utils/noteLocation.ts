/**
 * "Where does this note live?" as one short line (MIP-1429).
 *
 * The second line of a Recents or Favorites row. One rule for every kind of note: name the
 * place the person would go to find it again.
 *
 *   my note      My Notes › Product              (the folder it is filed in)
 *   team note    Team Notes › Design
 *   shared       Shared by Carol Park
 *   task note    QR-2 · Synthesize 12 customer interviews
 *   chat note    general · Product & Design
 *
 * It used to be three different rules (one in each of two components): a task note showed the
 * project and the INTERNAL task number ("#12953"), a chat note showed its type ("GM"), a
 * personal note showed nothing, so two notes with the same title in different folders looked
 * the same.
 *
 * The recents and favorites endpoints do not send these fields (no display id, no chat name, no
 * folder), but the sidebar has every list loaded, so they are looked up there by note id. A note
 * that is not in a list (access lost since) falls back to what the row itself carries, and a
 * line that cannot be built is `null`: no line is better than a wrong one.
 */

type FolderLike = { folderId: number; parentFolderId: number | null; name: string };
type NoteLike = { noteId: number; parentNoteId: number | null; folderId?: number | null };

export type LocationSources = {
    myNotes: ReadonlyMap<number, NoteLike>;
    myFolders: ReadonlyMap<number, FolderLike>;
    teamNotes: ReadonlyMap<number, NoteLike>;
    teamFolders: ReadonlyMap<number, FolderLike>;
    sharedNotes: ReadonlyMap<number, { ownerName?: string | null }>;
    taskNotes: ReadonlyMap<
        number,
        { displayId?: string | null; taskTitle?: string; projectName?: string }
    >;
    chatNotes: ReadonlyMap<
        number,
        { chatName?: string; chatTypeName?: string; chatType?: number }
    >;
};

export type LocationLabels = {
    myNotes: string;
    teamNotes: string;
    sharedNotes: string;
    /** "Shared by Carol Park" */
    sharedBy: (ownerName: string) => string;
    /** The label for a kind of chat ("Direct message", "Group"), for a chat with no name. */
    chatType: (chatType: number | undefined) => string;
};

/** The separator between a space and the folders under it. */
const SEP = " › ";
/** Shown for a long folder path: the space, an ellipsis, then the innermost folders. */
const ELLIPSIS = "…";
const KEEP_FOLDERS = 2;
const MAX_STEPS = 64;

const indexBy = <T>(rows: readonly T[], key: (row: T) => number): Map<number, T> =>
    new Map(rows.map((row) => [key(row), row]));

/** The maps `noteLocation` reads, from the sidebar's loaded lists. */
export const buildLocationSources = (lists: {
    myNoteMeta: readonly NoteLike[];
    myNoteFolders: readonly FolderLike[];
    teamNoteMeta: readonly NoteLike[];
    teamNoteFolders: readonly FolderLike[];
    sharedNoteMeta: readonly { noteId: number; ownerName?: string | null }[];
    taskNoteMeta: readonly {
        noteId: number;
        displayId?: string | null;
        taskTitle?: string;
        projectName?: string;
    }[];
    chatNoteMeta: readonly {
        noteId: number;
        chatName?: string;
        chatTypeName?: string;
        chatType?: number;
    }[];
}): LocationSources => ({
    myNotes: indexBy(lists.myNoteMeta, (n) => n.noteId),
    myFolders: indexBy(lists.myNoteFolders, (f) => f.folderId),
    teamNotes: indexBy(lists.teamNoteMeta, (n) => n.noteId),
    teamFolders: indexBy(lists.teamNoteFolders, (f) => f.folderId),
    sharedNotes: indexBy(lists.sharedNoteMeta, (n) => n.noteId),
    taskNotes: indexBy(lists.taskNoteMeta, (n) => n.noteId),
    chatNotes: indexBy(lists.chatNoteMeta, (n) => n.noteId),
});

/** The folder a note is filed in. A child note follows its root (`folderId` is only meaningful
 *  on a root note). The step cap guards a corrupt parent loop. */
const folderOfNote = (noteId: number, notes: ReadonlyMap<number, NoteLike>): number | null => {
    let note = notes.get(noteId);
    for (let i = 0; note && i < MAX_STEPS; i++) {
        if (note.parentNoteId == null) return note.folderId ?? null;
        note = notes.get(note.parentNoteId);
    }
    return note?.folderId ?? null;
};

/** Folder names from the outermost down to `folderId`. A folder that is missing ends the walk. */
const folderNames = (
    folderId: number | null,
    folders: ReadonlyMap<number, FolderLike>
): string[] => {
    const names: string[] = [];
    const seen = new Set<number>();
    for (let id = folderId; id != null && !seen.has(id); ) {
        seen.add(id);
        const folder = folders.get(id);
        if (!folder) break;
        names.unshift(folder.name);
        id = folder.parentFolderId;
    }
    return names;
};

const trail = (space: string | null, folders: string[]): string | null => {
    // A long path keeps the part that tells notes apart: the innermost folders.
    const shown =
        folders.length > KEEP_FOLDERS ? [ELLIPSIS, ...folders.slice(-KEEP_FOLDERS)] : folders;
    const parts = space ? [space, ...shown] : shown;
    return parts.length > 0 ? parts.join(SEP) : null;
};

export type NoteLocationOptions = {
    /** Leave out the space's own name ("My Notes"). For a list already grouped under it. */
    includeSpace?: boolean;
};

export const noteLocation = (
    noteType: number,
    note: {
        noteId: number;
        // what the row itself may carry (the recents/favorites payload)
        displayId?: string | null;
        taskTitle?: string;
        projectName?: string;
        chatName?: string;
        chatTypeName?: string;
        chatType?: number;
    },
    sources: LocationSources,
    labels: LocationLabels,
    { includeSpace = true }: NoteLocationOptions = {}
): string | null => {
    switch (noteType) {
        case 1: {
            const folders = folderNames(
                folderOfNote(note.noteId, sources.myNotes),
                sources.myFolders
            );
            return trail(includeSpace ? labels.myNotes : null, folders);
        }
        case 8: {
            const folders = folderNames(
                folderOfNote(note.noteId, sources.teamNotes),
                sources.teamFolders
            );
            return trail(includeSpace ? labels.teamNotes : null, folders);
        }
        case 4: {
            const owner = sources.sharedNotes.get(note.noteId)?.ownerName?.trim();
            if (owner) return labels.sharedBy(owner);
            return includeSpace ? labels.sharedNotes : null;
        }
        case 2: {
            const known = sources.taskNotes.get(note.noteId);
            // The display id ("QR-2") or nothing: never the internal number ("#12953").
            const id = (known?.displayId || note.displayId || "").trim();
            const title = (known?.taskTitle || note.taskTitle || "").trim();
            const project = (known?.projectName || note.projectName || "").trim();
            const line = [id || project, title].filter(Boolean).join(" · ");
            return line || null;
        }
        case 3: {
            const known = sources.chatNotes.get(note.noteId);
            const name = (known?.chatName || note.chatName || "").trim();
            if (name) return name;
            const kind = known?.chatTypeName || note.chatTypeName;
            return kind || labels.chatType(known?.chatType ?? note.chatType) || null;
        }
        default:
            return null;
    }
};
