/**
 * ThreadTaskBreadcrumbs — the thread header's task-info strip (Req 1/2).
 * Renders the real component (the same NoteBreadcrumbs the task-note
 * header uses) and asserts the observable behavior: the task's display
 * id + ancestry show, and clicking the task tail node opens it.
 */
import { CssVarsProvider } from "@mui/joy/styles";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { ThreadTaskBreadcrumbs } from "../features/chat/components/headers/ThreadTaskBreadcrumbs";
import { TaskProps } from "../types/tasks";

const baseTask = (over: Partial<TaskProps> = {}): TaskProps =>
    ({
        id: 42,
        displayId: "GEN-42",
        title: "Ship the thing",
        project: { projectId: 7, projectName: "Genos" },
        status: { code: 0, status: "WIP", color: "#0a0", textColor: "#fff" },
        milestoneTitle: null,
        parentTaskTitle: null,
        parentTaskIsMilestone: null,
        ...over,
    }) as TaskProps;

const renderCrumbs = (task: TaskProps, onOpen = vi.fn()) => {
    render(
        <CssVarsProvider>
            <ThreadTaskBreadcrumbs task={task} onOpen={onOpen} />
        </CssVarsProvider>
    );
    return onOpen;
};

describe("ThreadTaskBreadcrumbs", () => {
    it("shows the task display id, project ancestry, and status", () => {
        renderCrumbs(baseTask());
        expect(screen.getByText("GEN-42")).toBeTruthy();
        expect(screen.getByText("Genos")).toBeTruthy();
        expect(screen.getByText("WIP")).toBeTruthy();
    });

    it("renders the milestone crumb for a task inside a milestone", () => {
        renderCrumbs(baseTask({ milestoneId: 9, milestoneTitle: "Launch" }));
        expect(screen.getByText("Launch")).toBeTruthy();
    });

    it("opens the task when the tail node is clicked", async () => {
        const user = userEvent.setup();
        const onOpen = renderCrumbs(baseTask());
        // The task title is the clickable tail node (a <button> inside
        // NoteBreadcrumbs). Its label is truncated to 14 chars.
        await user.click(screen.getByText(/Ship the thing/));
        expect(onOpen).toHaveBeenCalledTimes(1);
    });
});
