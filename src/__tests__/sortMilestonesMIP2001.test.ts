import { describe, expect, it } from "vitest";

import { Milestone, Sprint } from "../features/tasks/sprint-milestone/types";
import {
    compareMilestones,
    selectSidebarLiveMilestones,
    selectVisibleMilestones,
    sortMilestones,
} from "../features/tasks/sprint-milestone/utils/sortMilestones";

const ms = (id: number, over: Partial<Milestone> = {}): Milestone =>
    ({
        milestoneId: id,
        taskId: id,
        projectId: 1,
        teamId: null,
        sprintId: null,
        reporterId: null,
        title: `M${id}`,
        description: null,
        status: "Open",
        statusCode: null,
        priority: null,
        priorityCode: null,
        startDate: null,
        dueDate: null,
        tags: null,
        isDeleted: false,
        tsCreatedAt: "2026-01-01T00:00:00Z",
        tsUpdatedAt: "2026-01-01T00:00:00Z",
        lastProgressAt: null,
        assignees: [],
        ...over,
    }) as Milestone;

const sp = (id: number, status: Sprint["status"]): Sprint =>
    ({ sprintId: id, status, isDeleted: false, sequenceNumber: id, name: `S${id}` }) as Sprint;

const ids = (list: Milestone[]) => list.map((m) => m.milestoneId);

describe("milestone order (MIP-2001)", () => {
    it("puts the most recent progress first", () => {
        const list = [
            ms(1, { lastProgressAt: "2026-11-01T00:00:00Z" }),
            ms(2, { lastProgressAt: "2026-11-20T00:00:00Z" }),
            ms(3, { lastProgressAt: "2026-11-10T00:00:00Z" }),
        ];
        expect(ids(sortMilestones(list, []))).toEqual([2, 3, 1]);
    });

    it("sorts never-recorded progress last, then by due date, then title", () => {
        const list = [
            ms(1, { title: "b" }),
            ms(2, { title: "a" }),
            ms(3, { dueDate: "2026-12-01" }),
            ms(4, { lastProgressAt: "2026-01-01T00:00:00Z" }),
        ];
        expect(ids(sortMilestones(list, []))).toEqual([4, 3, 2, 1]);
    });

    it("favorites come first, ahead of newer progress", () => {
        const list = [
            ms(1, { lastProgressAt: "2026-11-20T00:00:00Z" }),
            ms(2, { lastProgressAt: "2026-01-01T00:00:00Z" }),
        ];
        expect(ids(sortMilestones(list, [], (id) => id === 2))).toEqual([2, 1]);
    });

    it("keeps open work before Closed, whatever the progress", () => {
        const list = [
            ms(1, { status: "Closed", lastProgressAt: "2026-11-20T00:00:00Z" }),
            ms(2, { status: "Pending", lastProgressAt: "2026-01-01T00:00:00Z" }),
            ms(3, { status: "Blocked" }),
        ];
        expect(ids(sortMilestones(list, []))).toEqual([2, 3, 1]);
    });

    it("puts the active sprint before other open milestones", () => {
        const sprints = [sp(10, "active"), sp(11, "upcoming")];
        const list = [
            ms(1, { sprintId: 11, lastProgressAt: "2026-11-20T00:00:00Z" }),
            ms(2, { sprintId: 10, lastProgressAt: "2026-01-01T00:00:00Z" }),
            ms(3, { lastProgressAt: "2026-11-21T00:00:00Z" }),
        ];
        expect(ids(sortMilestones(list, sprints))).toEqual([2, 3, 1]);
    });

    it("works without a context and does not mutate its input", () => {
        const a = ms(1, { lastProgressAt: "2026-02-01T00:00:00Z" });
        const b = ms(2, { lastProgressAt: "2026-03-01T00:00:00Z" });
        expect(compareMilestones(a, b)).toBeGreaterThan(0);
        const input = [a, b];
        sortMilestones(input, []);
        expect(ids(input)).toEqual([1, 2]);
    });

    it("applies to the visible and sidebar selectors", () => {
        const list = [
            ms(1, { lastProgressAt: "2026-01-01T00:00:00Z" }),
            ms(2, { lastProgressAt: "2026-05-01T00:00:00Z" }),
            ms(3, { status: "Closed" }),
        ];
        expect(ids(selectVisibleMilestones(list, []))).toEqual([2, 1, 3]);
        expect(ids(selectSidebarLiveMilestones(list, [], (id) => id === 1))).toEqual([1, 2]);
    });
});
