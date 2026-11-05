/**
 * MIP-1035: picking a milestone always says what the task's sprint becomes.
 *
 * A task has no sprint picker of its own: its sprint is its milestone's, or
 * none. The server derives it that way. The picker used to hand a sprint to its
 * parent only when the milestone HAD one that differed from the task's current
 * one, so a pick that should leave the task with no sprint (a milestone without
 * one) told the parent nothing, and the preview kept the old sprint.
 */

import { CssVarsProvider } from "@mui/joy/styles";
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { SprintMilestonePicker } from "../features/tasks/sprint-milestone/components/SprintMilestonePicker";
import type { Milestone, Sprint } from "../features/tasks/sprint-milestone/types";

const sprint = (sprintId: number): Sprint =>
    ({
        sprintId,
        projectId: 1,
        name: `Sprint ${sprintId}`,
        sequenceNumber: sprintId,
        startDate: "2026-11-01",
        endDate: "2026-11-14",
        status: "active",
        isDeleted: false,
    }) as unknown as Sprint;

const milestone = (milestoneId: number, title: string, sprintId: number | null): Milestone =>
    ({
        milestoneId,
        taskId: 1000 + milestoneId,
        projectId: 1,
        title,
        status: "Open",
        sprintId,
        isDeleted: false,
        assignees: [],
        tags: [],
        dueDate: null,
    }) as unknown as Milestone;

const MS_NO_SPRINT = milestone(1, "Backlog polish", null);
const MS_SPRINT_7 = milestone(2, "Launch", 7);
const MS_SPRINT_5 = milestone(3, "Hardening", 5);

/** A task currently filed under `currentMilestoneId`, in `currentSprintId`. */
const setup = (currentMilestoneId: number | null, currentSprintId: number | null) => {
    const onChangeMilestone = vi.fn();
    const useSM = {
        projectSprints: { 1: [sprint(5), sprint(7)] },
        projectMilestones: { 1: [MS_NO_SPRINT, MS_SPRINT_7, MS_SPRINT_5] },
    };
    render(
        <CssVarsProvider>
            <SprintMilestonePicker
                milestoneId={currentMilestoneId}
                projectId={1}
                showMilestone={true}
                showSprint={false}
                sprintId={currentSprintId}
                useSM={useSM as never}
                onChangeMilestone={onChangeMilestone}
                onChangeSprint={() => undefined}
            />
        </CssVarsProvider>
    );
    return { onChangeMilestone };
};

const pick = async (label: string) => {
    fireEvent.mouseDown(screen.getByRole("combobox"));
    const options = await screen.findAllByRole("option");
    const option = options.find((o) => (o.textContent ?? "").includes(label));
    if (!option) throw new Error(`no option "${label}" in ${options.map((o) => o.textContent)}`);
    fireEvent.click(option);
};

beforeEach(() => vi.clearAllMocks());

describe("SprintMilestonePicker: the sprint follows the milestone", () => {
    it("a milestone with NO sprint leaves the task with none, even when it had one", async () => {
        const { onChangeMilestone } = setup(3, 5);

        await pick("Backlog polish");

        expect(onChangeMilestone).toHaveBeenCalledWith(1, 1001, null);
    });

    it("a milestone with a sprint hands that sprint over", async () => {
        const { onChangeMilestone } = setup(null, null);

        await pick("Launch");

        expect(onChangeMilestone).toHaveBeenCalledWith(2, 1002, 7);
    });

    it("hands the sprint over even when the task is already in it", async () => {
        // No milestone yet, already in sprint 5; the milestone is in sprint 5 too.
        // The answer is still 5, not "unsaid" (the old contract sent nothing here).
        const { onChangeMilestone } = setup(null, 5);
        await pick("Hardening");

        expect(onChangeMilestone).toHaveBeenCalledWith(3, 1003, 5);
    });

    it("clearing the milestone leaves the task with no sprint", async () => {
        const { onChangeMilestone } = setup(2, 7);

        await pick("No milestone");

        expect(onChangeMilestone).toHaveBeenCalledWith(null, null, null);
    });
});
