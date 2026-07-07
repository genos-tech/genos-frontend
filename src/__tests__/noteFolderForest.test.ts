import { describe, expect, it } from "vitest";

import { MyNoteFolderProps, MyNoteMetaTreeNode } from "../types/notes";
import {
    buildMyNoteFolderForest,
    buildMyNoteTree,
    collectDescendantFolderIds,
    collectFolderAncestorIds,
} from "../utils/note";

const folder = (
    folderId: number,
    parentFolderId: number | null,
    name = `f${folderId}`
): MyNoteFolderProps => ({ folderId, parentFolderId, name });

const noteRoot = (
    noteId: number,
    folderId: number | null | undefined,
    children: MyNoteMetaTreeNode[] = []
): MyNoteMetaTreeNode => ({
    noteType: 1,
    noteId,
    parentNoteId: null,
    folderId,
    title: `n${noteId}`,
    tsUpdated: "2026-01-01T00:00:00Z",
    children,
});

describe("buildMyNoteFolderForest", () => {
    it("nests folders and attaches notes to their folder", () => {
        const folders = [folder(1, null, "B"), folder(2, 1, "child"), folder(3, null, "A")];
        const notes = [noteRoot(10, 1), noteRoot(11, 2), noteRoot(12, null)];

        const forest = buildMyNoteFolderForest(folders, notes);

        // Root folders sorted by name: A(3) then B(1).
        expect(forest.rootFolders.map((f) => f.folderId)).toEqual([3, 1]);
        const b = forest.rootFolders[1];
        expect(b.notes.map((n) => n.noteId)).toEqual([10]);
        expect(b.childFolders).toHaveLength(1);
        expect(b.childFolders[0].notes.map((n) => n.noteId)).toEqual([11]);
        expect(forest.rootNotes.map((n) => n.noteId)).toEqual([12]);
    });

    it("surfaces orphans at root (self-healing)", () => {
        // Folder 2's parent (99) doesn't exist; note 10's folder (77)
        // doesn't exist either — both must surface at root instead of
        // disappearing.
        const folders = [folder(2, 99)];
        const notes = [noteRoot(10, 77)];

        const forest = buildMyNoteFolderForest(folders, notes);

        expect(forest.rootFolders.map((f) => f.folderId)).toEqual([2]);
        expect(forest.rootNotes.map((n) => n.noteId)).toEqual([10]);
    });

    it("attaches a note by its ROOT node only — children ride along", () => {
        // Child note has no folderId of its own; it must stay nested
        // under its parent inside the folder, not escape to root.
        const roots = buildMyNoteTree([
            {
                noteType: 1,
                noteId: 1,
                parentNoteId: null,
                folderId: 5,
                title: "root",
                tsUpdated: "",
            },
            {
                noteType: 1,
                noteId: 2,
                parentNoteId: 1,
                folderId: null,
                title: "child",
                tsUpdated: "",
            },
        ]);
        const forest = buildMyNoteFolderForest([folder(5, null)], roots);

        expect(forest.rootNotes).toHaveLength(0);
        const filed = forest.rootFolders[0].notes;
        expect(filed.map((n) => n.noteId)).toEqual([1]);
        expect(filed[0].children.map((n) => n.noteId)).toEqual([2]);
    });
});

describe("collectFolderAncestorIds", () => {
    const folders = [folder(1, null), folder(2, 1), folder(3, 2)];

    it("returns the chain nearest-first", () => {
        expect(collectFolderAncestorIds(folders, 3)).toEqual([3, 2, 1]);
    });

    it("handles null and unknown ids", () => {
        expect(collectFolderAncestorIds(folders, null)).toEqual([]);
        expect(collectFolderAncestorIds(folders, 42)).toEqual([]);
    });

    it("terminates on cycle-corrupt input", () => {
        const corrupt = [folder(1, 2), folder(2, 1)];
        expect(collectFolderAncestorIds(corrupt, 1)).toEqual([1, 2]);
    });
});

describe("collectDescendantFolderIds", () => {
    const folders = [folder(1, null), folder(2, 1), folder(3, 2), folder(4, null)];

    it("includes self and the whole subtree", () => {
        expect([...collectDescendantFolderIds(folders, 1)].sort()).toEqual([1, 2, 3]);
    });

    it("leaf folder returns only itself", () => {
        expect([...collectDescendantFolderIds(folders, 4)]).toEqual([4]);
    });

    it("terminates on cycle-corrupt input", () => {
        const corrupt = [folder(1, 2), folder(2, 1)];
        expect([...collectDescendantFolderIds(corrupt, 1)].sort()).toEqual([1, 2]);
    });
});
