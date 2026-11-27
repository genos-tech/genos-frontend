/** The project chat's task and milestone card (MIP-2484). */
import { CssVarsProvider } from "@mui/joy/styles";
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { TaskCardEntry } from "../features/chat/taskCards/taskCardStore";
import type { LiveMilestoneCard, LiveTaskCard } from "../features/chat/taskCards/taskCardTypes";
import { TaskMessageCard } from "../features/chat/taskCards/TaskMessageCard";

const live = vi.hoisted(() => ({ entry: undefined as TaskCardEntry | undefined }));
vi.mock("../features/chat/taskCards/useLiveTaskCard", () => ({
    useLiveTaskCard: () => live.entry,
}));
vi.mock("../components/ui/avatars/UserAvatar", () => ({ UserAvatar: () => <span /> }));
vi.mock("../components/ui/avatars/AvatarContext", () => ({
    ResolvedUserName: ({ fallbackName }: { fallbackName: string }) => <bdi>{fallbackName}</bdi>,
}));

const task: LiveTaskCard = {
    kind: "task",
    taskId: 12,
    displayId: "WR-3",
    title: "Move DNS",
    excerpt: "Waiting for the certificate.",
    status: "Blocked",
    priority: "High",
    effortLevel: null,
    reporter: { userId: "u1", userName: "Aiko" },
    assignee: null,
    dueDate: "2020-01-05",
    startDate: null,
    createdAt: "2026-11-01T00:00:00Z",
    updatedAt: "2026-11-02T00:00:00Z",
    tags: ["a", "b", "c", "d"].map((tagName) => ({ tagName, tagColor: "", tagTextColor: "" })),
    tagCount: 6,
    milestone: { milestoneId: 1, taskId: 9, displayId: "WR-1", title: "Launch" },
    parent: null,
    project: { projectId: 1, projectName: "Web" },
    blockedBy: [{ taskId: 13, displayId: "WR-4", title: "Certificate" }],
    blockedByCount: 2,
};

const milestone: LiveMilestoneCard = {
    ...task,
    kind: "milestone",
    taskId: 9,
    milestoneId: 1,
    displayId: "WR-1",
    title: "Launch",
    status: "WIP",
    sprint: { sprintId: 2, name: "S14" },
    assignees: [{ userId: "u2", userName: "Marcus" }],
    assigneeCount: 5,
    progress: { total: 4, closed: 1, byStatus: { Open: 2, Closed: 1, WIP: 1 } },
};

const onOpen = vi.fn();
const outer = vi.fn();
const show = (entry: TaskCardEntry | undefined) => {
    live.entry = entry;
    return render(
        <CssVarsProvider>
            <div onClick={outer}>
                <TaskMessageCard
                    fallback={<div data-testid="stored-body" />}
                    framed={false}
                    messageUpdatedAt="2026-11-02T00:00:00Z"
                    seedDisplayId="WR-3"
                    seedStatus="Open"
                    seedTitle="Title as posted"
                    sentAt="2026-11-01 09:00"
                    taskId={12}
                    viewerId="u1"
                    onOpen={onOpen}
                />
            </div>
        </CssVarsProvider>
    );
};

describe("TaskMessageCard", () => {
    beforeEach(() => {
        onOpen.mockClear();
        outer.mockClear();
    });

    it("shows the message's own title until the live task arrives", () => {
        show({ status: "loading" });
        expect(screen.getByText("Title as posted")).toBeTruthy();
        expect(screen.getByRole("button").getAttribute("aria-busy")).toBe("true");
    });

    it("is one control that opens the task, by click and by keyboard", () => {
        show({ status: "ready", data: task });
        const buttons = screen.getAllByRole("button");
        expect(buttons).toHaveLength(1);
        expect(buttons[0].getAttribute("aria-label")).toBe("Open task WR-3: Move DNS");
        // The name is short, so the facts are its description.
        const described = document.getElementById(buttons[0].getAttribute("aria-describedby")!);
        expect(described?.textContent).toContain("Unassigned");
        fireEvent.click(buttons[0]);
        fireEvent.keyDown(buttons[0], { key: "Enter" });
        expect(onOpen).toHaveBeenCalledTimes(2);
        // The bubble's own click handler does not run a second time.
        expect(outer).not.toHaveBeenCalled();
    });

    it("shows the live fields, with an overdue date in the overdue tone", () => {
        const { container } = show({ status: "ready", data: task });
        for (const text of [
            "Move DNS",
            "Waiting for the certificate.",
            "Unassigned",
            "High",
            "Launch",
            "Blocked by WR-4 Certificate",
            "+1",
            "+3",
        ]) {
            expect(screen.getByText(text)).toBeTruthy();
        }
        expect(container.querySelector('[data-tone="overdue"]')).toBeTruthy();
        expect(container.textContent).toContain("Created by Aiko");
        expect(screen.queryByTestId("stored-body")).toBeNull();
    });

    it("never calls finished work overdue", () => {
        const { container } = show({ status: "ready", data: { ...task, status: "Closed" } });
        expect(container.querySelector('[data-tone="overdue"]')).toBeNull();
        expect(screen.queryByText(/Blocked by/)).toBeNull();
    });

    it("draws a milestone with its progress", () => {
        show({ status: "ready", data: milestone });
        expect(screen.getByText("1 of 4 done")).toBeTruthy();
        const bar = screen.getByTestId("milestone-status-bar");
        expect(bar.getAttribute("aria-label")).toBe("1 of 4 tasks done: 1 Closed, 1 WIP, 2 Open");
        expect([...bar.children].map((c) => c.getAttribute("data-status"))).toEqual([
            "Closed",
            "WIP",
            "Open",
        ]);
        expect(screen.getByText("+4")).toBeTruthy();
        expect(screen.getByText("Sprint S14")).toBeTruthy();
    });

    it("says so when a milestone has no tasks", () => {
        show({
            status: "ready",
            data: { ...milestone, progress: { total: 0, closed: 0, byStatus: {} } },
        });
        expect(screen.getByText("No tasks yet")).toBeTruthy();
    });

    it.each(["gone", "error"] as const)("falls back to the stored message when %s", (status) => {
        show({ status });
        expect(screen.getByTestId("stored-body")).toBeTruthy();
        expect(screen.queryByTestId("task-message-card")).toBeNull();
    });
});
