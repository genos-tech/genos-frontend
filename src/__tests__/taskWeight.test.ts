import { describe, expect, it } from "vitest";

import {
    computeTaskWeight,
    dueBucket,
    effortHeadStart,
    effortPoints,
    priorityPoints,
    startUrgencyPoints,
    urgencyPoints,
    weightBand,
} from "../features/tasks/utils/taskWeight";
import { TaskTableProps } from "../types/tasks";

// Fixed "today" so the day-relative urgency/bucket math is deterministic.
// Constructed via local Y/M/D (month is 0-indexed → 6 = July) at noon so a
// round-trip through the date string can't drift across a day boundary in
// any timezone.
const NOW = new Date(2026, 6, 19, 12);
const due = (daysFromNow: number): string => new Date(2026, 6, 19 + daysFromNow, 12).toISOString();

const task = (props: Partial<TaskTableProps>): TaskTableProps =>
    props as unknown as TaskTableProps;

describe("priorityPoints / effortPoints", () => {
    it("maps labels to 1..5", () => {
        expect(priorityPoints("Minimal")).toBe(1);
        expect(priorityPoints("Critical")).toBe(5);
        expect(effortPoints("Minimal")).toBe(1);
        expect(effortPoints("Extensive")).toBe(5);
    });

    it("honors the legacy 'Medium' priority alias (same rank as Normal)", () => {
        expect(priorityPoints("Medium")).toBe(priorityPoints("Normal"));
    });

    it("floors unknown/unset to 1 (× 1 is neutral-low, not zero)", () => {
        expect(priorityPoints(null)).toBe(1);
        expect(priorityPoints(undefined)).toBe(1);
        expect(priorityPoints("")).toBe(1);
        expect(effortPoints(null)).toBe(1);
    });
});

describe("urgencyPoints", () => {
    it("follows clamp(6 - daysLeft, 1, 5) across the stated scale", () => {
        expect(urgencyPoints(due(5), NOW)).toBe(1); // 5+ days
        expect(urgencyPoints(due(4), NOW)).toBe(2);
        expect(urgencyPoints(due(3), NOW)).toBe(3);
        expect(urgencyPoints(due(2), NOW)).toBe(4);
        expect(urgencyPoints(due(1), NOW)).toBe(5); // 1 day
    });

    it("clamps today and any overdue date to max urgency", () => {
        expect(urgencyPoints(due(0), NOW)).toBe(5); // due today
        expect(urgencyPoints(due(-1), NOW)).toBe(5);
        expect(urgencyPoints(due(-30), NOW)).toBe(5);
    });

    it("clamps far-future dates to min urgency", () => {
        expect(urgencyPoints(due(60), NOW)).toBe(1);
    });

    it("treats no / unparseable due date as lowest urgency", () => {
        expect(urgencyPoints(null, NOW)).toBe(1);
        expect(urgencyPoints(undefined, NOW)).toBe(1);
        expect(urgencyPoints("not-a-date", NOW)).toBe(1);
    });
});

describe("effortHeadStart", () => {
    it("maps effort to its head start on the ramp, flooring unknown/unset to 0", () => {
        expect(effortHeadStart("Minimal")).toBe(0);
        expect(effortHeadStart("Extensive")).toBe(7);
        // Unset behaves like Minimal: no head start, so Weight is
        // untouched by effort for an un-triaged task.
        expect(effortHeadStart(null)).toBe(0);
        expect(effortHeadStart("nonsense")).toBe(0);
    });
});

describe("startUrgencyPoints", () => {
    it("brings the urgency ramp forward by the effort head start", () => {
        // Extensive = 7 days of head start, so it climbs 7 days sooner.
        expect(startUrgencyPoints(due(12), "Extensive", NOW)).toBe(1); // 12 - 7 = 5 left
        expect(startUrgencyPoints(due(10), "Extensive", NOW)).toBe(3); // 10 - 7 = 3 left
        expect(startUrgencyPoints(due(9), "Extensive", NOW)).toBe(4); //  9 - 7 = 2 left
        expect(startUrgencyPoints(due(7), "Extensive", NOW)).toBe(5); // pick it up now
        expect(startUrgencyPoints(due(3), "Extensive", NOW)).toBe(5); // already behind
    });

    it("matches plain due-date urgency when effort earns no head start", () => {
        for (const d of [-1, 0, 1, 3, 5, 60]) {
            expect(startUrgencyPoints(due(d), "Minimal", NOW)).toBe(urgencyPoints(due(d), NOW));
            expect(startUrgencyPoints(due(d), null, NOW)).toBe(urgencyPoints(due(d), NOW));
        }
    });

    it("stays at the floor without a due date, however big the task", () => {
        // No deadline to bring the ramp forward from.
        expect(startUrgencyPoints(null, "Extensive", NOW)).toBe(1);
        expect(startUrgencyPoints("not-a-date", "Extensive", NOW)).toBe(1);
    });
});

