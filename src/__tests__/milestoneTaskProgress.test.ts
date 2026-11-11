import { describe, expect, it } from "vitest";

import { MILESTONE_STATUS_CHIP_COLORS } from "../features/tasks/sprint-milestone/utils/sortMilestones";
import {
    countMilestoneTaskStatuses,
    MILESTONE_PROGRESS_ORDER,
    milestoneTaskStatuses,
} from "../features/tasks/utils/milestoneTaskProgress";
import { statuses as taskStatuses } from "../features/tasks/utils/taskMeta";

const sum = (entries: { count: number }[]) => entries.reduce((n, e) => n + e.count, 0);

describe("countMilestoneTaskStatuses (MIP-1017)", () => {
    it("the reported milestone: a Blocked task gets its own chip and the chips add up to the total", () => {
        // total 10: Open 3, WIP 2, Blocked 1, Pending 1, Closed 3. Before the fix the
        // Blocked task was in the total but had no chip (chips 3+2+1+3 = 9).
        const result = countMilestoneTaskStatuses([
            "Open",
            "Open",
            "Open",
            "WIP",
            "WIP",
            "Blocked",
            "Pending",
            "Closed",
            "Closed",
            "Closed",
        ]);
        expect(result.total).toBe(10);
        expect(result.entries).toEqual([
            { status: "Open", count: 3 },
            { status: "WIP", count: 2 },
            { status: "Blocked", count: 1 },
            { status: "Pending", count: 1 },
            { status: "Closed", count: 3 },
        ]);
        expect(sum(result.entries)).toBe(result.total);
    });

    it("an unknown, empty or missing status falls into Other, shown last", () => {
        const result = countMilestoneTaskStatuses([
            "Open",
            "Closed",
            "Archived",
            "",
            null,
            undefined,
        ]);
        expect(result.total).toBe(6);
        expect(result.entries).toEqual([
            { status: "Open", count: 1 },
            { status: "Closed", count: 1 },
            { status: "Other", count: 4 },
        ]);
        expect(sum(result.entries)).toBe(result.total);
    });

    it("every status at once, including an unknown one, still adds up and is in app order", () => {
        const result = countMilestoneTaskStatuses([
            "Closed",
            "Pending",
            "Blocked",
            "WIP",
            "Open",
            "Weird",
            "Blocked",
        ]);
        expect(result.entries.map((e) => e.status)).toEqual([
            "Open",
            "WIP",
            "Blocked",
            "Pending",
            "Closed",
            "Other",
        ]);
        expect(result.total).toBe(7);
        expect(sum(result.entries)).toBe(7);
    });

    it("a status with no tasks has no entry (no chip at 0), Other included", () => {
        const result = countMilestoneTaskStatuses(["WIP", "WIP"]);
        expect(result.entries).toEqual([{ status: "WIP", count: 2 }]);
        expect(countMilestoneTaskStatuses(["Open"]).entries.map((e) => e.status)).not.toContain(
            "Other"
        );
    });

    it("an empty milestone has no entries and a total of 0", () => {
        expect(countMilestoneTaskStatuses([])).toEqual({ entries: [], total: 0 });
    });

    it("Deleted tasks are not counted, matching the milestone total shown in the sidebar", () => {
        const result = countMilestoneTaskStatuses(["Open", "Deleted", "Deleted"]);
        expect(result.total).toBe(1);
        expect(result.entries).toEqual([{ status: "Open", count: 1 }]);
    });

    it("the order is the one the app uses elsewhere, and every chip has a colour", () => {
        expect([...MILESTONE_PROGRESS_ORDER]).toEqual([
            "Open",
            "WIP",
            "Blocked",
            "Pending",
            "Closed",
        ]);
        // The task status list (table, filters) is the same sequence with Deleted last.
        expect(taskStatuses.map((s) => s.status).slice(0, 5)).toEqual([
            ...MILESTONE_PROGRESS_ORDER,
        ]);
        for (const s of MILESTONE_PROGRESS_ORDER) {
            expect(MILESTONE_STATUS_CHIP_COLORS[s]).toBeDefined();
            // same colour as the task status colour used by the table
            expect(MILESTONE_STATUS_CHIP_COLORS[s].color).toBe(
                taskStatuses.find((t) => t.status === s)?.color
            );
        }
    });
});

describe("milestoneTaskStatuses (MIP-1389)", () => {
    const row = (
        id: number,
        status: string,
        parentTaskId: number | null = null,
        milestoneId: number | null = 7,
        isMilestone = false
    ) => ({
        id: String(id),
        status,
        parentTaskId: parentTaskId == null ? null : String(parentTaskId),
        milestoneId,
        isMilestone,
    });

    it("reads an Open task under a Closed parent as Closed and leaves a Deleted branch out", () => {
        const rows = [
            row(70, "Open", null, 7, true),
            row(1, "Closed"),
            row(2, "Open", 1),
            row(3, "WIP", 2),
            row(4, "Deleted"),
            row(5, "Open", 4),
            row(6, "Open"),
            row(9, "Open", null, 8),
        ];
        const result = countMilestoneTaskStatuses(milestoneTaskStatuses(rows, 7));
        expect(result.total).toBe(4);
        expect(result.entries).toEqual([
            { status: "Open", count: 1 },
            { status: "Closed", count: 3 },
        ]);
    });

    it("a Closed milestone reads every one of its tasks as Closed", () => {
        const rows = [row(70, "Closed", null, 7, true), row(1, "Open"), row(2, "Blocked")];
        const result = countMilestoneTaskStatuses(milestoneTaskStatuses(rows, 7));
        expect(result.entries).toEqual([{ status: "Closed", count: 2 }]);
    });
});
