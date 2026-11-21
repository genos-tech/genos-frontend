/**
 * MIP-1751: the task preview's milestone dropdown never offers a Closed
 * milestone as a target, whether or not its sprint has ended. The task's own
 * current milestone is still listed when it is Closed, so the value shown does
 * not silently vanish.
 */

import { CssVarsProvider } from "@mui/joy/styles";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { SprintMilestonePicker } from "../features/tasks/sprint-milestone/components/SprintMilestonePicker";
import type { Milestone, Sprint } from "../features/tasks/sprint-milestone/types";

const sprint = (sprintId: number, status: string): Sprint =>
    ({
        sprintId,
        projectId: 1,
        name: `Sprint ${sprintId}`,
        sequenceNumber: sprintId,
        startDate: "2026-11-01",
        endDate: "2026-11-14",
        status,
        isDeleted: false,
    }) as unknown as Sprint;

const milestone = (
    milestoneId: number,
    title: string,
    status: string,
    sprintId: number | null
): Milestone =>
    ({
        milestoneId,
        taskId: 1000 + milestoneId,
        projectId: 1,
        title,
        status,
        sprintId,
        isDeleted: false,
        assignees: [],
        tags: [],
        dueDate: null,
    }) as unknown as Milestone;

const OPEN = milestone(1, "Open backlog", "Open", null);
const CLOSED_ACTIVE_SPRINT = milestone(2, "Closed in active sprint", "Closed", 7);
const CLOSED_NO_SPRINT = milestone(3, "Closed backlog", "Closed", null);

const setup = (currentMilestoneId: number | null) => {
    const useSM = {
        projectSprints: { 1: [sprint(7, "active")] },
        projectMilestones: { 1: [OPEN, CLOSED_ACTIVE_SPRINT, CLOSED_NO_SPRINT] },
    };
    render(
        <CssVarsProvider>
            <SprintMilestonePicker
                milestoneId={currentMilestoneId}
                projectId={1}
                showMilestone={true}
                showSprint={false}
                sprintId={null}
                useSM={useSM as never}
                onChangeMilestone={vi.fn()}
                onChangeSprint={() => undefined}
            />
        </CssVarsProvider>
    );
};

const optionLabels = async (): Promise<string[]> => {
    fireEvent.mouseDown(screen.getByRole("combobox"));
    const options = await screen.findAllByRole("option");
    return options.map((o) => o.textContent ?? "");
};

describe("SprintMilestonePicker: Closed milestones are not offered", () => {
    it("lists Open milestones and no Closed one, whether its sprint has ended or not", async () => {
        setup(null);
        const labels = await optionLabels();

        expect(labels.some((l) => l.includes("Open backlog"))).toBe(true);
        expect(labels.some((l) => l.includes("Closed in active sprint"))).toBe(false);
        expect(labels.some((l) => l.includes("Closed backlog"))).toBe(false);
    });

    it("still lists the task's own current milestone when it is Closed", async () => {
        setup(3);
        const labels = await optionLabels();

        expect(labels.some((l) => l.includes("Closed backlog"))).toBe(true);
        expect(labels.some((l) => l.includes("Closed in active sprint"))).toBe(false);
    });
});
