/**
 * The approval card for `manage_milestone` when it converts or moves (MIP-1564, genos-api
 * AGENT_PARITY_TOOLS).
 *
 *   convert  `task_id` turns a root task into a milestone, `milestone_id` a milestone into a task. The
 *            backend adds `current: {direction, title, display_id, ...}` for an item the approver can
 *            open: the sub-tasks that join, or the tasks that stay, the people, and the folder and
 *            sprint that are dropped.
 *   move     an `update` that carries `project_id`. The backend adds `current.project_id` (the project
 *            it leaves) and `current.move: {tasks, sprint, folder, tags}`.
 *
 * The card says WHAT is converted and what comes along or is lost; "can't be undone" is the card's own
 * chip (`undoable: false`, `undo_reason: no_snapshot`). Every other manage_milestone card is unchanged
 * (`ApprovalPreviews.test.tsx` holds them).
 */

import { CssVarsProvider } from "@mui/joy/styles";
import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ApprovalCard } from "../features/agentQA/ApprovalCard";
import type { PendingApprovalPayload } from "../services/agentApi";

const mount = (args: Record<string, unknown>, over: Partial<PendingApprovalPayload> = {}) => {
    const pending: PendingApprovalPayload = {
        step: 1,
        tool_name: "manage_milestone",
        arguments: args,
        approval_token: "tok",
        run_id: "run",
        ...over,
    };
    return render(
        <CssVarsProvider>
            <ApprovalCard
                approveLabel="Approve"
                pending={pending}
                rejectLabel="Reject"
                titleText="Approval required"
                onApprove={vi.fn()}
                onReject={vi.fn()}
            />
        </CssVarsProvider>
    );
};

const NO_UNDO = { undoable: false, undo_reason: "no_snapshot" } as const;

afterEach(cleanup);

describe("convert: a root task into a milestone", () => {
    const args = {
        action: "convert",
        task_id: "WRD-7",
        current: {
            direction: "task_to_milestone",
            title: "Plan the launch",
            display_id: "WRD-7",
            sub_tasks: 3,
            assignee: "alice",
        },
    };

    it("names the task, says the row stays and how many sub-tasks join", () => {
        mount(args, NO_UNDO);
        expect(screen.getByText("Turn into a milestone: WRD-7 Plan the launch")).toBeTruthy();
        expect(screen.getByText("Same row: id, body, comments and history stay")).toBeTruthy();
        expect(screen.getByText("3 sub-task(s) join the milestone")).toBeTruthy();
        // structured: neither the raw key:value fallback nor the other direction's lines
        expect(screen.queryByText("task_id:")).toBeNull();
        expect(screen.queryByText(/stay under it/)).toBeNull();
        expect(screen.queryByText(/dropped/)).toBeNull();
    });

    it("says it can't be undone, once, from the card's own chip", () => {
        mount(args, NO_UNDO);
        const chip = screen.getByTestId("undo-chip");
        expect(within(chip).getByText("Can't be undone")).toBeTruthy();
        expect(screen.queryByText("This action cannot be undone")).toBeNull();
    });

    it("says no sub-tasks at all when the task has none", () => {
        mount({ ...args, current: { ...args.current, sub_tasks: 0 } });
        expect(screen.queryByText(/sub-task\(s\) join/)).toBeNull();
    });

    it("falls back to the id the model sent for a task the approver can't read", () => {
        mount({ action: "convert", task_id: "WRD-9" });
        expect(screen.getByText("Turn into a milestone: WRD-9")).toBeTruthy();
        expect(screen.queryByText(/sub-task/)).toBeNull();
    });
});

