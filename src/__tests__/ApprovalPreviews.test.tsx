import { CssVarsProvider } from "@mui/joy/styles";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { ApprovalCard } from "../features/agentQA/ApprovalCard";
import type { PendingApprovalPayload } from "../services/agentApi";

const renderCard = (tool_name: string, args: Record<string, unknown>) => {
    const pending: PendingApprovalPayload = {
        step: 1,
        tool_name,
        arguments: args,
        approval_token: "tok",
        run_id: "run",
    };
    return render(
        <CssVarsProvider>
            <ApprovalCard
                approveLabel="Approve"
                isDark={false}
                pending={pending}
                rejectLabel="Reject"
                titleText={`Approval required: ${tool_name}`}
                onApprove={vi.fn()}
                onReject={vi.fn()}
            />
        </CssVarsProvider>
    );
};

// Args as they arrive over the wire AFTER the backend friendly-izes
// them: project_id → project name, assignee ids → usernames.
const planArgs = {
    project_id: "Website Redesign",
    milestone: {
        title: "Beta launch",
        due_date: "2026-08-31",
        assignee_ids: ["alice"],
    },
    tasks: [
        { title: "Design review", priority: "High" },
        {
            title: "Implementation",
            content_markdown: "**Build** the thing",
            blocked_by_indexes: [0],
        },
        { title: "QA pass", blocked_by_indexes: [1] },
        // Deliberately NOT adjacent to its parent (index 1) — the tree
        // must still render it under Implementation.
        { title: "Write unit tests", parent_index: 1 },
    ],
};

describe("TaskPlanPreview (create_task_plan approval)", () => {
    it("renders the milestone header, task tree, and dependency sublines", () => {
        renderCard("create_task_plan", planArgs);

        expect(screen.getByText("Beta launch")).toBeTruthy();
        expect(screen.getByText("New milestone")).toBeTruthy();
        expect(screen.getByText(/Project: Website Redesign/)).toBeTruthy();
        expect(screen.getByText("alice")).toBeTruthy();

        expect(screen.getByText("Design review")).toBeTruthy();
        expect(screen.getByText(/↳ Write unit tests/)).toBeTruthy();
        expect(screen.getByText("Blocked by Design review")).toBeTruthy();
        expect(screen.getByText("Blocked by Implementation")).toBeTruthy();
        expect(screen.getByText("4 task(s) · 2 dependency(ies)")).toBeTruthy();

        // Structured — the raw JSON/monospace fallback must NOT render.
        expect(screen.queryByText(/blocked_by_indexes/)).toBeNull();
        expect(screen.queryByText(/tasks:/)).toBeNull();
    });

    it("orders a non-adjacent sub-task directly under its parent", () => {
        renderCard("create_task_plan", planArgs);
        const text = document.body.textContent || "";
        const parentPos = text.indexOf("Implementation");
        const childPos = text.indexOf("Write unit tests");
        const qaPos = text.indexOf("QA pass");
        expect(parentPos).toBeGreaterThan(-1);
        // Child renders after its parent but BEFORE the next top-level
        // task, despite appearing last in the args array.
        expect(childPos).toBeGreaterThan(parentPos);
        expect(qaPos).toBeGreaterThan(childPos);
    });

    it("reveals the markdown body behind the details toggle", () => {
        renderCard("create_task_plan", planArgs);
        expect(screen.queryByText(/Build/)).toBeNull();
        fireEvent.click(screen.getByLabelText("Show details"));
        expect(screen.getByText("Build")).toBeTruthy();
    });

    it("shows the anchor task in sub-task mode (parent_task_id)", () => {
        renderCard("create_task_plan", {
            project_id: "Website Redesign",
            // Friendly-ized server-side to the task's display id.
            parent_task_id: "WRD-7",
            tasks: [{ title: "Rerun trace on real devices" }, { title: "Strip legacy CSS" }],
        });
        expect(screen.getByText("Sub-tasks of WRD-7")).toBeTruthy();
        expect(screen.getByText("Rerun trace on real devices")).toBeTruthy();
        // No milestone header in this mode.
        expect(screen.queryByText("New milestone")).toBeNull();
        expect(screen.queryByText("Existing milestone")).toBeNull();
    });
});

describe("BulkUpdatePreview (update_tasks_bulk approval)", () => {
    it("renders old→new diffs with the current snapshot and rationale", () => {
        renderCard("update_tasks_bulk", {
            updates: [
                {
                    task_id: 7,
                    display_id: "WRD-2",
                    title: "Implementation",
                    current: {
                        priority: "Normal",
                        status: "Open",
                        due_date: "2026-08-01",
                        effort_level: null,
                    },
                    priority: "High",
                    due_date: "",
                    rationale: "Blocks the QA pass.",
                },
            ],
        });

        expect(screen.getByText("1 task change(s)")).toBeTruthy();
        expect(screen.getByText(/WRD-2/)).toBeTruthy();
        // Old value struck through, new value emphasized.
        const oldValue = screen.getByText("Normal");
        expect(oldValue).toBeTruthy();
        expect(screen.getByText("High")).toBeTruthy();
        // due_date "" renders as a clear ("none"), with the old date shown.
        expect(screen.getByText("2026-08-01")).toBeTruthy();
        expect(screen.getByText("none")).toBeTruthy();
        expect(screen.getByText("Blocks the QA pass.")).toBeTruthy();
        // Fields the row doesn't change (status) must not show a diff.
        expect(screen.queryByText(/Status:/)).toBeNull();
    });
});

describe("ApprovalCard fallback", () => {
    it("keeps the key:value monospace list for tools without a renderer", () => {
        renderCard("create_task", { title: "Buy coffee", project_id: "Website Redesign" });
        expect(screen.getByText("title:")).toBeTruthy();
        expect(screen.getByText("Buy coffee")).toBeTruthy();
        expect(screen.getByText("project_id:")).toBeTruthy();
    });
});
