import { CssVarsProvider } from "@mui/joy/styles";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { getToolLabel } from "../features/agentQA";
import { ApprovalCard } from "../features/agentQA/ApprovalCard";
import { en } from "../i18n/locales/en";
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

describe("NoteWritePreview (create_note / update_note approvals)", () => {
    it("renders a personal create with folder chip and markdown body", () => {
        renderCard("create_note", {
            note_type: "personal",
            title: "Onboarding research",
            content_text: "### Key findings\n- fewer steps convert better",
            // Friendly-ized server-side to the folder's name.
            folder_id: "Research",
        });
        expect(screen.getByText("New note in My Notes")).toBeTruthy();
        expect(screen.getByText("Folder: Research")).toBeTruthy();
        expect(screen.getByText("Onboarding research")).toBeTruthy();
        expect(screen.getByText("Key findings")).toBeTruthy();
        expect(screen.getByText(/fewer steps convert better/)).toBeTruthy();
        // Structured — the raw key:value fallback must NOT render.
        expect(screen.queryByText("content_text:")).toBeNull();
    });

    it("renders a task create with project + task destination chips", () => {
        renderCard("create_note", {
            note_type: "task",
            title: "Plan: mobile Safari perf",
            content_text: "### Goal\nShip it",
            // Friendly-ized: project name + task display id.
            project_id: "Website Redesign",
            task_id: "WRD-7",
        });
        expect(screen.getByText("New task note")).toBeTruthy();
        expect(screen.getByText("Project: Website Redesign")).toBeTruthy();
        expect(screen.getByText("Task: WRD-7")).toBeTruthy();
    });

    it("renders citation-token links as text, real web links as anchors", () => {
        // Token targets ([prose](task:12)) only become /workspace/...
        // hrefs when the backend converts the body at save time — as
        // anchors in the preview they'd navigate the SPA to a bogus
        // relative URL on click.
        renderCard("create_note", {
            note_type: "task",
            title: "Plan",
            content_text:
                "Plan for [WRD-7 Safari perf](task:7), see [MDN](https://developer.mozilla.org).",
            project_id: "Website Redesign",
        });
        const tokenLabel = screen.getByText("WRD-7 Safari perf");
        expect(tokenLabel.closest("a")).toBeNull();
        const webLink = screen.getByText("MDN").closest("a");
        expect(webLink?.getAttribute("href")).toBe("https://developer.mozilla.org");
    });

    it("renders an update with the resolved note title and changed-field chips", () => {
        renderCard("update_note", {
            note_id: 42,
            note_type: "personal",
            note_title: "Spotlight tips",
            content_text: "### Rewritten\nBetter structure",
        });
        expect(screen.getByText("Update note: Spotlight tips")).toBeTruthy();
        // Body changes; title does not.
        expect(screen.getByText("Body")).toBeTruthy();
        expect(screen.queryByText("Title")).toBeNull();
        expect(screen.getByText("Rewritten")).toBeTruthy();
    });
});

describe("CreateTaskPreview (create_task approval)", () => {
    it("renders the new-task header, destination + meta chips, and plain-text body", () => {
        renderCard("create_task", {
            title: "Ship the perf fix",
            // Friendly-ized server-side to the project name.
            project_id: "Website Redesign",
            content_text: "Batch the DB writes and measure again.",
            priority: "High",
            effort_level: "Moderate",
            due_date: "2026-09-15",
        });
        expect(screen.getByText("New task")).toBeTruthy();
        expect(screen.getByText("Project: Website Redesign")).toBeTruthy();
        expect(screen.getByText("High")).toBeTruthy();
        expect(screen.getByText("Moderate")).toBeTruthy();
        expect(screen.getByText("Due 2026-09-15")).toBeTruthy();
        expect(screen.getByText("Ship the perf fix")).toBeTruthy();
        expect(screen.getByText(/Batch the DB writes/)).toBeTruthy();
        // Structured — the raw key:value fallback must NOT render.
        expect(screen.queryByText("project_id:")).toBeNull();
        expect(screen.queryByText("content_text:")).toBeNull();
    });
});

describe("UpdateTaskPreview (update_task approval)", () => {
    it("renders only the proposed fields, with the new title and body", () => {
        renderCard("update_task", {
            // Friendly-ized server-side to the task's display id.
            task_id: "WRD-5",
            title: "Rename: perf fix",
            status: "WIP",
            priority: "High",
            content_text: "Now batching writes.",
        });
        expect(screen.getByText("Update task: WRD-5")).toBeTruthy();
        expect(screen.getByText("Status: WIP")).toBeTruthy();
        expect(screen.getByText("Priority: High")).toBeTruthy();
        expect(screen.getByText("Rename: perf fix")).toBeTruthy();
        expect(screen.getByText(/Now batching writes/)).toBeTruthy();
        // Fields the model didn't propose must not appear.
        expect(screen.queryByText(/Effort:/)).toBeNull();
        expect(screen.queryByText(/Due:/)).toBeNull();
    });

    it("shows a due-date clear ('') as a cleared chip", () => {
        renderCard("update_task", { task_id: "WRD-9", due_date: "" });
        expect(screen.getByText("Update task: WRD-9")).toBeTruthy();
        expect(screen.getByText("Due: none")).toBeTruthy();
    });
});

describe("AddCommentPreview (add_comment approval)", () => {
    it("renders the comment header and the plain-text body", () => {
        renderCard("add_comment", {
            // Friendly-ized server-side to the task's display id.
            task_id: "WRD-5",
            body_text: "Confirmed the fix on staging — closing after PR merges.",
        });
        expect(screen.getByText("Comment on WRD-5")).toBeTruthy();
        expect(screen.getByText(/Confirmed the fix on staging/)).toBeTruthy();
        // Structured — the raw key:value fallback must NOT render.
        expect(screen.queryByText("body_text:")).toBeNull();
    });
});

describe("getToolLabel", () => {
    it("maps a known tool_name to its friendly, non-technical label", () => {
        expect(getToolLabel("search_knowledge_base", en)).toBe("Searching your workspace");
        expect(getToolLabel("update_tasks_bulk", en)).toBe("Updating several tasks");
        expect(getToolLabel("create_task", en)).toBe("Creating a task");
    });

    it("falls back to the raw tool_name for an unmapped tool", () => {
        expect(getToolLabel("some_future_tool", en)).toBe("some_future_tool");
    });
});

describe("ApprovalCard fallback", () => {
    it("keeps the key:value monospace list for tools without a renderer", () => {
        // assign_task has no structured preview, so it still falls through
        // to the generic key:value dump.
        renderCard("assign_task", { task_id: "WRD-5", assignee_id: "alice" });
        expect(screen.getByText("task_id:")).toBeTruthy();
        expect(screen.getByText("WRD-5")).toBeTruthy();
        expect(screen.getByText("assignee_id:")).toBeTruthy();
    });
});
