/**
 * `selectOutdatedMilestones` / `getOutdatedMilestoneIds` — the "past
 * milestones" set: Closed milestones tied to an ENDED (completed/archived)
 * sprint. This set is hidden from the board/table + member filter and shown
 * only in the sidebar's "Past milestones" folder, so its boundaries matter:
 * an Open milestone in an old sprint is NOT outdated (still work to do), a
 * recently-Closed milestone in an active sprint is NOT outdated, and Deleted
 * milestones are deliberately excluded (they'd otherwise silently hide tasks).
 */

import { describe, expect, it } from "vitest";

import type { Milestone, Sprint } from "../features/tasks/sprint-milestone/types";
import {
    getOutdatedMilestoneIds,
    selectOutdatedMilestones,
} from "../features/tasks/sprint-milestone/utils/sortMilestones";

const sprint = (sprintId: number, status: Sprint["status"], isDeleted = false): Sprint =>
    ({ sprintId, status, isDeleted }) as unknown as Sprint;

const milestone = (
    milestoneId: number,
    status: string,
    sprintId: number | null,
    over: Partial<Milestone> = {}
): Milestone =>
    ({
        milestoneId,
        title: `M${milestoneId}`,
        status,
        sprintId,
        isDeleted: false,
        dueDate: null,
        assignees: [],
        ...over,
    }) as unknown as Milestone;

// Sprint 1 = archived (ended), Sprint 2 = active (ongoing).
const SPRINTS = [sprint(1, "archived"), sprint(2, "active"), sprint(3, "completed")];

describe("selectOutdatedMilestones", () => {
    it("includes a Closed milestone in an ended sprint", () => {
        const out = selectOutdatedMilestones([milestone(10, "Closed", 1)], SPRINTS);
        expect(out.map((m) => m.milestoneId)).toEqual([10]);
    });

    it("includes Closed milestones from BOTH completed and archived sprints", () => {
        const out = selectOutdatedMilestones(
            [milestone(10, "Closed", 1), milestone(11, "Closed", 3)],
            SPRINTS
        );
        expect(out.map((m) => m.milestoneId).sort()).toEqual([10, 11]);
    });

    it("excludes a Closed milestone in an ACTIVE sprint (recently done, still relevant)", () => {
        expect(selectOutdatedMilestones([milestone(20, "Closed", 2)], SPRINTS)).toEqual([]);
    });

    it("excludes an OPEN milestone even in an ended sprint (still work to do)", () => {
        expect(selectOutdatedMilestones([milestone(30, "Open", 1)], SPRINTS)).toEqual([]);
        expect(selectOutdatedMilestones([milestone(31, "WIP", 1)], SPRINTS)).toEqual([]);
    });

    it("excludes a Closed milestone with NO sprint", () => {
        expect(selectOutdatedMilestones([milestone(40, "Closed", null)], SPRINTS)).toEqual([]);
    });

    it("excludes Deleted / soft-deleted milestones (they'd hide tasks with no way back)", () => {
        expect(selectOutdatedMilestones([milestone(50, "Deleted", 1)], SPRINTS)).toEqual([]);
        expect(
            selectOutdatedMilestones([milestone(51, "Closed", 1, { isDeleted: true })], SPRINTS)
        ).toEqual([]);
    });

    it("ignores a Closed milestone whose sprint is itself deleted (not 'ended')", () => {
        const out = selectOutdatedMilestones(
            [milestone(60, "Closed", 9)],
            [sprint(9, "archived", true)]
        );
        expect(out).toEqual([]);
    });
});

describe("getOutdatedMilestoneIds", () => {
    it("returns the ids of exactly the outdated milestones", () => {
        const ids = getOutdatedMilestoneIds(
            [
                milestone(10, "Closed", 1), // outdated
                milestone(20, "Closed", 2), // active sprint → not
                milestone(30, "Open", 1), // open → not
            ],
            SPRINTS
        );
        expect([...ids].sort()).toEqual([10]);
    });
});
