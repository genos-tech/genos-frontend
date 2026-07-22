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
    groupMilestonesByYearAndSprint,
    MILESTONE_SPRINT_UNKNOWN,
    MILESTONE_YEAR_UNKNOWN,
    selectOutdatedMilestones,
} from "../features/tasks/sprint-milestone/utils/sortMilestones";

const sprint = (sprintId: number, status: Sprint["status"], isDeleted = false): Sprint =>
    ({ sprintId, status, isDeleted }) as unknown as Sprint;

const datedSprint = (
    sprintId: number,
    name: string,
    endDate: string,
    status: Sprint["status"] = "archived"
): Sprint => ({ sprintId, name, endDate, status, isDeleted: false }) as unknown as Sprint;

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

describe("groupMilestonesByYearAndSprint", () => {
    // Sprint A/B end in 2026, Sprint C in 2025.
    const DATED_SPRINTS = [
        datedSprint(1, "Sprint A", "2026-03-31"),
        datedSprint(2, "Sprint B", "2026-06-30"),
        datedSprint(3, "Sprint C", "2025-09-30", "completed"),
    ];

    it("builds a year → sprint → milestone tree, newest year and sprint first", () => {
        const groups = groupMilestonesByYearAndSprint(
            [
                milestone(100, "Closed", 2), // 2026 / Sprint B
                milestone(101, "Closed", 1), // 2026 / Sprint A
                milestone(102, "Closed", 2), // 2026 / Sprint B
                milestone(103, "Closed", 3), // 2025 / Sprint C
            ],
            DATED_SPRINTS
        );

        expect(groups.map((g) => g.year)).toEqual(["2026", "2025"]);

        const y2026 = groups[0];
        // Within a year, sprints order by end date descending (B ends after A).
        expect(y2026.sprints.map((s) => s.sprintName)).toEqual(["Sprint B", "Sprint A"]);
        // Milestones keep their incoming order within a sprint bucket.
        expect(y2026.sprints[0].milestones.map((m) => m.milestoneId)).toEqual([100, 102]);
        expect(y2026.sprints[1].milestones.map((m) => m.milestoneId)).toEqual([101]);

        const y2025 = groups[1];
        expect(y2025.sprints).toHaveLength(1);
        expect(y2025.sprints[0].milestones.map((m) => m.milestoneId)).toEqual([103]);
    });

    it("falls back to the milestone's own due date when it has no sprint", () => {
        const groups = groupMilestonesByYearAndSprint(
            [milestone(200, "Closed", null, { dueDate: "2024-01-15" })],
            DATED_SPRINTS
        );
        expect(groups.map((g) => g.year)).toEqual(["2024"]);
        expect(groups[0].sprints[0].sprintId).toBeNull();
        expect(groups[0].sprints[0].sprintName).toBe(MILESTONE_SPRINT_UNKNOWN);
    });

    it("puts undatable milestones in a trailing '—' bucket", () => {
        const groups = groupMilestonesByYearAndSprint(
            [
                milestone(300, "Closed", null), // no sprint, no due date → unknown
                milestone(301, "Closed", 2), // 2026
            ],
            DATED_SPRINTS
        );
        expect(groups.map((g) => g.year)).toEqual(["2026", MILESTONE_YEAR_UNKNOWN]);
    });
});
