/**
 * Laying a folder out as paths in a zip.
 *
 * The layout is a contract in two directions: it's what the user sees in
 * Finder, and it's what `folderImportPlan` reads if the zip ever comes
 * back. The rules that make both work — a note's children in a directory
 * named after it, folder membership taken from the ROOT note only — are
 * invisible in the UI and easy to break, so they're pinned here.
 */

import { describe, expect, it } from "vitest";

import {
    buildFolderExportPlan,
    safePathSegment,
} from "../features/notes/common/services/folderExportPlan";
import { MyNoteFolderProps, MyNoteMetaProps } from "../types/notes";

const folder = (folderId: number, name: string, parentFolderId: number | null = null) =>
    ({ folderId, name, parentFolderId }) as MyNoteFolderProps;

const note = (
    noteId: number,
    title: string,
    extra: { folderId?: number | null; parentNoteId?: number | null } = {}
) =>
    ({
        noteId,
        title,
        noteType: 1,
        parentNoteId: extra.parentNoteId ?? null,
        folderId: extra.folderId ?? null,
        tsUpdated: "2026-01-01",
    }) as MyNoteMetaProps;

const paths = (plan: ReturnType<typeof buildFolderExportPlan>) => plan.entries.map((e) => e.path);

describe("safePathSegment", () => {
    it("drops the characters a filesystem would reject", () => {
        expect(safePathSegment("Q3: plans/ideas?")).toBe("Q3 plans ideas");
    });

    it("won't produce a hidden file or a bare dot", () => {
        // A leading dot hides the file on Unix and makes our own importer
        // skip it on the way back in.
        expect(safePathSegment(".hidden")).toBe("hidden");
        expect(safePathSegment("...")).toBe("note");
        expect(safePathSegment("")).toBe("note");
    });

    it("keeps long titles inside a sane path length", () => {
        expect(safePathSegment("a".repeat(200))).toHaveLength(80);
    });
});

describe("buildFolderExportPlan", () => {
    it("puts everything under one directory named for the folder", () => {
        const plan = buildFolderExportPlan({
            rootFolderId: 1,
            rootName: "Roadmap",
            folders: [folder(1, "Roadmap")],
            noteMeta: [note(10, "Intro", { folderId: 1 })],
        });
        // Extracting must never spray files across the download folder.
        expect(paths(plan)).toEqual(["Roadmap/Intro"]);
    });

    it("recreates nested subfolders and counts them", () => {
        const plan = buildFolderExportPlan({
            rootFolderId: 1,
            rootName: "Roadmap",
            folders: [folder(1, "Roadmap"), folder(2, "Q3", 1), folder(3, "Specs", 2)],
            noteMeta: [note(10, "Launch", { folderId: 3 })],
        });
        expect(paths(plan)).toEqual(["Roadmap/Q3/Specs/Launch"]);
        expect(plan.folderCount).toBe(2);
    });

    it("writes a note's children into a directory named after it", () => {
        // The Notion convention, and the reason our own importer can read
        // the result back as the same tree.
        const plan = buildFolderExportPlan({
            rootFolderId: 1,
            rootName: "Roadmap",
            folders: [folder(1, "Roadmap")],
            noteMeta: [
                note(10, "Launch", { folderId: 1 }),
                note(11, "Risks", { parentNoteId: 10 }),
                note(12, "Timeline", { parentNoteId: 11 }),
            ],
        });
        expect(paths(plan)).toEqual([
            "Roadmap/Launch",
            "Roadmap/Launch/Risks",
            "Roadmap/Launch/Risks/Timeline",
        ]);
    });

    it("files a note by its root's folder, never a child's stale one", () => {
        // The backend only maintains folderId on roots; following a
        // child's copy would export it twice, in two places.
        const plan = buildFolderExportPlan({
            rootFolderId: 1,
            rootName: "Roadmap",
            folders: [folder(1, "Roadmap"), folder(2, "Q3", 1)],
            noteMeta: [
                note(10, "Launch", { folderId: 1 }),
                note(11, "Risks", { parentNoteId: 10, folderId: 2 }),
            ],
        });
        expect(paths(plan)).toEqual(["Roadmap/Launch", "Roadmap/Launch/Risks"]);
    });

    it("leaves everything outside the chosen subtree alone", () => {
        const plan = buildFolderExportPlan({
            rootFolderId: 2,
            rootName: "Q3",
            folders: [folder(1, "Roadmap"), folder(2, "Q3", 1), folder(3, "Q4", 1)],
            noteMeta: [
                note(10, "Sibling", { folderId: 3 }),
                note(11, "Mine", { folderId: 2 }),
                note(12, "Unfiled"),
            ],
        });
        expect(paths(plan)).toEqual(["Q3/Mine"]);
    });

    it("keeps same-named notes apart so the zip doesn't lose one", () => {
        // Two notes can share a title; two files in a directory cannot.
        const plan = buildFolderExportPlan({
            rootFolderId: 1,
            rootName: "Roadmap",
            folders: [folder(1, "Roadmap")],
            noteMeta: [
                note(10, "Notes", { folderId: 1 }),
                note(11, "Notes", { folderId: 1 }),
                note(12, "Notes", { folderId: 1 }),
            ],
        });
        expect(paths(plan)).toEqual(["Roadmap/Notes", "Roadmap/Notes (2)", "Roadmap/Notes (3)"]);
    });

    it("treats a subfolder and a note of the same name as a clash", () => {
        // They'd land as `Ideas/` and `Ideas.md` — fine — but `Ideas.md`'s
        // own images and children also want `Ideas/`, which is the
        // subfolder. Renaming keeps the two apart.
        const plan = buildFolderExportPlan({
            rootFolderId: 1,
            rootName: "Roadmap",
            folders: [folder(1, "Roadmap"), folder(2, "Ideas", 1)],
            noteMeta: [note(10, "Ideas", { folderId: 1 })],
        });
        expect(paths(plan)).toEqual(["Roadmap/Ideas (2)"]);
    });

    it("sanitizes titles that would break a path", () => {
        const plan = buildFolderExportPlan({
            rootFolderId: 1,
            rootName: "Road/map",
            folders: [folder(1, "Road/map")],
            noteMeta: [note(10, "Q3: plan", { folderId: 1 })],
        });
        expect(paths(plan)).toEqual(["Road map/Q3 plan"]);
    });

    it("keeps the real title for display even when the path is sanitized", () => {
        const plan = buildFolderExportPlan({
            rootFolderId: 1,
            rootName: "Roadmap",
            folders: [folder(1, "Roadmap")],
            noteMeta: [note(10, "Q3: plan", { folderId: 1 })],
        });
        expect(plan.entries[0]).toMatchObject({ noteId: 10, title: "Q3: plan" });
    });

    it("survives a folder loop rather than hanging", () => {
        const plan = buildFolderExportPlan({
            rootFolderId: 1,
            rootName: "Roadmap",
            folders: [folder(1, "Roadmap", 2), folder(2, "Q3", 1)],
            noteMeta: [note(10, "Launch", { folderId: 2 })],
        });
        expect(paths(plan)).toEqual(["Roadmap/Q3/Launch"]);
    });

    it("reports an empty folder as having nothing to export", () => {
        const plan = buildFolderExportPlan({
            rootFolderId: 1,
            rootName: "Roadmap",
            folders: [folder(1, "Roadmap")],
            noteMeta: [],
        });
        expect(plan.entries).toEqual([]);
    });
});
