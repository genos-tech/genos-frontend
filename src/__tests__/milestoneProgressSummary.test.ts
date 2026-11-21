import { describe, expect, it } from "vitest";

import { EffectiveTask } from "../features/tasks/utils/effectiveTasks";
import {
    STALE_PROGRESS_DAYS,
    summarizeMilestoneProgress,
    summarizeMilestoneProgressOverview,
} from "../features/tasks/utils/milestoneProgressSummary";

// MIP-1187: the milestone progress view reads the loaded, effective task rows
// (no extra request). These tests pin the rules the view shows: counts by status,
// overdue / blocked / due-soon attention, the milestone's own due date, and
// "no progress for N days".

const NOW = new Date(2026, 10, 21, 12, 0, 0); // 2026-11-21 local noon
const DAY = 86_400_000;
const isoDaysAgo = (days: number) => new Date(NOW.getTime() - days * DAY).toISOString();

const row = (over: Partial<EffectiveTask> & { id: string }): EffectiveTask =>
    ({
        title: `Task ${over.id}`,
        status: "Open",
        effectiveStatus: "Open",
        effectiveCloseDate: null,
        dueDate: null,
        milestoneId: 7,
        isMilestone: false,
        parentTaskId: null,
        lastProgressAt: null,
        ...over,
    }) as unknown as EffectiveTask;

const milestone = (
    over: Partial<{
        milestoneId: number;
        taskId: number | null;
        status: string;
        dueDate: string | null;
    }> = {}
) => ({
    milestoneId: 7,
    taskId: 700,
    title: "Launch",
    status: "WIP",
    dueDate: "2026-11-30",
    ...over,
});

describe("summarizeMilestoneProgress", () => {
    it("counts children by effective status, and leaves the milestone row and Deleted out", () => {
        const tasks = [
            row({ id: "700", isMilestone: true, milestoneId: 7 }),
            row({ id: "1", effectiveStatus: "Closed", status: "Closed" }),
            row({ id: "2", effectiveStatus: "WIP", status: "WIP" }),
            row({ id: "3", effectiveStatus: "Blocked", status: "Blocked" }),
            row({ id: "4", effectiveStatus: "Open", status: "Open" }),
            row({ id: "5", milestoneId: 8 }), // another milestone
        ];
        const s = summarizeMilestoneProgress(milestone(), tasks, NOW);
        expect(s.total).toBe(4);
        expect(s.closed).toBe(1);
        expect(s.entries).toEqual([
            { status: "Open", count: 1 },
            { status: "WIP", count: 1 },
            { status: "Blocked", count: 1 },
            { status: "Closed", count: 1 },
        ]);
        expect(s.blocked.map((t) => t.id)).toEqual(["3"]);
    });

    it("flags open tasks due before today as overdue, and due-today-to-7-days as due soon; Closed is never flagged", () => {
        const tasks = [
            row({ id: "1", dueDate: "2026-11-19" }), // overdue
            row({ id: "2", dueDate: "2026-11-21" }), // due today: not overdue
            row({ id: "3", dueDate: "2026-11-27" }), // due in 6 days: due soon
            row({ id: "4", dueDate: "2026-12-05" }), // later
            row({ id: "5", effectiveStatus: "Closed", status: "Closed", dueDate: "2026-11-01" }),
        ];
        const s = summarizeMilestoneProgress(milestone(), tasks, NOW);
        expect(s.overdue.map((t) => t.id)).toEqual(["1"]);
        expect(s.dueSoon.map((t) => t.id)).toEqual(["2", "3"]);
    });

    it("lists attention items once each, overdue first, then blocked, then due soon", () => {
        const tasks = [
            row({ id: "a", effectiveStatus: "Blocked", status: "Blocked", dueDate: "2026-11-27" }),
            row({ id: "b", dueDate: "2026-11-25" }),
            row({ id: "c", dueDate: "2026-11-10" }),
        ];
        const s = summarizeMilestoneProgress(milestone(), tasks, NOW);
        // c overdue; a blocked (also due in 6 days, listed once, under blocked); b due soon only.
        expect(s.attention.map((t) => t.id)).toEqual(["c", "a", "b"]);
    });

    it("reports the milestone's own due date relative to today", () => {
        expect(
            summarizeMilestoneProgress(milestone({ dueDate: "2026-11-30" }), [], NOW).dueInDays
        ).toBe(9);
        expect(
            summarizeMilestoneProgress(milestone({ dueDate: "2026-11-18" }), [], NOW).dueInDays
        ).toBe(-3);
        expect(
            summarizeMilestoneProgress(milestone({ dueDate: null }), [], NOW).dueInDays
        ).toBeNull();
    });

    it("takes the last progress from the milestone row, and marks an open milestone stalled after the threshold", () => {
        const fresh = [row({ id: "700", isMilestone: true, lastProgressAt: isoDaysAgo(2) })];
        const s1 = summarizeMilestoneProgress(milestone(), fresh, NOW);
        expect(s1.daysSinceProgress).toBe(2);
        expect(s1.stalled).toBe(false);

        const old = [
            row({
                id: "700",
                isMilestone: true,
                lastProgressAt: isoDaysAgo(STALE_PROGRESS_DAYS + 1),
            }),
        ];
        const s2 = summarizeMilestoneProgress(milestone(), old, NOW);
        expect(s2.stalled).toBe(true);
    });

    it("never stalls a Closed milestone and treats a missing progress stamp as unknown", () => {
        const old = [row({ id: "700", isMilestone: true, lastProgressAt: isoDaysAgo(60) })];
        expect(summarizeMilestoneProgress(milestone({ status: "Closed" }), old, NOW).stalled).toBe(
            false
        );
        const none = summarizeMilestoneProgress(
            milestone(),
            [row({ id: "700", isMilestone: true })],
            NOW
        );
        expect(none.daysSinceProgress).toBeNull();
        expect(none.stalled).toBe(false);
    });
});

describe("summarizeMilestoneProgressOverview", () => {
    it("adds the milestones up for the summary strip", () => {
        const tasks = [
            row({ id: "700", isMilestone: true, lastProgressAt: isoDaysAgo(30) }),
            row({ id: "1", dueDate: "2026-11-01" }),
            row({ id: "2", effectiveStatus: "Closed", status: "Closed" }),
            row({ id: "800", isMilestone: true, milestoneId: 8, lastProgressAt: isoDaysAgo(1) }),
            row({ id: "3", milestoneId: 8, effectiveStatus: "Blocked", status: "Blocked" }),
        ];
        const summaries = [
            summarizeMilestoneProgress(milestone(), tasks, NOW),
            summarizeMilestoneProgress(milestone({ milestoneId: 8, taskId: 800 }), tasks, NOW),
        ];
        const o = summarizeMilestoneProgressOverview(summaries);
        expect(o.milestones).toBe(2);
        expect(o.tasks).toBe(3);
        expect(o.closed).toBe(1);
        expect(o.overdue).toBe(1);
        expect(o.blocked).toBe(1);
        expect(o.stalled).toBe(1);
    });
});
