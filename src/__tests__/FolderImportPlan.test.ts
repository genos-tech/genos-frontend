/**
 * Mapping a picked directory onto folders and notes.
 *
 * The planner is pure and takes only `webkitRelativePath` strings, so a
 * whole Notion export can be described here without touching a disk. The
 * cases that matter are the ones Notion actually produces: id-suffixed
 * names, a parent page exported as both a file and a folder, and asset
 * directories sitting alongside the pages that reference them.
 */

import { describe, expect, it } from "vitest";

import {
    buildFolderImportPlan,
    describePlan,
    stripNotionId,
} from "../features/notes/common/services/folderImportPlan";

/** A File with the path `<input webkitdirectory>` would have given it. */
const at = (path: string, contents = "# hi"): File => {
    const file = new File([contents], path.split("/").pop() as string, {
        type: "text/markdown",
    });
    Object.defineProperty(file, "webkitRelativePath", { value: path });
    return file;
};

const folderNamed = (plan: ReturnType<typeof buildFolderImportPlan>, name: string) =>
    plan.root.folders.find((f) => f.name === name);

describe("stripNotionId", () => {
    it("removes the 32-hex id Notion appends to every page", () => {
        expect(stripNotionId("Roadmap 1f2e3d4c5b6a79881f2e3d4c5b6a7988")).toBe("Roadmap");
    });

    it("removes a dashed uuid too", () => {
        expect(stripNotionId("Roadmap 1f2e3d4c-5b6a-7988-1f2e-3d4c5b6a7988")).toBe("Roadmap");
    });

    it("leaves ordinary titles that merely end in a word alone", () => {
        // The whole risk of this rule is eating a real title, so it only
        // fires on a full-length id — not on anything hex-ish.
        expect(stripNotionId("Build 2024")).toBe("Build 2024");
        expect(stripNotionId("Rev deadbeef")).toBe("Rev deadbeef");
        expect(stripNotionId("Weekly Sync")).toBe("Weekly Sync");
    });

    it("keeps the name when the id is all there is", () => {
        const bare = "1f2e3d4c5b6a79881f2e3d4c5b6a7988";
        expect(stripNotionId(bare)).toBe(bare);
    });
});

describe("buildFolderImportPlan", () => {
    it("drops the picked folder's own name and keeps its contents", () => {
        // "Import this folder into here" means the contents land in the
        // destination — not a copy of the wrapper the user clicked.
        const plan = buildFolderImportPlan([at("Export/Alpha.md"), at("Export/Beta.md")]);
        expect(plan.root.name).toBe("");
        expect(plan.root.notes.map((n) => n.title)).toEqual(["Alpha", "Beta"]);
        expect(plan.folderCount).toBe(0);
        expect(plan.noteCount).toBe(2);
    });

    it("recreates nested directories as nested folders", () => {
        const plan = buildFolderImportPlan([
            at("Export/Projects/Roadmap.md"),
            at("Export/Projects/Q3/Launch.md"),
            at("Export/Loose.md"),
        ]);

        expect(plan.root.notes.map((n) => n.title)).toEqual(["Loose"]);
        const projects = folderNamed(plan, "Projects");
        expect(projects?.notes.map((n) => n.title)).toEqual(["Roadmap"]);
        expect(projects?.folders[0].name).toBe("Q3");
        expect(projects?.folders[0].notes.map((n) => n.title)).toEqual(["Launch"]);
        expect(plan.folderCount).toBe(2);
        expect(plan.noteCount).toBe(3);
    });

    it("files a Notion parent page inside its own folder", () => {
        // Notion exports a page that has children twice — once as the
        // .md holding its content, once as the folder holding its
        // children. Left literal, every parent page in the tree becomes
        // a stray note sitting next to a folder of the same name.
        const id = "1f2e3d4c5b6a79881f2e3d4c5b6a7988";
        const plan = buildFolderImportPlan([
            at(`Export/Roadmap ${id}.md`),
            at(`Export/Roadmap ${id}/Q3 ${id}.md`),
        ]);

        expect(plan.root.notes).toEqual([]);
        const roadmap = folderNamed(plan, "Roadmap");
        // The page's own content leads its children.
        expect(roadmap?.notes.map((n) => n.title)).toEqual(["Roadmap", "Q3"]);
        expect(plan.folderCount).toBe(1);
        expect(plan.noteCount).toBe(2);
    });

    it("keeps a page beside a folder that only shares part of its name", () => {
        const plan = buildFolderImportPlan([
            at("Export/Roadmap.md"),
            at("Export/Roadmap Archive/Old.md"),
        ]);
        expect(plan.root.notes.map((n) => n.title)).toEqual(["Roadmap"]);
        expect(folderNamed(plan, "Roadmap Archive")?.notes.map((n) => n.title)).toEqual(["Old"]);
    });

    it("collects non-markdown files as assets keyed by relative path", () => {
        const plan = buildFolderImportPlan([
            at("Export/Roadmap.md"),
            at("Export/Roadmap/diagram.png"),
            at("Export/database.csv"),
        ]);
        // Not notes, but not discarded either — the links inside the
        // markdown are what decide which of these get uploaded.
        expect([...plan.assets.keys()].sort()).toEqual(["Roadmap/diagram.png", "database.csv"]);
        expect(plan.noteCount).toBe(1);
    });

    it("ignores dotfiles and __MACOSX droppings", () => {
        const plan = buildFolderImportPlan([
            at("Export/.DS_Store"),
            at("Export/__MACOSX/._Alpha.md"),
            at("Export/Alpha.md"),
        ]);
        expect(plan.noteCount).toBe(1);
        expect(plan.assets.size).toBe(0);
    });

    it("records the source directory so relative links can resolve later", () => {
        const plan = buildFolderImportPlan([at("Export/Projects/Roadmap.md")]);
        expect(folderNamed(plan, "Projects")?.notes[0].sourceDir).toBe("Projects");
    });

    it("survives files with no webkitRelativePath at all", () => {
        // A plain multi-file selection has no paths; those files are
        // simply top level rather than a reason to produce nothing.
        const plain = new File(["# hi"], "Alpha.md");
        const plan = buildFolderImportPlan([plain]);
        expect(plan.root.notes.map((n) => n.title)).toEqual(["Alpha"]);
    });
});

describe("describePlan", () => {
    it("lists rows in creation order with folder depth", () => {
        const plan = buildFolderImportPlan([
            at("Export/Loose.md"),
            at("Export/Projects/Roadmap.md"),
            at("Export/Projects/Q3/Launch.md"),
        ]);
        expect(describePlan(plan.root)).toEqual([
            { kind: "note", label: "Loose", depth: 0 },
            { kind: "folder", label: "Projects", depth: 0 },
            { kind: "note", label: "Roadmap", depth: 1 },
            { kind: "folder", label: "Q3", depth: 1 },
            { kind: "note", label: "Launch", depth: 2 },
        ]);
    });
});