describe("computeTaskWeight", () => {
    it("is priority × start-urgency (1..25)", () => {
        // Critical + due tomorrow = the top-priority fire.
        expect(computeTaskWeight(task({ priority: "Critical", dueDate: due(1) }), NOW)).toBe(25);
        // Normal, plenty of time left.
        expect(computeTaskWeight(task({ priority: "Normal", dueDate: due(10) }), NOW)).toBe(3);
    });

    it("ranks a heavy task above a light one with the same priority and due date", () => {
        const due5 = due(5);
        const light = task({ priority: "Normal", effortLevel: "Minimal", dueDate: due5 });
        const heavy = task({ priority: "Normal", effortLevel: "Extensive", dueDate: due5 });
        // Light: 5 days is comfortable (urgency 1). Heavy: it has been
        // climbing for two days already (urgency 5).
        expect(computeTaskWeight(light, NOW)).toBe(3);
        expect(computeTaskWeight(heavy, NOW)).toBe(15);
        expect(computeTaskWeight(heavy, NOW)).toBeGreaterThan(computeTaskWeight(light, NOW));
    });

    it("puts an extensive task a week out into the high band", () => {
        // The reported case: heavy effort, a week left — surface it now.
        const weekOut = task({ priority: "Normal", effortLevel: "Extensive", dueDate: due(7) });
        expect(weightBand(computeTaskWeight(weekOut, NOW)).band).toBe("high");
    });

    it("never lets effort alone outrank priority — a huge trivial task stays low", () => {
        // Effort only sets WHEN a task climbs, not how important it is:
        // a Minimal-priority task tops out at 1 × 5.
        const trivialButHuge = task({
            priority: "Minimal",
            effortLevel: "Extensive",
            dueDate: due(0),
        });
        const smallButCritical = task({
            priority: "Critical",
            effortLevel: "Minimal",
            dueDate: due(0),
        });
        expect(computeTaskWeight(trivialButHuge, NOW)).toBe(5);
        expect(computeTaskWeight(smallButCritical, NOW)).toBe(25);
    });

    it("ignores effort on a task with no deadline", () => {
        const noDue = task({ priority: "Critical", effortLevel: "Extensive", dueDate: null });
        expect(computeTaskWeight(noDue, NOW)).toBe(5); // 5 × 1
    });

    it("floors an un-triaged task to its urgency alone", () => {
        // No priority (→1) but due today (→5).
        expect(computeTaskWeight(task({ priority: null, dueDate: due(0) }), NOW)).toBe(5);
        // No priority, no due date → the global floor.
        expect(computeTaskWeight(task({ priority: null, dueDate: null }), NOW)).toBe(1);
    });
});

describe("weightBand", () => {
    it("bands the 1..25 range into low/medium/high/critical", () => {
        expect(weightBand(1).band).toBe("low");
        expect(weightBand(5).band).toBe("low");
        expect(weightBand(6).band).toBe("medium");
        expect(weightBand(11).band).toBe("medium");
        expect(weightBand(12).band).toBe("high");
        expect(weightBand(17).band).toBe("high");
        expect(weightBand(18).band).toBe("critical");
        expect(weightBand(25).band).toBe("critical");
    });
});

describe("dueBucket", () => {
    it("buckets by scheduling horizon", () => {
        expect(dueBucket(due(-1), NOW)).toBe("overdue");
        expect(dueBucket(due(0), NOW)).toBe("today");
        expect(dueBucket(due(1), NOW)).toBe("week");
        expect(dueBucket(due(7), NOW)).toBe("week");
        expect(dueBucket(due(8), NOW)).toBe("later");
        expect(dueBucket(null, NOW)).toBe("none");
        expect(dueBucket("not-a-date", NOW)).toBe("none");
    });
});
