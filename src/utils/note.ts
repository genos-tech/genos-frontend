import {
    ChatNoteMetaProps,
    ChatNoteMetaTreeNode,
    MyNoteFolderForest,
    MyNoteFolderProps,
    MyNoteFolderTreeNode,
    MyNoteMetaProps,
    MyNoteMetaTreeNode,
    SharedNoteMetaProps,
    SharedNoteMetaTreeNode,
    TaskNoteMetaProps,
    TaskNoteMetaTreeNode,
} from "../types/notes";

// Build a tree structure
export function buildMyNoteTree(items: MyNoteMetaProps[]): MyNoteMetaTreeNode[] {
    const map: Record<number, MyNoteMetaTreeNode> = {};
    const roots: MyNoteMetaTreeNode[] = [];

    // Initialize each item with children: []
    items.forEach((item) => {
        map[item.noteId] = { ...item, children: [] };
    });

    items.forEach((item) => {
        if (item.parentNoteId && map[item.parentNoteId]) {
            map[item.parentNoteId].children.push(map[item.noteId]);
        } else {
            roots.push(map[item.noteId]);
        }
    });

    return roots;
}

// Merge the user's folder list with the note tree for the My Notes
// sidebar. Orphan rules (self-healing against races with deletes):
//   - folder whose parentFolderId isn't in the list → root folder
//   - note root whose folderId isn't in the list → rootNotes
// Notes attach only by their ROOT node's folderId — child notes ride
// along inside `node.children` regardless of their own folderId.
// Folders sort by name; note order follows `noteRoots` (already
// -tsUpdated from the meta endpoint).
export function buildMyNoteFolderForest(
    folders: MyNoteFolderProps[],
    noteRoots: MyNoteMetaTreeNode[]
): MyNoteFolderForest {
    const folderMap: Record<number, MyNoteFolderTreeNode> = {};
    folders.forEach((f) => {
        folderMap[f.folderId] = { ...f, childFolders: [], notes: [] };
    });

    const rootFolders: MyNoteFolderTreeNode[] = [];
    folders.forEach((f) => {
        const node = folderMap[f.folderId];
        if (f.parentFolderId != null && folderMap[f.parentFolderId]) {
            folderMap[f.parentFolderId].childFolders.push(node);
        } else {
            rootFolders.push(node);
        }
    });

    const rootNotes: MyNoteMetaTreeNode[] = [];
    noteRoots.forEach((note) => {
        if (note.folderId != null && folderMap[note.folderId]) {
            folderMap[note.folderId].notes.push(note);
        } else {
            rootNotes.push(note);
        }
    });

    const byName = (a: MyNoteFolderTreeNode, b: MyNoteFolderTreeNode) =>
        a.name.localeCompare(b.name);
    rootFolders.sort(byName);
    Object.values(folderMap).forEach((f) => f.childFolders.sort(byName));

    return { rootFolders, rootNotes };
}

// Ancestor folder chain for a folderId (nearest-first). Used by the
// sidebar to auto-expand every folder above a deep-linked note.
export function collectFolderAncestorIds(
    folders: MyNoteFolderProps[],
    folderId: number | null | undefined
): number[] {
    if (folderId == null) return [];
    const parentOf = new Map<number, number | null>();
    folders.forEach((f) => parentOf.set(f.folderId, f.parentFolderId));
    const chain: number[] = [];
    const visited = new Set<number>();
    let current: number | null | undefined = folderId;
    while (current != null && parentOf.has(current) && !visited.has(current)) {
        visited.add(current);
        chain.push(current);
        current = parentOf.get(current);
    }
    return chain;
}

// All folder ids inside `folderId`'s subtree, itself included. The
// move-to-folder picker disables these as targets (cycle prevention).
// Tolerates cycle-corrupt input via the visited set.
export function collectDescendantFolderIds(
    folders: MyNoteFolderProps[],
    folderId: number
): Set<number> {
    const childrenOf = new Map<number, number[]>();
    folders.forEach((f) => {
        if (f.parentFolderId != null) {
            const list = childrenOf.get(f.parentFolderId) ?? [];
            list.push(f.folderId);
            childrenOf.set(f.parentFolderId, list);
        }
    });
    const out = new Set<number>([folderId]);
    const frontier = [folderId];
    while (frontier.length > 0) {
        const current = frontier.pop()!;
        for (const child of childrenOf.get(current) ?? []) {
            if (!out.has(child)) {
                out.add(child);
                frontier.push(child);
            }
        }
    }
    return out;
}

// All note ids in `rootId`'s parent_note_id subtree, root included.
// Used by the task/chat re-anchor actions to optimistically patch every
// descendant row the backend cascade will touch. Tolerates
// cycle-corrupt input via the collected set.
export function collectNoteDescendantIds(
    items: { noteId: number; parentNoteId: number | null }[],
    rootId: number
): Set<number> {
    const childrenOf = new Map<number, number[]>();
    items.forEach((n) => {
        if (n.parentNoteId != null) {
            const list = childrenOf.get(n.parentNoteId) ?? [];
            list.push(n.noteId);
            childrenOf.set(n.parentNoteId, list);
        }
    });
    const out = new Set<number>([rootId]);
    const frontier = [rootId];
    while (frontier.length > 0) {
        const current = frontier.pop()!;
        for (const child of childrenOf.get(current) ?? []) {
            if (!out.has(child)) {
                out.add(child);
                frontier.push(child);
            }
        }
    }
    return out;
}

export function buildTaskNoteTree(items: TaskNoteMetaProps[]): TaskNoteMetaTreeNode[] {
    const map: Record<number, TaskNoteMetaTreeNode> = {};
    const roots: TaskNoteMetaTreeNode[] = [];

    // Initialize each item with children: []
    items.forEach((item) => {
        map[item.noteId] = { ...item, children: [] };
    });

    items.forEach((item) => {
        if (item.parentNoteId && map[item.parentNoteId]) {
            map[item.parentNoteId].children.push(map[item.noteId]);
        } else {
            roots.push(map[item.noteId]);
        }
    });

    return roots;
}

export function buildChatNoteTree(items: ChatNoteMetaProps[]): ChatNoteMetaTreeNode[] {
    const map: Record<number, ChatNoteMetaTreeNode> = {};
    const roots: ChatNoteMetaTreeNode[] = [];

    // Initialize each item with children: []
    items.forEach((item) => {
        map[item.noteId] = { ...item, children: [] };
    });

    items.forEach((item) => {
        if (item.parentNoteId && map[item.parentNoteId]) {
            map[item.parentNoteId].children.push(map[item.noteId]);
        } else {
            roots.push(map[item.noteId]);
        }
    });

    return roots;
}

export function buildSharedNoteTree(items: SharedNoteMetaProps[]): SharedNoteMetaTreeNode[] {
    const map: Record<number, SharedNoteMetaTreeNode> = {};
    const roots: SharedNoteMetaTreeNode[] = [];

    items.forEach((item) => {
        map[item.noteId] = { ...item, children: [] };
    });

    items.forEach((item) => {
        if (item.parentNoteId && map[item.parentNoteId]) {
            map[item.parentNoteId].children.push(map[item.noteId]);
        } else {
            roots.push(map[item.noteId]);
        }
    });

    return roots;
}
