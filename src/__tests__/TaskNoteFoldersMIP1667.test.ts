/**
 * MIP-1667. The Task Notes folders follow the task tree: a sub-task's folder sits inside its parent's,
 * at any depth, and a milestone's tasks sit inside the milestone's folder. The sidebar used to know a
 * note's immediate parent only, so a task, its sub-tasks and (since MIP-1430) its milestone were all
 * listed at one level, and two levels was as deep as it went.
 *
 * `buildTaskFolders` is the pure part; what it draws is checked in a real browser (see the PR).
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import type { TaskNoteMetaTreeNode } from "../features/notes/common/types/noteTypes";
import {
    buildTaskFolders,
    folderHoldsNote,
    type TaskFolder,
} from "../features/notes/common/utils/taskNoteFolders";
import type { TaskNoteAncestor } from "../types/notes";

const LABELS = { project: (id: number) => `Project ${id}`, task: (id: number) => `Task ${id}` };

let nextNote = 100;
const anc = (taskId: number, title: string, isMilestone = false): TaskNoteAncestor => ({
    taskId,
    title,
    displayId: `QR-${taskId}`,
    isMilestone,
});
/** A note on `taskId`, with the tasks above it (root first) the way the API sends them. */
const note = (
    taskId: number,
    title: string,
    ancestors: TaskNoteAncestor[] | undefined,
    extra: Partial<TaskNoteMetaTreeNode> = {}
): TaskNoteMetaTreeNode =>
    ({
        noteType: 2,
        noteId: (nextNote += 1),
        title: `Note on ${title}`,
        children: [],
        projectId: 1,
        projectName: "Roadmap",
        taskId,
        taskTitle: title,
        displayId: `QR-${taskId}`,
        ancestors,
        ...extra,
    }) as TaskNoteMetaTreeNode;

const shape = (folder: TaskFolder): unknown => [
    folder.title + (folder.isMilestone ? " (milestone)" : ""),
    folder.notes.length,
    folder.children.map(shape),
];
const build = (notes: TaskNoteMetaTreeNode[]) => buildTaskFolders(notes, LABELS);

const M = anc(10, "Launch", true);
const A = anc(11, "A");
const B = anc(12, "B");

describe("a sub-task's folder is inside its parent's", () => {
    it("nests milestone > task > sub-task > sub-sub-task, one note on each", () => {
        const [project] = build([
            note(13, "C", [M, A, B]),
            note(12, "B", [M, A]),
            note(11, "A", [M]),
            note(10, "Launch", [], { isMilestone: true }),
        ]);
        expect(project.folders.map(shape)).toEqual([
            ["Launch (milestone)", 1, [["A", 1, [["B", 1, [["C", 1, []]]]]]]],
        ]);
    });

    it("draws the parent's folder even when the parent has no note of its own", () => {
        const [project] = build([note(12, "B", [M, A])]);
        expect(project.folders.map(shape)).toEqual([
            ["Launch (milestone)", 0, [["A", 0, [["B", 1, []]]]]],
        ]);
    });

    it("puts sub-tasks of one task in that task's one folder", () => {
        const [project] = build([
            note(12, "B", [M, A]),
            note(14, "D", [M, A]),
            note(11, "A", [M]),
        ]);
        const launch = project.folders[0];
        expect(launch.children).toHaveLength(1);
        expect(launch.children[0].title).toBe("A");
        expect(launch.children[0].children.map((c) => c.title)).toEqual(["B", "D"]);
    });

    it("follows a deep chain all the way (no two-level limit)", () => {
        const chain = Array.from({ length: 10 }, (_, i) => anc(200 + i, `L${i}`));
        const [project] = build([note(300, "Leaf", chain)]);
        let folder: TaskFolder | undefined = project.folders[0];
        const depth: string[] = [];
        while (folder) {
            depth.push(folder.title);
            folder = folder.children[0];
        }
        expect(depth).toEqual([...chain.map((a) => a.title), "Leaf"]);
    });

    it("keeps several notes of one task in its one folder", () => {
        const [project] = build([note(11, "A", [M]), note(11, "A", [M])]);
        expect(project.folders[0].children[0].notes).toHaveLength(2);
    });
});

