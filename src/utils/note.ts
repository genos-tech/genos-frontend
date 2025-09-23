import {
    ChatNoteMetaTreeNode,
    MyNoteMetaTreeNode,
    MyNoteMetaProps,
    TaskNoteMetaProps,
    ChatNoteMetaProps,
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
