import { CssVarsProvider } from "@mui/joy/styles";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { MilestonesAtRiskCard } from "../features/tasks/components/dashboard/tabs/MilestonesAtRiskCard";
import type { EffectiveTask } from "../features/tasks/utils/effectiveTasks";
import {
    compareMilestoneRisk,
    isMilestoneAtRisk,
    summarizeMilestoneProgress,
} from "../features/tasks/utils/milestoneProgressSummary";
import { I18nProvider } from "../i18n";

// MIP-1963: the Project tab's "Milestones at risk" replaces the Sprint tab's "Milestones in
// sprint" list: the three worst milestones, each opening its preview, and a way to the
// Milestones tab, which lists all of them.

const NOW = new Date("2026-11-22T09:00:00Z");
const DAY = 86_400_000;
const iso = (offsetDays: number) => new Date(NOW.getTime() + offsetDays * DAY).toISOString();

const milestone = (id: number, title: string, extra: Record<string, unknown> = {}) =>
    ({
        milestoneId: id,
        taskId: id * 100,
        projectId: 3,
        title,
        status: "WIP",
        sprintId: 2,
        dueDate: null,
        assignees: [],
        lastProgressAt: iso(-1),
        ...extra,
    }) as never;

const task = (
    id: number,
    milestoneId: number,
    status: string,
    dueDate: string | null = null
): EffectiveTask =>
    ({
        id,
        milestoneId,
        isMilestone: false,
        effectiveStatus: status,
        status,
        dueDate,
        title: `T${id}`,
    }) as unknown as EffectiveTask;

describe("milestone risk", () => {
    const summary = (m: never, tasks: EffectiveTask[]) =>
        summarizeMilestoneProgress(m, tasks, NOW);

    it("is at risk for an overdue task, a blocked task or a stall, not for a quiet healthy one", () => {
        const healthy = summary(milestone(1, "A"), [task(1, 1, "WIP", iso(30))]);
        const overdue = summary(milestone(2, "B"), [task(2, 2, "WIP", iso(-3))]);
        const blocked = summary(milestone(3, "C"), [task(3, 3, "Blocked")]);
        const stalled = summary(milestone(4, "D", { lastProgressAt: iso(-20) }), [
            task(4, 4, "WIP"),
        ]);
        expect(isMilestoneAtRisk(healthy)).toBe(false);
        expect(isMilestoneAtRisk(overdue)).toBe(true);
        expect(isMilestoneAtRisk(blocked)).toBe(true);
        expect(isMilestoneAtRisk(stalled)).toBe(true);
    });

    it("is at risk when its own due date is near and work remains, but not once it is all closed", () => {
        const near = summary(milestone(1, "A", { dueDate: iso(2) }), [task(1, 1, "WIP")]);
        const done = summary(milestone(2, "B", { dueDate: iso(2) }), [task(2, 2, "Closed")]);
        expect(isMilestoneAtRisk(near)).toBe(true);
        expect(isMilestoneAtRisk(done)).toBe(false);
    });

    it("ranks overdue first, then blocked", () => {
        const a = summary(milestone(1, "A"), [task(1, 1, "Blocked")]);
        const b = summary(milestone(2, "B"), [task(2, 2, "WIP", iso(-3))]);
        expect([a, b].sort(compareMilestoneRisk).map((s) => s.milestoneId)).toEqual([2, 1]);
    });
});

describe("MilestonesAtRiskCard", () => {
    const mount = (
        milestones: never[],
        tasks: EffectiveTask[],
        handlers = { onOpenMilestone: vi.fn(), onShowAll: vi.fn() }
    ) => {
        render(
            <CssVarsProvider>
                <I18nProvider>
                    <MilestonesAtRiskCard
                        effectiveTasks={tasks}
                        milestones={milestones}
                        {...handlers}
                    />
                </I18nProvider>
            </CssVarsProvider>
        );
        return handlers;
    };

    it("shows the three most at-risk milestones, worst first, and counts them all", () => {
        const ms = [1, 2, 3, 4, 5].map((i) => milestone(i, `Milestone ${i}`));
        const tasks = [
            task(1, 1, "Blocked"),
            task(2, 2, "WIP", iso(-1)),
            task(3, 2, "WIP", iso(-2)),
            task(4, 3, "WIP", iso(-1)),
            task(5, 4, "Blocked"),
            task(6, 5, "WIP", iso(30)),
        ];
        mount(ms, tasks);
        const card = screen.getByTestId("milestones-at-risk");
        const buttons = within(card)
            .getAllByRole("button")
            .filter((b) => /^Open /.test(b.getAttribute("aria-label") ?? ""));
        // 4 at risk (milestone 5 is healthy); only three shown; 2 overdue tasks outrank 1.
        expect(buttons.map((b) => b.getAttribute("aria-label"))).toEqual([
            "Open Milestone 2",
            "Open Milestone 3",
            "Open Milestone 1",
        ]);
        expect(within(card).getByText("4")).toBeTruthy();
    });

    it("opens a milestone and goes to the Milestones tab", () => {
        const { onOpenMilestone, onShowAll } = mount(
            [milestone(7, "Beta launch")],
            [task(1, 7, "Blocked")]
        );
        fireEvent.click(screen.getByRole("button", { name: "Open Beta launch" }));
        expect(onOpenMilestone).toHaveBeenCalledWith(7);
        fireEvent.click(screen.getByRole("button", { name: "All milestones" }));
        expect(onShowAll).toHaveBeenCalledTimes(1);
    });

    it("says so when nothing is at risk, and the way to all milestones stays", () => {
        mount([milestone(1, "Fine")], [task(1, 1, "WIP", iso(30))]);
        expect(screen.getByText("No milestone is at risk.")).toBeTruthy();
        expect(screen.getByRole("button", { name: "All milestones" })).toBeTruthy();
    });

    it("ignores a deleted milestone", () => {
        mount([milestone(1, "Gone", { isDeleted: true })], [task(1, 1, "Blocked")]);
        expect(screen.getByText("No milestone is at risk.")).toBeTruthy();
    });

    it("ignores a Closed milestone", () => {
        mount([milestone(1, "Done", { status: "Closed" })], [task(1, 1, "Blocked")]);
        expect(screen.getByText("No milestone is at risk.")).toBeTruthy();
    });
});
