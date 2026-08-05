import { describe, expect, it } from "vitest";

import { Milestone } from "../features/tasks/sprint-milestone/types";
import { upsertMilestoneInList } from "../features/tasks/sprint-milestone/utils/milestoneListState";

const milestone = (milestoneId: number, projectId: number, over: Partial<Milestone> = {}) =>
    ({ milestoneId, projectId, title: `M${milestoneId}`, ...over }) as Milestone;

describe("upsertMilestoneInList", () => {
    it("adds a milestone to its project's list", () => {
        const next = upsertMilestoneInList({}, milestone(1, 10));
        expect(next[10].map((m) => m.milestoneId)).toEqual([1]);
    });

    it("replaces the existing entry rather than duplicating it", () => {
        const prev = { 10: [milestone(1, 10, { title: "old" })] };
        const next = upsertMilestoneInList(prev, milestone(1, 10, { title: "new" }));
        expect(next[10]).toHaveLength(1);
        expect(next[10][0].title).toBe("new");
    });

    it("keeps other milestones of the same project", () => {
        const prev = { 10: [milestone(1, 10), milestone(2, 10)] };
        const next = upsertMilestoneInList(prev, milestone(2, 10, { title: "edited" }));
        expect(next[10].map((m) => m.milestoneId)).toEqual([1, 2]);
    });

    it("evicts the milestone from the project it moved out of", () => {
        // The move case: milestone 1 was in project 10 and now reports 20.
        // Left in both lists it renders twice, and the stale copy keeps the
        // sprint the move cleared.
        const prev = { 10: [milestone(1, 10, { sprintId: 5 })], 20: [milestone(9, 20)] };
        const next = upsertMilestoneInList(prev, milestone(1, 20, { sprintId: null }));
        expect(next[10]).toEqual([]);
        expect(next[20].map((m) => m.milestoneId)).toEqual([1, 9]);
        expect(next[20][0].sprintId).toBeNull();
    });

    it("lands a moved milestone in a project with no list yet", () => {
        const prev = { 10: [milestone(1, 10)] };
        const next = upsertMilestoneInList(prev, milestone(1, 20));
        expect(next[10]).toEqual([]);
        expect(next[20].map((m) => m.milestoneId)).toEqual([1]);
    });

    it("leaves untouched projects referentially equal", () => {
        // Consumers memoize on the per-project array, so rebuilding one
        // that didn't change would re-render every other project's list.
        const untouched = [milestone(2, 30)];
        const prev = { 10: [milestone(1, 10)], 30: untouched };
        const next = upsertMilestoneInList(prev, milestone(1, 20));
        expect(next[30]).toBe(untouched);
    });

    it("does not mutate the input map", () => {
        const prev = { 10: [milestone(1, 10)] };
        upsertMilestoneInList(prev, milestone(1, 20));
        expect(prev[10].map((m) => m.milestoneId)).toEqual([1]);
        expect((prev as Record<number, Milestone[]>)[20]).toBeUndefined();
    });
});
