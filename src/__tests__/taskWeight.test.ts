import { describe, expect, it } from "vitest";

import {
    computeTaskWeight,
    dueBucket,
    effortPoints,
    priorityPoints,
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

describe("computeTaskWeight", () => {
    it("is priority × urgency (1..25)", () => {
        // Critical + due tomorrow = the top-priority fire.
        expect(computeTaskWeight(task({ priority: "Critical", dueDate: due(1) }), NOW)).toBe(25);
        // Normal, plenty of runway.
        expect(computeTaskWeight(task({ priority: "Normal", dueDate: due(10) }), NOW)).toBe(3);
    });

    it("does not fold in effort — a huge trivial task stays low", () => {
        const trivialButHuge = task({
            priority: "Minimal",
            effortLevel: "Extensive",
            dueDate: due(10),
        });
        expect(computeTaskWeight(trivialButHuge, NOW)).toBe(1); // 1 × 1
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
