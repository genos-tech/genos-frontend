import { MyNoteMetaTreeNode, NoteMetaProps } from "../types/notes";

// Build a tree structure
export function buildMyNoteTree(items: NoteMetaProps[]): MyNoteMetaTreeNode[] {
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