describe("convert: a milestone into a task", () => {
    const args = {
        action: "convert",
        milestone_id: "Customer launch",
        current: {
            direction: "milestone_to_task",
            title: "Customer launch",
            display_id: "WRD-12",
            tasks: 4,
            assignee: "alice",
            collaborators: ["bob", "carol"],
            folder: "Roadmap",
            sprint: "Sprint 12",
        },
    };

    it("says what stays, who becomes a collaborator, and what is dropped", () => {
        mount(args, NO_UNDO);
        expect(screen.getByText("Turn into a task: WRD-12 Customer launch")).toBeTruthy();
        expect(screen.getByText("4 task(s) stay under it as sub-tasks")).toBeTruthy();
        expect(screen.getByText("Assignee: alice")).toBeTruthy();
        expect(screen.getByText("The others become collaborators: bob, carol")).toBeTruthy();
        expect(screen.getByText("Folder dropped: Roadmap")).toBeTruthy();
        expect(screen.getByText("Sprint dropped: Sprint 12")).toBeTruthy();
        expect(screen.getByText("Same row: id, body, comments and history stay")).toBeTruthy();
    });

    it("leaves out what the milestone does not have", () => {
        mount({
            ...args,
            current: {
                direction: "milestone_to_task",
                title: "Empty",
                tasks: 0,
                assignee: null,
                collaborators: [],
                folder: null,
                sprint: null,
            },
        });
        expect(screen.getByText("Turn into a task: Empty")).toBeTruthy();
        for (const text of [/stay under it/, /Assignee:/, /collaborators/, /dropped/]) {
            expect(screen.queryByText(text)).toBeNull();
        }
    });

    it("reads the direction from the id the model sent when the backend added nothing", () => {
        mount({ action: "convert", milestone_id: "12" });
        expect(screen.getByText("Turn into a task: 12")).toBeTruthy();
    });

    it("prints names as text, never as markup", () => {
        const title = "<img src=x onerror=alert(1)>";
        const { container } = mount({
            ...args,
            current: { ...args.current, title, display_id: null, folder: "<b>x</b>" },
        });
        expect(screen.getByText(`Turn into a task: ${title}`)).toBeTruthy();
        expect(container.querySelector("img")).toBeNull();
        expect(container.querySelector("b")).toBeNull();
    });
});

describe("a project move", () => {
    const args = {
        action: "update",
        milestone_id: "Customer launch",
        project_id: "Archive",
        title: "Customer launch v2",
        current: {
            title: "Customer launch",
            project_id: "Website",
            move: { tasks: 5, sprint: "Sprint 12", folder: "Roadmap", tags: ["launch", "q4"] },
        },
    };

    it("says where it goes from and to, how many tasks go with it and what is cleared", () => {
        mount(args, NO_UNDO);
        expect(screen.getByText("Move milestone: Customer launch")).toBeTruthy();
        expect(screen.getByText("Project: Website → Archive")).toBeTruthy();
        expect(screen.getByText("5 task(s) move with it")).toBeTruthy();
        expect(screen.getByText("Sprint cleared: Sprint 12")).toBeTruthy();
        expect(screen.getByText("Folder cleared: Roadmap")).toBeTruthy();
        expect(screen.getByText("Tags cleared: launch, q4")).toBeTruthy();
        expect(screen.getByText("New display ids in the new project")).toBeTruthy();
        // the title change that rides along is still an old → new
        expect(screen.getByText("Customer launch").parentElement?.textContent).toBe(
            "Customer launch → Customer launch v2"
        );
        expect(screen.queryByText("Project: Archive")).toBeNull();
        expect(within(screen.getByTestId("undo-chip")).getByText("Can't be undone")).toBeTruthy();
    });

    it("leaves out a sprint, a folder or tags the milestone does not have", () => {
        mount({
            ...args,
            current: {
                project_id: "Website",
                move: { tasks: 0, sprint: null, folder: null, tags: [] },
            },
        });
        expect(screen.getByText("Project: Website → Archive")).toBeTruthy();
        for (const text of [
            /task\(s\) move/,
            /Sprint cleared/,
            /Folder cleared/,
            /Tags cleared/,
        ]) {
            expect(screen.queryByText(text)).toBeNull();
        }
        expect(screen.getByText("New display ids in the new project")).toBeTruthy();
    });

    it("is a plain update card, with no move line, when the backend sent no move facts", () => {
        mount({
            action: "update",
            milestone_id: "Customer launch",
            status: "Closed",
            current: { status: "Open" },
        });
        expect(screen.getByText("Update milestone: Customer launch")).toBeTruthy();
        expect(screen.getByText("Status: Open → Closed")).toBeTruthy();
        expect(screen.queryByText(/Move milestone/)).toBeNull();
        expect(screen.queryByText(/display ids/)).toBeNull();
    });

    it("falls back to the destination's name only when the project it leaves is unknown", () => {
        mount({
            ...args,
            current: { move: { tasks: 2, sprint: null, folder: null, tags: [] } },
        });
        expect(screen.getByText("Project: Archive")).toBeTruthy();
    });
});
