/**
 * A milestone nobody has written a goal for is flagged on the dashboard card
 * (MIP-799).
 */
import { CssVarsProvider } from "@mui/joy/styles";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { AssignedMilestoneCard } from "../features/tasks/components/dashboard/AssignedMilestoneCard";
import { Milestone } from "../features/tasks/sprint-milestone/types";
import { TASK_TEMPLATES } from "../features/tasks/utils/taskTemplates";

const milestone = (description: unknown): Milestone =>
    ({
        milestoneId: 1,
        taskId: 10,
        projectId: 1,
        teamId: 1,
        sprintId: null,
        reporterId: null,
        title: "Launch",
        description,
        status: "Open",
        statusCode: 0,
        priority: null,
        priorityCode: null,
        startDate: null,
        dueDate: null,
        tags: [],
        assignees: [],
        tasksTotal: 0,
        tasksClosed: 0,
    }) as unknown as Milestone;

const renderCard = (description: unknown) =>
    render(
        <CssVarsProvider>
            <AssignedMilestoneCard
                milestone={milestone(description)}
                sprintName={null}
                onOpen={() => {}}
            />
        </CssVarsProvider>
    );

describe("AssignedMilestoneCard no-goal marker", () => {
    it("shows it for an empty description", () => {
        renderCard(null);
        expect(screen.getByText("No goal")).toBeTruthy();
    });

    it("shows it for the untouched milestone template", () => {
        renderCard(TASK_TEMPLATES.milestone.blocks);
        expect(screen.getByText("No goal")).toBeTruthy();
    });

    it("is absent once a goal is written", () => {
        renderCard([
            { type: "paragraph", content: [{ type: "text", text: "Ship v1.", styles: {} }] },
        ]);
        expect(screen.queryByText("No goal")).toBeNull();
    });
});
