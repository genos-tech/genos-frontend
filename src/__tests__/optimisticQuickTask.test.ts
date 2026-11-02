import { describe, expect, it } from "vitest";

import { pickScopedMilestoneId, quickAddParentFor } from "../features/tasks/utils/boardQuickAdd";
import { buildOptimisticQuickTask } from "../features/tasks/utils/optimisticQuickTask";
import { QuickAddDraft } from "../features/tasks/utils/quickAddDraft";
import { TaskTableProps } from "../types/tasks";

const draft: QuickAddDraft = {
    title: "New",
    assigneeId: "u2",
    status: "Open",
    priority: "High",
    effortLevel: null,
    dueDate: null,
    tags: [
        { tagName: "bug", tagColor: "#f00" },
        { tagName: "ui", tagColor: "#00f" },
    ] as never[],
};

describe("buildOptimisticQuickTask", () => {
    const base = { taskId: 7, displayId: "MIP-7", draft, projectId: 1, teamId: "t1" };

    it("builds a root task that is its own chain root", () => {
        const row = buildOptimisticQuickTask({ ...base, parent: null, assignee: undefined });
        expect(row).toMatchObject({
            id: "7",
            displayId: "MIP-7",
            parentTaskId: null,
            rootTaskId: 7,
            milestoneId: null,
            sprintId: null,
            isMilestone: false,
            projectId: 1,
            teamId: "t1",
        });
    });

    it("a child takes the parent's chain root, milestone and sprint", () => {
        const parent = {
            id: "3",
            rootTaskId: 2,
            milestoneId: 9,
            sprintId: 4,
        } as unknown as TaskTableProps;
        const row = buildOptimisticQuickTask({ ...base, parent, assignee: undefined });
        expect(row).toMatchObject({
            parentTaskId: "3",
            rootTaskId: 2,
            milestoneId: 9,
            sprintId: 4,
        });
    });

    it("writes tags in the server's '/a/b/' format, which the tag filters match", () => {
        const row = buildOptimisticQuickTask({ ...base, parent: null, assignee: undefined });
        expect(row.concatTags).toBe("/bug/ui/");
        expect(row.concatTags).toContain("/bug/");
        const none = buildOptimisticQuickTask({
            ...base,
            draft: { ...draft, tags: [] },
            parent: null,
            assignee: undefined,
        });
        expect(none.concatTags).toBeNull();
    });

    it("carries the assignee's name and avatar", () => {
        const row = buildOptimisticQuickTask({
            ...base,
            parent: null,
            assignee: { userEmail: "a@b.c", userName: "Ann", avatarImgPath: "/a.png" } as never,
        });
        expect(row).toMatchObject({
            assigneeEmail: "a@b.c",
            assigneeName: "Ann",
            assigneeImgPath: "/a.png",
        });
    });
});

describe("board quick-add scope", () => {
    it("the sidebar folder wins; else exactly one dropdown pick; else none", () => {
        expect(pickScopedMilestoneId(5, [1])).toBe(5);
        expect(pickScopedMilestoneId(null, [1])).toBe(1);
        expect(pickScopedMilestoneId(null, [1, 2])).toBeNull();
        expect(pickScopedMilestoneId(null, [])).toBeNull();
    });

    it("files under the milestone's backing row, and falls back to a root task", () => {
        const backing = {
            id: "50",
            isMilestone: true,
            milestoneId: 9,
        } as unknown as TaskTableProps;
        const other = {
            id: "51",
            isMilestone: false,
            milestoneId: 9,
        } as unknown as TaskTableProps;
        expect(quickAddParentFor([other, backing], 9)).toBe(backing);
        expect(quickAddParentFor([other, backing], 10)).toBeNull();
        expect(quickAddParentFor([other, backing], null)).toBeNull();
    });
});
