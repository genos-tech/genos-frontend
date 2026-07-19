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

// Outermost-first folder ancestry for a note filed in `folderId`,
// resolved to {folderId, name} crumbs for the note-header breadcrumb.
// Built on `collectFolderAncestorIds` (nearest-first, cycle-safe) then
// reversed. An unknown/absent folderId — a folder-less note, or a shared
// note whose owner's folder isn't in this user's list — yields []
// (folders are never shared, so no cross-user leak).
export function buildFolderCrumbChain(
    folders: MyNoteFolderProps[],
    folderId: number | null | undefined
): { folderId: number; name: string }[] {
    const byId = new Map(folders.map((f) => [f.folderId, f]));
    return collectFolderAncestorIds(folders, folderId)
        .slice()
        .reverse()
        .flatMap((id) => {
            const folder = byId.get(id);
            return folder ? [{ folderId: folder.folderId, name: folder.name }] : [];
        });
}

export type TaskNoteCrumbKind = "project" | "milestone" | "task";

export interface TaskNoteCrumb {
    key: string;
    label: string;
    kind: TaskNoteCrumbKind;
}

// Container ancestry for a task note's breadcrumb, mirroring the sidebar's
// Project → Milestone → (parent Task →) Task nesting
// (NoteSidebar.groupTaskNotes). All notes in a task-note chain belong to
// the same task, so pass the chain's ROOT meta node. Names come off that
// row; `#<id>` is the fallback when the API omits one.
export function buildTaskNoteContextCrumbs(
    root: TaskNoteMetaProps | null | undefined
): TaskNoteCrumb[] {
    if (!root) return [];
    const crumbs: TaskNoteCrumb[] = [
        {
            key: `proj-${root.projectId}`,
            label: root.projectName || `#${root.projectId}`,
            kind: "project",
        },
    ];
    // The milestone the task sits under, if any (the sidebar's optional
    // middle level) — this was the missing crumb.
    if (root.milestoneId != null) {
        crumbs.push({
            key: `mile-${root.milestoneId}`,
            label: root.milestoneTitle || `#${root.milestoneId}`,
            kind: "milestone",
        });
    }
    // A note ON a milestone's backing task sits at the milestone level —
    // the milestone crumb already represents that task, so stop here.
    if (root.isMilestone === true && root.milestoneId != null) {
        return crumbs;
    }
    // A subtask note nests under its immediate parent task — unless that
    // parent IS the milestone's backing task (already the milestone crumb).
    if (root.parentTaskId != null && root.parentTaskIsMilestone !== true) {
        crumbs.push({
            key: `ptask-${root.parentTaskId}`,
            label: root.parentTaskTitle || root.parentTaskDisplayId || `#${root.parentTaskId}`,
            kind: "task",
        });
    }
    crumbs.push({
        key: `task-${root.taskId}`,
        label: root.taskTitle || root.displayId || `#${root.taskId}`,
        kind: "task",
    });
    return crumbs;
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
