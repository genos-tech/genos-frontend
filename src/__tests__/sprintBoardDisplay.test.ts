import { describe, expect, it } from "vitest";

import { buildBoardDisplaySet } from "../features/tasks/utils/sprintBoardDisplay";
import { TaskTableProps } from "../types/tasks";

// Minimal task-row factory — only the fields the display logic reads.
const task = (id: string, over: Partial<TaskTableProps> = {}): TaskTableProps =>
    ({
        id,
        title: `T${id}`,
        parentTaskId: null,
        isMilestone: false,
        milestoneId: null,
        status: "Open",
        ...over,
    }) as TaskTableProps;

// Hierarchy used across the patterns:
//   Milestone M1 (backing task "m1")
//     ├─ Task t1  (parent m1)
//     │    └─ Subtask s1 (parent t1)
//     └─ Task t2  (parent m1)
//   Orphan root task o1 (no milestone, no parent)
const m1 = task("m1", { isMilestone: true, milestoneId: 1 });
const t1 = task("t1", { parentTaskId: "m1", milestoneId: 1 });
const t2 = task("t2", { parentTaskId: "m1", milestoneId: 1 });
const s1 = task("s1", { parentTaskId: "t1", milestoneId: 1 });
const o1 = task("o1"); // orphan root
const allTasks = [m1, t1, t2, s1, o1];

const ids = (rows: TaskTableProps[]) => rows.map((r) => r.id).sort();

describe("buildBoardDisplaySet — unscoped (milestones + orphans)", () => {
    // Unscoped: filteredTasks = roots (milestone cards + orphan roots).
    const filteredTasks = [m1, o1];
    const visibleChildTaskIds = new Set(["t1", "t2", "s1"]);

    it("collapsed (pattern i): shows milestone cards + orphan roots, no tasks", () => {
        const out = buildBoardDisplaySet({
            filteredTasks,
            visibleChildTaskIds,
            allTasks,
            scoped: false,
            memberFilterActive: false,
            expandExtraDepth: false,
        });
        expect(ids(out)).toEqual(["m1", "o1"]);
    });

    it("expanded 'Show tasks' (pattern ii): adds milestone DIRECT tasks only (not subtasks)", () => {
        const out = buildBoardDisplaySet({
            filteredTasks,
            visibleChildTaskIds,
            allTasks,
            scoped: false,
            memberFilterActive: false,
            expandExtraDepth: true,
        });
        // m1 + o1 + m1's direct tasks (t1, t2). s1 (a subtask) stays hidden.
        expect(ids(out)).toEqual(["m1", "o1", "t1", "t2"]);
        expect(out.map((r) => r.id)).not.toContain("s1");
    });
});

describe("buildBoardDisplaySet — scoped to a milestone", () => {
    // Scoped: filteredTasks carries the milestone card + its flattened matches.
    const filteredTasks = [m1, t1, t2, s1];
    const visibleChildTaskIds = new Set(["t1", "t2", "s1"]);

    it("collapsed (pattern iii): shows the milestone's DIRECT tasks, hides the milestone card", () => {
        const out = buildBoardDisplaySet({
            filteredTasks,
            visibleChildTaskIds,
            allTasks,
            scoped: true,
            memberFilterActive: false,
            expandExtraDepth: false,
        });
        expect(ids(out)).toEqual(["t1", "t2"]);
        expect(out.map((r) => r.id)).not.toContain("m1"); // card hidden
        expect(out.map((r) => r.id)).not.toContain("s1"); // subtask hidden
    });

    it("expanded 'Show subtasks' (pattern iv): adds those tasks' DIRECT subtasks", () => {
        const out = buildBoardDisplaySet({
            filteredTasks,
            visibleChildTaskIds,
            allTasks,
            scoped: true,
            memberFilterActive: false,
            expandExtraDepth: true,
        });
        expect(ids(out)).toEqual(["s1", "t1", "t2"]);
        expect(out.map((r) => r.id)).not.toContain("m1");
    });
});

describe("buildBoardDisplaySet — edges", () => {
    it("scoped milestone with NO direct tasks → empty board (card hidden, nothing else)", () => {
        const emptyM = task("mE", { isMilestone: true, milestoneId: 2 });
        const out = buildBoardDisplaySet({
            filteredTasks: [emptyM],
            visibleChildTaskIds: new Set(),
            allTasks: [emptyM],
            scoped: true,
            memberFilterActive: false,
            expandExtraDepth: false,
        });
        expect(out).toEqual([]);
    });

    it("a direct task that did NOT pass the filter is not revealed on expand", () => {
        // t2 is absent from visibleChildTaskIds → it did not pass the filter.
        const out = buildBoardDisplaySet({
            filteredTasks: [m1, o1],
            visibleChildTaskIds: new Set(["t1"]),
            allTasks,
            scoped: false,
            memberFilterActive: false,
            expandExtraDepth: true,
        });
        expect(ids(out)).toEqual(["m1", "o1", "t1"]);
        expect(out.map((r) => r.id)).not.toContain("t2");
    });

    it("member filter: flat matches, depth model bypassed", () => {
        const flat = [t1, s1]; // whatever the member-filter pipeline produced
        const out = buildBoardDisplaySet({
            filteredTasks: flat,
            visibleChildTaskIds: new Set(["t1", "s1"]),
            allTasks,
            scoped: false,
            memberFilterActive: true,
            expandExtraDepth: true, // ignored under member filter
        });
        expect(ids(out)).toEqual(["s1", "t1"]);
    });

    it("dedupes by id", () => {
        // filteredTasks accidentally contains t1 twice.
        const out = buildBoardDisplaySet({
            filteredTasks: [t1, t1],
            visibleChildTaskIds: new Set(),
            allTasks,
            scoped: false,
            memberFilterActive: true,
            expandExtraDepth: false,
        });
        expect(out).toHaveLength(1);
    });
});