describe("where the top folders sit", () => {
    it("lists a milestone before the tasks that have no parent", () => {
        const [project] = build([
            note(50, "Loose", []),
            note(11, "A", [M]),
            note(51, "Other loose", []),
        ]);
        expect(project.folders.map((f) => f.title)).toEqual(["Launch", "Loose", "Other loose"]);
        expect(project.folders[0].isMilestone).toBe(true);
    });

    it("keeps projects apart, named by the notes", () => {
        const projects = build([
            note(1, "X", [], { projectId: 1, projectName: "Roadmap" }),
            note(2, "Y", [], { projectId: 2, projectName: undefined }),
        ]);
        expect(projects.map((p) => [p.projectId, p.projectName])).toEqual([
            [1, "Roadmap"],
            [2, "Project 2"],
        ]);
    });
});

describe("an API that has no `ancestors` yet", () => {
    const legacy = (taskId: number, title: string, parent?: TaskNoteAncestor, extra = {}) =>
        note(taskId, title, undefined, {
            parentTaskId: parent?.taskId ?? null,
            parentTaskTitle: parent?.title ?? null,
            parentTaskDisplayId: parent?.displayId ?? null,
            parentTaskIsMilestone: parent ? parent.isMilestone : null,
            ...extra,
        });

    it("still nests by the parent it does have", () => {
        const [project] = build([legacy(12, "B", A)]);
        expect(project.folders.map(shape)).toEqual([["A", 0, [["B", 1, []]]]]);
    });

    it("joins what the notes say into ONE tree, not two folders for one task", () => {
        // B says "A is above me"; A says "the milestone is above me": A is one folder, in the milestone.
        const [project] = build([
            legacy(12, "B", A),
            legacy(11, "A", M),
            legacy(10, "Launch", undefined, { isMilestone: true }),
        ]);
        expect(project.folders.map(shape)).toEqual([
            ["Launch (milestone)", 1, [["A", 1, [["B", 1, []]]]]],
        ]);
    });
});

describe("a damaged tree cannot loop or repeat a folder", () => {
    it("ends a cycle (X above Y above X)", () => {
        const X = anc(1, "X");
        const Y = anc(2, "Y");
        const [project] = build([note(2, "Y", [X]), note(1, "X", [Y])]);
        // One of them is the root; each folder is there once and the walk ends.
        const titles: string[] = [];
        const walk = (f: TaskFolder) => {
            titles.push(f.title);
            f.children.forEach(walk);
        };
        project.folders.forEach(walk);
        expect(titles.sort()).toEqual(["X", "Y"]);
    });

    it("ignores a task listed above itself", () => {
        const self = anc(7, "Self");
        const [project] = build([note(7, "Self", [self])]);
        expect(project.folders.map(shape)).toEqual([["Self", 1, []]]);
    });
});

describe("a folder is named by the best thing any note says of it", () => {
    it("a task first met as a bare parent takes its real title and id once its own note arrives", () => {
        const bare: TaskNoteAncestor = {
            taskId: 11,
            title: null,
            displayId: null,
            isMilestone: false,
        };
        const [project] = build([note(12, "B", [bare]), note(11, "A", [])]);
        const folder = project.folders[0];
        expect(folder.title).toBe("A");
        expect(folder.displayId).toBe("QR-11");
    });

    it("falls back to a label when no note knows a title", () => {
        const bare: TaskNoteAncestor = {
            taskId: 11,
            title: null,
            displayId: null,
            isMilestone: false,
        };
        const [project] = build([note(12, "B", [bare])]);
        expect(project.folders[0].title).toBe("Task 11");
        expect(project.folders[0].displayId).toBeNull();
    });
});

