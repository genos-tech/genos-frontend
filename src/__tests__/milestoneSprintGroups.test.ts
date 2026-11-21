import { describe, expect, it } from "vitest";

import { Sprint } from "../features/tasks/sprint-milestone/types";
import {
    groupMilestonesBySprint,
    MilestoneProgressSummary,
} from "../features/tasks/utils/milestoneProgressSummary";

// MIP-1909: the Milestones tab groups its cards by sprint: active sprint first, the milestones
// of no sprint last, each group with the roll-up of its milestones.

const sprint = (over: Partial<Sprint> & { sprintId: number }): Sprint =>
    ({
        name: `Sprint ${over.sprintId}`,
        startDate: "2026-11-01",
        status: "upcoming",
        ...over,
    }) as Sprint;

const ms = (milestoneId: number, sprintId: number | null) => ({ milestoneId, sprintId });

const sum = (milestoneId: number, over: Partial<MilestoneProgressSummary> = {}) =>
    ({
        milestoneId,
        total: 0,
        closed: 0,
        overdue: [],
        blocked: [],
        stalled: false,
        lastProgressAt: null,
        ...over,
    }) as unknown as MilestoneProgressSummary;

describe("groupMilestonesBySprint", () => {
    it("puts the active sprint first, then upcoming by start, then completed newest first", () => {
        const sprints = [
            sprint({ sprintId: 1, status: "completed", startDate: "2026-09-01" }),
            sprint({ sprintId: 2, status: "upcoming", startDate: "2026-12-01" }),
            sprint({ sprintId: 3, status: "active", startDate: "2026-11-10" }),
            sprint({ sprintId: 4, status: "completed", startDate: "2026-10-01" }),
            sprint({ sprintId: 5, status: "upcoming", startDate: "2026-11-24" }),
        ];
        const milestones = [1, 2, 3, 4, 5].map((id) => ms(id, id));
        const groups = groupMilestonesBySprint(
            milestones,
            milestones.map((m) => sum(m.milestoneId)),
            sprints
        );
        expect(groups.map((g) => g.sprint?.sprintId)).toEqual([3, 5, 2, 4, 1]);
    });

    it("puts milestones with no sprint, or a sprint that is not loaded, in one last group", () => {
        const milestones = [ms(1, null), ms(2, 9), ms(3, 3)];
        const groups = groupMilestonesBySprint(
            milestones,
            milestones.map((m) => sum(m.milestoneId)),
            [sprint({ sprintId: 3, status: "active" })]
        );
        expect(groups).toHaveLength(2);
        expect(groups[1].sprint).toBeNull();
        expect(groups[1].items.map((i) => i.milestone.milestoneId)).toEqual([1, 2]);
    });

    it("keeps the milestones' own order inside a group", () => {
        const milestones = [ms(5, 3), ms(2, 3), ms(9, 3)];
        const [g] = groupMilestonesBySprint(
            milestones,
            milestones.map((m) => sum(m.milestoneId)),
            [sprint({ sprintId: 3 })]
        );
        expect(g.items.map((i) => i.milestone.milestoneId)).toEqual([5, 2, 9]);
    });

    it("rolls up closed, blocked, overdue, stalled and the newest progress", () => {
        const milestones = [ms(1, 3), ms(2, 3)];
        const [g] = groupMilestonesBySprint(
            milestones,
            [
                sum(1, {
                    total: 4,
                    closed: 1,
                    blocked: [{}] as never,
                    overdue: [{}, {}] as never,
                    lastProgressAt: "2026-11-20T10:00:00Z",
                }),
                sum(2, {
                    total: 3,
                    closed: 3,
                    stalled: true,
                    lastProgressAt: "2026-11-21T08:00:00Z",
                }),
            ],
            [sprint({ sprintId: 3 })]
        );
        expect(g.rollup).toMatchObject({
            milestones: 2,
            tasks: 7,
            closed: 4,
            blocked: 1,
            overdue: 2,
            stalled: 1,
            lastProgressAt: "2026-11-21T08:00:00Z",
        });
    });

    it("returns no groups for no milestones", () => {
        expect(groupMilestonesBySprint([], [], [])).toEqual([]);
    });
});