describe("notes that disagree about where a task sits", () => {
    it("keep ONE folder for the task, under the first parent a note named (a stale list never doubles it)", () => {
        // A task that was moved: one note still says it is under A, another (older) says X.
        const X = anc(40, "X");
        const [project] = build([note(12, "B", [M, A]), note(12, "B", [X])]);
        const everyFolder: string[] = [];
        const walk = (f: TaskFolder) => {
            everyFolder.push(f.title);
            f.children.forEach(walk);
        };
        project.folders.forEach(walk);
        expect(everyFolder.filter((t) => t === "B")).toHaveLength(1);
        expect(
            project.folders.find((f) => f.title === "Launch")?.children[0].children[0].title
        ).toBe("B");
    });

    it("flag a milestone even when its folder was first met as a plain parent", () => {
        const plain: TaskNoteAncestor = {
            taskId: 10,
            title: "Launch",
            displayId: "QR-10",
            isMilestone: false,
        };
        const [project] = build([
            note(11, "A", [plain]),
            note(10, "Launch", [], { isMilestone: true }),
        ]);
        expect(project.folders[0].isMilestone).toBe(true);
    });
});

describe("the path to the open note", () => {
    it("is found at any depth, and only along its own path", () => {
        const deep = note(13, "C", [M, A, B]);
        const other = note(60, "Elsewhere", []);
        const [project] = build([deep, other]);
        const [launch, elsewhere] = project.folders;
        expect(folderHoldsNote(launch, deep.noteId)).toBe(true);
        expect(folderHoldsNote(launch.children[0], deep.noteId)).toBe(true);
        expect(folderHoldsNote(elsewhere, deep.noteId)).toBe(false);
        expect(folderHoldsNote(launch, undefined)).toBe(false);
    });
});

describe("`ancestors` survives the places that copy a note's fields by name", () => {
    // A new note's row and a moved note's rows are built field by field, so a field that is not named
    // there is lost: a MOVED note would keep the OLD task's chain (the spread of the old row) and show up
    // under the old parent until the next refetch.
    const hook = readFileSync(
        join(dirname(fileURLToPath(import.meta.url)), "../hooks/notes/useNoteManagement.ts"),
        "utf8"
    );

    it("a newly created note's row takes it from the create response", () => {
        expect(hook).toMatch(/ancestors:\s*newNoteAny\.ancestors,/);
    });

    it("every row of a moved note's chain takes it from the move response", () => {
        expect(hook).toMatch(/ancestors:\s*moved\.ancestors,/);
    });
});

describe("the sidebar draws the tree recursively", () => {
    const sidebar = readFileSync(
        join(
            dirname(fileURLToPath(import.meta.url)),
            "../features/notes/common/components/NoteSidebar.tsx"
        ),
        "utf8"
    );

    it("builds its folders with buildTaskFolders, not the old two-level grouping", () => {
        expect(sidebar).toContain("buildTaskFolders(");
        expect(sidebar).not.toContain("groupTaskNotes");
        expect(sidebar).not.toContain("projectRows");
    });

    it("draws a folder's sub-folders inside it, with the same function", () => {
        expect(sidebar).toMatch(
            /folder\.children\.map\(\(child\) => renderTaskFolder\(child, activeNoteId, projectId\)\)/
        );
    });

    it("draws each top folder of a project through it", () => {
        expect(sidebar).toMatch(
            /projectGroup\.folders\.map\(\(folder\) =>\s*renderTaskFolder\(folder, activeNoteId, projectGroup\.projectId\)/
        );
    });

    it("opens the path to the open note at every level", () => {
        expect(sidebar).toMatch(/defaultExpanded=\{folderHoldsNote\(folder, activeNoteId\)\}/);
    });

    it("draws a milestone with the flag, a task with the task icon", () => {
        expect(sidebar).toMatch(
            /folder\.isMilestone \?[\s\S]{0,160}<FlagRoundedIcon[\s\S]{0,120}<AssignmentOutlinedIcon \/>/
        );
    });
});
