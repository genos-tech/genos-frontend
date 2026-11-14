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

    it("shows each task's starting status and template (AGENT_PARITY_TOOLS)", () => {
        renderCard("create_task_plan", {
            project_id: "Website Redesign",
            tasks: [
                { title: "Collect the copy", status: "Closed" },
                { title: "Crash on save", template: "bug" },
                { title: "Plain" },
            ],
        });
        expect(screen.getByText("Status: Closed")).toBeTruthy();
        expect(screen.getByText("Template: bug")).toBeTruthy();
        expect(screen.getAllByText(/^Status:/)).toHaveLength(1);
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
        expect(screen.queryByText(/Milestone:/)).toBeNull();
    });

    it("shows a milestone move, including a move-only row and a removal", () => {
        renderCard("update_tasks_bulk", {
            // Both sides arrive labelled with milestone titles.
            updates: [
                {
                    task_id: 7,
                    display_id: "WRD-2",
                    title: "Implementation",
                    current: { milestone_id: "v1.0" },
                    milestone_id: "v2.0",
                    rationale: "Slips to the next release.",
                },
                {
                    task_id: 8,
                    display_id: "WRD-3",
                    title: "Docs",
                    current: { milestone_id: "v1.0" },
                    milestone_id: "",
                    rationale: "Not release-bound.",
                },
            ],
        });
        // A move is a change — the row must not read as "(no field changes)".
        expect(screen.queryByText("(no field changes)")).toBeNull();
        const rows = screen.getAllByText(/Milestone:/).map((el) => el.textContent);
        expect(rows).toEqual(["Milestone: v1.0 → v2.0", "Milestone: v1.0 → none"]);
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

    it("renders a team create in its Team Notes folder", () => {
        renderCard("create_note", {
            note_type: "team",
            title: "Onboarding",
            folder_id: "Handbook",
        });
        expect(screen.getByText("New note in Team Notes")).toBeTruthy();
        expect(screen.getByText("Folder: Handbook")).toBeTruthy();
    });

    it("renders a chat create naming the chat, and a thread when there is one", () => {
        renderCard("create_note", {
            note_type: "chat",
            title: "Decisions",
            chat_id: "0f0e4a51-4a43-4e57-9d07-6d1f3b0a8c11",
            // Friendly-ized server-side to the chat's title.
            chat_name: "Design",
            thread_id: "6a4d3f7e-3b1e-4c0f-9a52-2f1f0f2c9b10",
        });
        expect(screen.getByText("New chat note")).toBeTruthy();
        expect(screen.getByText("Chat: Design")).toBeTruthy();
        expect(screen.getByText("Thread")).toBeTruthy();
    });

    it("leaves the thread chip off a note on the whole chat", () => {
        renderCard("create_note", {
            note_type: "chat",
            title: "Decisions",
            chat_id: "0f0e4a51-4a43-4e57-9d07-6d1f3b0a8c11",
            chat_name: "Design",
        });
        expect(screen.getByText("Chat: Design")).toBeTruthy();
        expect(screen.queryByText("Thread")).toBeNull();
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
    it("shows a start-date change and a tag replacement, and a clear of each", () => {
        renderCard("update_tasks_bulk", {
            updates: [
                {
                    task_id: 7,
                    display_id: "WRD-2",
                    title: "Implementation",
                    current: { start_date: "2026-11-01", tags: ["api", "perf"] },
                    start_date: "2026-11-05",
                    tags: ["api"],
                    rationale: "Starts after the review.",
                },
                {
                    task_id: 8,
                    display_id: "WRD-3",
                    title: "Docs",
                    current: { start_date: "2026-11-02", tags: ["docs"] },
                    start_date: "",
                    tags: [],
                    rationale: "Not scheduled yet.",
                },
            ],
        });
        expect(screen.queryByText("(no field changes)")).toBeNull();
        expect(screen.getAllByText(/Start:/).map((el) => el.textContent)).toEqual([
            "Start: 2026-11-01 → 2026-11-05",
            "Start: 2026-11-02 → none",
        ]);
        // An empty list is a clear, never a blank.
        expect(screen.getAllByText(/Tags:/).map((el) => el.textContent)).toEqual([
            "Tags: api, perf → api",
            "Tags: docs → none",
        ]);
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

    it("shows the parent the new task is filed under", () => {
        renderCard("create_task", {
            title: "A sub-task",
            project_id: "Website Redesign",
            // Friendly-ized server-side to the parent's display id.
            parent_task_id: "WRD-8",
        });
        expect(screen.getByText("Parent: WRD-8")).toBeTruthy();
    });
    it("shows the start date, collaborators and custom-field values", () => {
        renderCard("create_task", {
            title: "Ship the perf fix",
            project_id: "Website Redesign",
            start_date: "2026-11-05",
            // Usernames, or the raw id for someone the caller can't name.
            collaborators: ["alice", "42"],
            custom_fields: [
                { name: "Estimate", value: 3 },
                { name: "Platforms", values: ["ios", "web"] },
                { name: "Notes", value: "" },
            ],
        });
        expect(screen.getByText("Start 2026-11-05")).toBeTruthy();
        expect(screen.getByText("Collaborators: alice, 42")).toBeTruthy();
        expect(screen.getByText("Estimate: 3")).toBeTruthy();
        expect(screen.getByText("Platforms: ios, web")).toBeTruthy();
        // '' is the clear sentinel.
        expect(screen.getByText("Notes: none")).toBeTruthy();
        expect(screen.queryByText("custom_fields:")).toBeNull();
    });

    it("leaves the new chips off when none of them is proposed", () => {
        renderCard("create_task", { title: "Ship the perf fix", priority: "High" });
        expect(screen.queryByText(/^Start /)).toBeNull();
        expect(screen.queryByText(/Collaborators:/)).toBeNull();
        expect(screen.queryByText(/Status:/)).toBeNull();
        expect(screen.queryByText(/Reporter:/)).toBeNull();
        expect(screen.queryByText(/Template:/)).toBeNull();
        expect(screen.queryByText("Links")).toBeNull();
    });

    it("shows the starting status, reporter, template and links (AGENT_PARITY_TOOLS)", () => {
        renderCard("create_task", {
            title: "Login fails",
            project_id: "Website Redesign",
            status: "WIP",
            // A username, or the raw id for someone the caller can't name.
            reporter_id: "carol",
            template: "bug",
            links: [
                { url: "https://example.com/spec", title: "Spec" },
                { url: "https://example.com/bare" },
            ],
            // What the server filled in from the template: shown like any body.
            content_text: "### Summary\n\nLogin fails",
        });
        expect(screen.getByText("Status: WIP")).toBeTruthy();
        expect(screen.getByText("Reporter: carol")).toBeTruthy();
        expect(screen.getByText("Template: bug")).toBeTruthy();
        expect(screen.getByText("Links")).toBeTruthy();
        expect(screen.getByText("Spec · https://example.com/spec")).toBeTruthy();
        // A link without a title is its URL, once.
        expect(screen.getByText("https://example.com/bare")).toBeTruthy();
        expect(screen.queryByText("links:")).toBeNull();
    });

    it("draws a link as text, never as an anchor", () => {
        renderCard("create_task", {
            title: "T",
            links: [{ url: "javascript:alert(1)", title: "Click me" }],
        });
        expect(screen.getByText("Click me · javascript:alert(1)")).toBeTruthy();
        expect(document.querySelector("a")).toBeNull();
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

    it("shows a milestone move as old → new", () => {
        renderCard("update_task", {
            task_id: "WRD-5",
            milestone_id: "v2.0",
            current: { milestone_id: "v1.0" },
        });
        expect(screen.getByText("Milestone: v1.0 → v2.0")).toBeTruthy();
    });

    it("shows a removal from a milestone as cleared", () => {
        renderCard("update_task", {
            task_id: "WRD-5",
            milestone_id: "",
            current: { milestone_id: "v1.0" },
        });
        expect(screen.getByText("Milestone: v1.0 → none")).toBeTruthy();
    });

    it("shows a move into a milestone from none, and no chip for a null (no move)", () => {
        const { unmount } = renderCard("update_task", {
            task_id: "WRD-5",
            milestone_id: "v1.0",
            current: { milestone_id: null },
        });
        expect(screen.getByText("Milestone: none → v1.0")).toBeTruthy();
        unmount();
        renderCard("update_task", { task_id: "WRD-5", milestone_id: null, priority: "High" });
        expect(screen.queryByText(/Milestone:/)).toBeNull();
    });

    it("still shows the target when the event has no current snapshot", () => {
        renderCard("update_task", { task_id: "WRD-5", milestone_id: "v2.0" });
        expect(screen.getByText("Milestone: v2.0")).toBeTruthy();
    });

    it("shows a parent change as old → new, by display id", () => {
        renderCard("update_task", {
            task_id: "WRD-5",
            parent_task_id: "WRD-9",
            current: { parent_task_id: "WRD-2" },
        });
        expect(screen.getByText("Parent: WRD-2 → WRD-9")).toBeTruthy();
    });

    it("shows making a task top-level as the parent cleared", () => {
        renderCard("update_task", {
            task_id: "WRD-5",
            parent_task_id: "",
            current: { parent_task_id: "WRD-2" },
        });
        expect(screen.getByText("Parent: WRD-2 → none")).toBeTruthy();
    });

    it("shows a task given a first parent as coming from none", () => {
        renderCard("update_task", {
            task_id: "WRD-5",
            parent_task_id: "WRD-9",
            current: { parent_task_id: null },
        });
        expect(screen.getByText("Parent: none → WRD-9")).toBeTruthy();
    });

    it("shows a project move as old → new, by project name", () => {
        renderCard("update_task", {
            task_id: "WRD-5",
            project_id: "Other",
            current: { project_id: "Website Redesign" },
        });
        expect(screen.getByText("Project: Website Redesign → Other")).toBeTruthy();
    });

    it("shows a parent and a project change side by side, and none for a null", () => {
        const { unmount } = renderCard("update_task", {
            task_id: "WRD-5",
            parent_task_id: "",
            project_id: "Other",
            current: { parent_task_id: "WRD-2", project_id: "Website Redesign" },
        });
        expect(screen.getByText("Parent: WRD-2 → none")).toBeTruthy();
        expect(screen.getByText("Project: Website Redesign → Other")).toBeTruthy();
        unmount();
        renderCard("update_task", {
            task_id: "WRD-5",
            parent_task_id: null,
            project_id: null,
            priority: "High",
        });
        expect(screen.queryByText(/Parent:/)).toBeNull();
        expect(screen.queryByText(/Project:/)).toBeNull();
    });
    it("shows a start-date change as old → new, a clear, and none for a null", () => {
        const { unmount } = renderCard("update_task", {
            task_id: "WRD-5",
            start_date: "2026-11-05",
            current: { start_date: "2026-11-01" },
        });
        expect(screen.getByText("Start: 2026-11-01 → 2026-11-05")).toBeTruthy();
        unmount();
        const second = renderCard("update_task", {
            task_id: "WRD-5",
            start_date: "",
            current: { start_date: "2026-11-01" },
        });
        expect(screen.getByText("Start: 2026-11-01 → none")).toBeTruthy();
        second.unmount();
        renderCard("update_task", { task_id: "WRD-5", start_date: null, priority: "High" });
        expect(screen.queryByText(/Start:/)).toBeNull();
    });

    it("shows the reporter as old → new, by name", () => {
        renderCard("update_task", {
            task_id: "WRD-5",
            reporter_id: "carol",
            current: { reporter_id: "alice" },
        });
        expect(screen.getByText("Reporter: alice → carol")).toBeTruthy();
    });

    it("shows the links it replaces as old → new titles, and an empty list as cleared", () => {
        const { unmount } = renderCard("update_task", {
            task_id: "WRD-5",
            links: [{ url: "https://example.com/new", title: "New spec" }],
            current: { links: [{ url: "https://example.com/old", title: "Old spec" }] },
        });
        expect(screen.getByText("Links: Old spec → New spec")).toBeTruthy();
        expect(screen.getByText("New spec · https://example.com/new")).toBeTruthy();
        unmount();
        renderCard("update_task", {
            task_id: "WRD-5",
            links: [],
            current: { links: [{ url: "https://example.com/old", title: "Old spec" }] },
        });
        expect(screen.getByText("Links: Old spec → none")).toBeTruthy();
    });

    it("shows collaborators as old → new, and an empty list as cleared", () => {
        const { unmount } = renderCard("update_task", {
            task_id: "WRD-5",
            collaborators: ["alice", "bob"],
            current: { collaborators: ["alice"] },
        });
        expect(screen.getByText("Collaborators: alice → alice, bob")).toBeTruthy();
        unmount();
        renderCard("update_task", {
            task_id: "WRD-5",
            collaborators: [],
            current: { collaborators: ["alice", "bob"] },
        });
        expect(screen.getByText("Collaborators: alice, bob → none")).toBeTruthy();
    });

    it("pairs each custom field with its present value by name", () => {
        renderCard("update_task", {
            task_id: "WRD-5",
            custom_fields: [
                { name: "Estimate", value: 5 },
                { name: "Platforms", values: ["ios", "web"] },
                { name: "Owner team", value: "" },
                { name: "Risk", value: "High" },
            ],
            current: {
                custom_fields: {
                    Estimate: 3,
                    Platforms: ["ios"],
                    "Owner team": "Platform",
                    Risk: null,
                },
            },
        });
        expect(screen.getByText("Estimate: 3 → 5")).toBeTruthy();
        expect(screen.getByText("Platforms: ios → ios, web")).toBeTruthy();
        expect(screen.getByText("Owner team: Platform → none")).toBeTruthy();
        // A field with no value yet reads as coming from none.
        expect(screen.getByText("Risk: none → High")).toBeTruthy();
    });

    it("shows a custom field's new value alone when the event has no snapshot", () => {
        renderCard("update_task", {
            task_id: "WRD-5",
            custom_fields: [{ name: "Estimate", value: 5 }],
        });
        expect(screen.getByText("Estimate: 5")).toBeTruthy();
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

describe("Comment previews (update_comment / delete_comment approvals)", () => {
    it("says an update replaces one of your comments, and shows the whole new text", () => {
        renderCard("update_comment", {
            task_id: "WRD-5",
            comment_id: 3,
            body_text: "Confirmed on staging.\nClosing after the PR merges.",
        });
        expect(screen.getByText("Replace your comment #3 on WRD-5")).toBeTruthy();
        expect(screen.getByText(/Confirmed on staging\./)).toBeTruthy();
        expect(screen.getByText(/Closing after the PR merges\./)).toBeTruthy();
        // Structured: the raw key:value fallback must NOT render.
        expect(screen.queryByText("body_text:")).toBeNull();
        expect(screen.queryByText("comment_id:")).toBeNull();
    });

    it("still names the comment when the new text is empty", () => {
        renderCard("update_comment", { task_id: "WRD-5", comment_id: 3 });
        expect(screen.getByText("Replace your comment #3 on WRD-5")).toBeTruthy();
    });

    it("says a delete is of your own comment, on which task, and can't be undone", () => {
        renderCard("delete_comment", { task_id: "WRD-5", comment_id: 3 });
        expect(screen.getByText("Delete your comment #3 on WRD-5")).toBeTruthy();
        expect(screen.getByText("This action cannot be undone")).toBeTruthy();
        expect(screen.queryByText("task_id:")).toBeNull();
        expect(screen.queryByText("comment_id:")).toBeNull();
    });

    it("names the task by its friendly name when that is what arrives", () => {
        renderCard("delete_comment", { task_id: "Ship the public API", comment_id: "12" });
        expect(screen.getByText("Delete your comment #12 on Ship the public API")).toBeTruthy();
    });
});

describe("RestoreTaskBodyPreview (restore_task_body approval)", () => {
    it("says the description is replaced by an earlier version, which entry, and that it can be undone", () => {
        renderCard("restore_task_body", { task_id: "WRD-5", activity_id: 481 });
        expect(screen.getByText("Restore the previous description of WRD-5")).toBeTruthy();
        expect(screen.getByText("History entry #481")).toBeTruthy();
        expect(
            screen.getByText(
                "This replaces the description as it is now with the one it had before this edit. You can undo it: the description you replace is kept in this history too."
            )
        ).toBeTruthy();
        expect(screen.queryByText("activity_id:")).toBeNull();
        expect(screen.queryByText("task_id:")).toBeNull();
    });

    it("leaves the entry chip off when the event carries no activity_id", () => {
        renderCard("restore_task_body", { task_id: "WRD-5" });
        expect(screen.getByText("Restore the previous description of WRD-5")).toBeTruthy();
        expect(screen.queryByText(/History entry/)).toBeNull();
    });
});

describe("Todo previews (update / create / delete_todo_item approvals)", () => {
    it("shows the day and the reminder as old → new, with the zone it is read in", () => {
        renderCard("update_todo_item", {
            // Friendly-ized server-side to the to-do's title.
            item_id: "Call Sam",
            target_date: "2026-11-06",
            remind_at: "2026-11-06T09:00",
            time_zone: "Asia/Tokyo",
            current: { target_date: "2026-11-05", reminder_at: "2026-11-05T09:00:00+09:00" },
        });
        expect(screen.getByText("Update to-do: Call Sam")).toBeTruthy();
        expect(screen.getByText("Day: 2026-11-05 → 2026-11-06")).toBeTruthy();
        expect(
            screen.getByText("Reminder: 2026-11-05 09:00 → 2026-11-06 09:00 (Asia/Tokyo)")
        ).toBeTruthy();
        // Structured — the raw key:value fallback must NOT render.
        expect(screen.queryByText("item_id:")).toBeNull();
    });

    it("reads a relative reminder in minutes, coming from none", () => {
        renderCard("update_todo_item", {
            item_id: "Call Sam",
            remind_in_minutes: 30,
            current: { target_date: "2026-11-05", reminder_at: null },
        });
        expect(screen.getByText("Reminder: none → in 30 min")).toBeTruthy();
        // The day is not being changed, so it gets no chip.
        expect(screen.queryByText(/Day:/)).toBeNull();
    });

    it("shows cancelling a reminder as cleared, with the old time", () => {
        renderCard("update_todo_item", {
            item_id: "Call Sam",
            cancel_reminder: true,
            current: { reminder_at: "2026-11-05T09:00:00+09:00" },
        });
        expect(screen.getByText("Reminder: 2026-11-05 09:00 → none")).toBeTruthy();
    });

    it("shows done / reopen and the category, and no day for an empty target_date", () => {
        const { unmount } = renderCard("update_todo_item", {
            item_id: "Call Sam",
            is_completed: true,
            category: "Work",
            // '' is "no move" to the tool: a to-do's day can't be cleared.
            target_date: "",
        });
        expect(screen.getByText("Mark done")).toBeTruthy();
        expect(screen.getByText("Category: Work")).toBeTruthy();
        expect(screen.queryByText(/Day:/)).toBeNull();
        unmount();
        renderCard("update_todo_item", { item_id: "Call Sam", is_completed: false });
        expect(screen.getByText("Reopen")).toBeTruthy();
        expect(screen.queryByText("Mark done")).toBeNull();
    });

    it("shows a new to-do with its day and the reminder it will carry", () => {
        renderCard("create_todo_item", {
            title: "Send the invoice",
            target_date: "2026-11-06",
            remind_in_minutes: 45,
            notes_text: "Use the November template.",
        });
        expect(screen.getByText("New to-do")).toBeTruthy();
        expect(screen.getByText("Send the invoice")).toBeTruthy();
        expect(screen.getByText("Day: 2026-11-06")).toBeTruthy();
        expect(screen.getByText("Reminder: in 45 min")).toBeTruthy();
        expect(screen.getByText("Use the November template.")).toBeTruthy();
    });

    it("gives a new to-do no reminder chip when none is proposed", () => {
        renderCard("create_todo_item", { title: "Send the invoice" });
        expect(screen.queryByText(/Reminder:/)).toBeNull();
        expect(screen.queryByText(/Day:/)).toBeNull();
    });

    it("says what a delete takes with it", () => {
        renderCard("delete_todo_item", {
            item_id: "Call Sam",
            current: {
                target_date: "2026-11-05",
                reminder_at: "2026-11-05T09:00:00+09:00",
                sub_items: 2,
            },
        });
        expect(screen.getByText("Delete to-do: Call Sam")).toBeTruthy();
        expect(screen.getByText("Day: 2026-11-05")).toBeTruthy();
        expect(screen.getByText("also deletes 2 sub-item(s)")).toBeTruthy();
        expect(screen.getByText("its reminder is dropped")).toBeTruthy();
    });

    it("shows a bare delete when the event has no snapshot", () => {
        renderCard("delete_todo_item", { item_id: "Call Sam" });
        expect(screen.getByText("Delete to-do: Call Sam")).toBeTruthy();
        expect(screen.queryByText(/sub-item/)).toBeNull();
        expect(screen.queryByText("its reminder is dropped")).toBeNull();
    });
});

describe("Milestone previews (manage_milestone / delete_milestone approvals)", () => {
    it("renders a new milestone with its project, fields and markdown body", () => {
        renderCard("manage_milestone", {
            action: "create",
            project_id: "Website Redesign",
            title: "Beta launch",
            status: "Open",
            due_date: "2026-12-01",
            tags: ["launch"],
            assignee_ids: ["alice", "bob"],
            description_markdown: "Ship to the first ten customers.",
        });
        expect(screen.getByText("New milestone")).toBeTruthy();
        expect(screen.getByText("Project: Website Redesign")).toBeTruthy();
        expect(screen.getByText("Beta launch")).toBeTruthy();
        expect(screen.getByText("Status: Open")).toBeTruthy();
        expect(screen.getByText("Due: 2026-12-01")).toBeTruthy();
        expect(screen.getByText("Tags: launch")).toBeTruthy();
        expect(screen.getByText("Assignees: alice, bob")).toBeTruthy();
        expect(screen.getByText("Ship to the first ten customers.")).toBeTruthy();
        expect(screen.queryByText("action:")).toBeNull();
    });

    it("shows an update as old → new, with the title change and cleared fields", () => {
        renderCard("manage_milestone", {
            action: "update",
            milestone_id: "v1.0",
            title: "v1.0 (final)",
            status: "Closed",
            due_date: "",
            tags: [],
            milestone_folder_id: "Releases",
            sprint_id: "",
            current: {
                title: "v1.0",
                status: "Open",
                due_date: "2026-12-01",
                tags: ["launch"],
                milestone_folder_id: null,
                sprint_id: "Sprint 12",
            },
        });
        expect(screen.getByText("Update milestone: v1.0")).toBeTruthy();
        expect(screen.getByText("Status: Open → Closed")).toBeTruthy();
        expect(screen.getByText("Due: 2026-12-01 → none")).toBeTruthy();
        expect(screen.getByText("Tags: launch → none")).toBeTruthy();
        expect(screen.getByText("Folder: none → Releases")).toBeTruthy();
        expect(screen.getByText("Sprint: Sprint 12 → none")).toBeTruthy();
        // The old title is struck through, in its own span, next to the new one.
        const oldTitle = screen.getByText("v1.0");
        expect(oldTitle.tagName).toBe("SPAN");
        expect(oldTitle.parentElement?.textContent).toBe("v1.0 → v1.0 (final)");
    });

    it("prints a title alone when it did not change", () => {
        renderCard("manage_milestone", {
            action: "update",
            milestone_id: "v1.0",
            title: "v1.0",
            current: { title: "v1.0" },
        });
        expect(screen.queryByText(/→/)).toBeNull();
    });

    it("shows only the fields an update proposes", () => {
        renderCard("manage_milestone", {
            action: "update",
            milestone_id: "v1.0",
            status: "Closed",
            due_date: null,
            tags: null,
        });
        expect(screen.getByText("Status: Closed")).toBeTruthy();
        expect(screen.queryByText(/Due:/)).toBeNull();
        expect(screen.queryByText(/Tags:/)).toBeNull();
    });

    it("renders the three folder actions", () => {
        const first = renderCard("manage_milestone", {
            action: "create_folder",
            project_id: "Website Redesign",
            folder_name: "Releases",
        });
        expect(screen.getByText("New milestone folder")).toBeTruthy();
        expect(screen.getByText("Folder: Releases")).toBeTruthy();
        first.unmount();

        const second = renderCard("manage_milestone", {
            action: "rename_folder",
            milestone_folder_id: "Releases",
            folder_name: "Launches",
            current: { folder_name: "Releases" },
        });
        expect(screen.getByText("Rename milestone folder")).toBeTruthy();
        expect(screen.getByText("Folder: Releases → Launches")).toBeTruthy();
        second.unmount();

        renderCard("manage_milestone", {
            action: "delete_folder",
            milestone_folder_id: "Launches",
            current: { folder_name: "Launches", milestones: 3 },
        });
        expect(screen.getByText("Delete milestone folder")).toBeTruthy();
        expect(screen.getByText("Folder: Launches")).toBeTruthy();
        expect(screen.getByText("3 milestone(s) leave the folder")).toBeTruthy();
    });

    it("falls back to the raw folder id for a folder the caller can't name", () => {
        renderCard("manage_milestone", { action: "delete_folder", milestone_folder_id: "17" });
        expect(screen.getByText("Folder: 17")).toBeTruthy();
        expect(screen.queryByText(/leave the folder/)).toBeNull();
    });

    it("says a milestone delete keeps its tasks", () => {
        renderCard("delete_milestone", {
            milestone_id: "v1.0",
            current: { title: "v1.0 launch", tasks: 4 },
        });
        expect(screen.getByText("Delete milestone: v1.0 launch")).toBeTruthy();
        expect(
            screen.getByText("4 task(s) stay in the project, outside any milestone")
        ).toBeTruthy();
    });

    it("names the milestone by its id when the event has no snapshot", () => {
        renderCard("delete_milestone", { milestone_id: "v1.0" });
        expect(screen.getByText("Delete milestone: v1.0")).toBeTruthy();
        expect(screen.queryByText(/stay in the project/)).toBeNull();
    });
});

describe("Sprint previews (manage_sprint / delete_sprint approvals)", () => {
    it("renders a new sprint with its name, project and dates", () => {
        renderCard("manage_sprint", {
            action: "create",
            project_id: "Website Redesign",
            name: "Sprint 13",
            start_date: "2026-11-09",
            end_date: "2026-11-20",
        });
        expect(screen.getByText("New sprint")).toBeTruthy();
        expect(screen.getByText("Sprint 13")).toBeTruthy();
        expect(screen.getByText("Project: Website Redesign")).toBeTruthy();
        expect(screen.getByText("Start: 2026-11-09")).toBeTruthy();
        expect(screen.getByText("End: 2026-11-20")).toBeTruthy();
        // Structured: the raw key:value fallback must NOT render.
        expect(screen.queryByText("action:")).toBeNull();
        expect(screen.queryByText("project_id:")).toBeNull();
        expect(screen.queryByText("start_date:")).toBeNull();
    });

    it("reads ending a sprint today as an end-date change and lists nothing else", () => {
        renderCard("manage_sprint", {
            action: "update",
            sprint_id: "Sprint 12",
            end_date: "2026-11-02",
        });
        expect(screen.getByText("Update sprint: Sprint 12")).toBeTruthy();
        expect(screen.getByText("End: 2026-11-02")).toBeTruthy();
        expect(screen.queryByText(/^Name:/)).toBeNull();
        expect(screen.queryByText(/^Start:/)).toBeNull();
        expect(screen.queryByText(/^Project:/)).toBeNull();
        expect(screen.queryByText("end_date:")).toBeNull();
    });

    it("lists a rename on its own, and every field when all three change", () => {
        const { unmount } = renderCard("manage_sprint", {
            action: "update",
            sprint_id: "Sprint 12",
            name: "Sprint 12 (extended)",
        });
        expect(screen.getByText("Name: Sprint 12 (extended)")).toBeTruthy();
        expect(screen.queryByText(/^Start:/)).toBeNull();
        expect(screen.queryByText(/^End:/)).toBeNull();
        unmount();

        renderCard("manage_sprint", {
            action: "update",
            sprint_id: "Sprint 12",
            name: "Sprint 12b",
            start_date: "2026-11-03",
            end_date: "2026-11-17",
        });
        expect(screen.getByText("Name: Sprint 12b")).toBeTruthy();
        expect(screen.getByText("Start: 2026-11-03")).toBeTruthy();
        expect(screen.getByText("End: 2026-11-17")).toBeTruthy();
    });

    it("does not show the project on an update, and names the sprint by its id when it can't be named", () => {
        renderCard("manage_sprint", {
            action: "update",
            sprint_id: "42",
            project_id: "Website Redesign",
            start_date: "2026-11-03",
        });
        expect(screen.getByText("Update sprint: 42")).toBeTruthy();
        expect(screen.queryByText(/^Project:/)).toBeNull();
    });

    it("says a delete is of that sprint, can't be undone, and keeps its milestones and tasks", () => {
        renderCard("delete_sprint", { sprint_id: "Sprint 12" });
        expect(screen.getByText("Delete sprint: Sprint 12")).toBeTruthy();
        expect(screen.getByText("This action cannot be undone")).toBeTruthy();
        expect(
            screen.getByText(
                "Its milestones and their tasks are kept. They just no longer belong to a sprint."
            )
        ).toBeTruthy();
        expect(screen.queryByText("sprint_id:")).toBeNull();
    });

    it("names the sprint by its id when the caller may not read its name", () => {
        renderCard("delete_sprint", { sprint_id: 42 });
        expect(screen.getByText("Delete sprint: 42")).toBeTruthy();
    });
});

describe("Project previews (manage_project / manage_project_members approvals)", () => {
    it("renders a new private project with its name, visibility and the people added", () => {
        renderCard("manage_project", {
            action: "create",
            name: "Website Redesign",
            is_private: true,
            member_ids: ["alice", "bob"],
        });
        expect(screen.getByText("New project")).toBeTruthy();
        expect(screen.getByText("Website Redesign")).toBeTruthy();
        expect(screen.getByText("Private")).toBeTruthy();
        expect(screen.queryByText("Public")).toBeNull();
        expect(screen.getByText("Adding 2 people: alice, bob")).toBeTruthy();
        // Structured: the raw key:value fallback must NOT render.
        expect(screen.queryByText("action:")).toBeNull();
        expect(screen.queryByText("is_private:")).toBeNull();
        expect(screen.queryByText("member_ids:")).toBeNull();
    });

    it("renders a public project, and shows a lone person in the singular", () => {
        renderCard("manage_project", {
            action: "create",
            name: "Open Roadmap",
            is_private: false,
            member_ids: ["alice"],
        });
        expect(screen.getByText("Public")).toBeTruthy();
        expect(screen.queryByText("Private")).toBeNull();
        expect(screen.getByText("Adding 1 person: alice")).toBeTruthy();
    });

    it("shows a count plus whatever arrives when names and raw ids are mixed", () => {
        renderCard("manage_project", {
            action: "create",
            name: "Mixed",
            is_private: true,
            member_ids: ["alice", "c54505c5-d24a-4f1a-bf23-ddd135645b88", 42],
        });
        expect(
            screen.getByText("Adding 3 people: alice, c54505c5-d24a-4f1a-bf23-ddd135645b88, 42")
        ).toBeTruthy();
    });

    it("reads a create with no is_private as Public, the API's default, and lists no people", () => {
        renderCard("manage_project", { action: "create", name: "Solo" });
        expect(screen.getByText("Solo")).toBeTruthy();
        expect(screen.getByText("Public")).toBeTruthy();
        expect(screen.queryByText("Private")).toBeNull();
        expect(screen.queryByText(/^Adding/)).toBeNull();
        expect(screen.queryByText("none")).toBeNull();
    });

    it('reads is_private sent as the string "true" or "false" the same as a boolean', () => {
        const { unmount } = renderCard("manage_project", {
            action: "create",
            name: "Stringly",
            is_private: "true",
        });
        expect(screen.getByText("Private")).toBeTruthy();
        expect(screen.queryByText("Public")).toBeNull();
        unmount();

        renderCard("manage_project", {
            action: "create",
            name: "Stringly",
            is_private: "false",
        });
        expect(screen.getByText("Public")).toBeTruthy();
        expect(screen.queryByText("Private")).toBeNull();
    });

    it("reads a null is_private as Public", () => {
        renderCard("manage_project", { action: "create", name: "Nully", is_private: null });
        expect(screen.getByText("Public")).toBeTruthy();
        expect(screen.queryByText("Private")).toBeNull();
    });

    it("does not list people when the list is empty", () => {
        renderCard("manage_project", {
            action: "create",
            name: "Solo",
            is_private: true,
            member_ids: [],
        });
        expect(screen.queryByText(/^Adding/)).toBeNull();
        expect(screen.queryByText("none")).toBeNull();
    });

    it("lists a rename on its own and nothing else", () => {
        renderCard("manage_project", {
            action: "update",
            project_id: "Website Redesign",
            name: "Website Relaunch",
        });
        expect(screen.getByText("Update project: Website Redesign")).toBeTruthy();
        expect(screen.getByText("Name: Website Relaunch")).toBeTruthy();
        expect(screen.queryByText(/^Code:/)).toBeNull();
        expect(screen.queryByText("The code is the prefix of the project's task ids.")).toBeNull();
        expect(screen.queryByText("project_id:")).toBeNull();
    });

    it("lists a code change on its own, with what the code is", () => {
        renderCard("manage_project", {
            action: "update",
            project_id: "Website Redesign",
            code: "WEB",
        });
        expect(screen.getByText("Code: WEB")).toBeTruthy();
        expect(screen.queryByText(/^Name:/)).toBeNull();
        expect(screen.getByText("The code is the prefix of the project's task ids.")).toBeTruthy();
    });

    it("lists both fields when both change, and names the project by its id when it can't be named", () => {
        renderCard("manage_project", {
            action: "update",
            project_id: "7",
            name: "Website Relaunch",
            code: "WEB",
        });
        expect(screen.getByText("Update project: 7")).toBeTruthy();
        expect(screen.getByText("Name: Website Relaunch")).toBeTruthy();
        expect(screen.getByText("Code: WEB")).toBeTruthy();
    });

    it("shows no visibility, people or new-project heading on an update", () => {
        renderCard("manage_project", {
            action: "update",
            project_id: "Website Redesign",
            code: "WEB",
            is_private: true,
            member_ids: ["alice"],
        });
        expect(screen.queryByText("Private")).toBeNull();
        expect(screen.queryByText(/^Adding/)).toBeNull();
        expect(screen.queryByText("New project")).toBeNull();
    });

    it("reads adding a person as adding them to the project, and says they get its chat", () => {
        renderCard("manage_project_members", {
            action: "add",
            project_id: "Website Redesign",
            user_id: "alice",
        });
        expect(screen.getByText("Add alice to Website Redesign")).toBeTruthy();
        expect(screen.getByText("They also get the project's chat.")).toBeTruthy();
        expect(screen.queryByText("user_id:")).toBeNull();
        expect(screen.queryByText("project_id:")).toBeNull();
    });

    it("names the person by their id when the caller may not see them", () => {
        renderCard("manage_project_members", {
            action: "add",
            project_id: "Website Redesign",
            user_id: "c54505c5-d24a-4f1a-bf23-ddd135645b88",
        });
        expect(
            screen.getByText("Add c54505c5-d24a-4f1a-bf23-ddd135645b88 to Website Redesign")
        ).toBeTruthy();
    });

    it("reads a role change to editor and to viewer, without the chat line", () => {
        const { unmount } = renderCard("manage_project_members", {
            action: "set_role",
            project_id: "Website Redesign",
            user_id: "alice",
            role: "editor",
        });
        expect(screen.getByText("Make alice an editor of Website Redesign")).toBeTruthy();
        expect(screen.queryByText("They also get the project's chat.")).toBeNull();
        expect(screen.queryByText("role:")).toBeNull();
        unmount();

        renderCard("manage_project_members", {
            action: "set_role",
            project_id: "Website Redesign",
            user_id: "alice",
            role: "viewer",
        });
        expect(screen.getByText("Make alice a viewer of Website Redesign")).toBeTruthy();
        expect(screen.queryByText("They also get the project's chat.")).toBeNull();
    });

    it("does not read a role it does not know as an editor or a viewer", () => {
        renderCard("manage_project_members", {
            action: "set_role",
            project_id: "Website Redesign",
            user_id: "alice",
            role: "owner",
        });
        expect(screen.getByText("Change alice's role in Website Redesign")).toBeTruthy();
        expect(screen.getByText("owner")).toBeTruthy();
        expect(screen.queryByText(/an editor of/)).toBeNull();
        expect(screen.queryByText(/a viewer of/)).toBeNull();
    });
});

describe("Note folder previews (manage_note_folder / favorite_note approvals)", () => {
    const PRIVATE_LINE = "Private to you until you share it from the app.";

    it("renders a top-level folder in My Notes, with no private line", () => {
        renderCard("manage_note_folder", {
            action: "create",
            name: "Research",
            space: "personal",
        });
        expect(screen.getByText("Create folder Research")).toBeTruthy();
        expect(screen.getByText("My Notes")).toBeTruthy();
        expect(screen.queryByText("Team Notes")).toBeNull();
        expect(screen.queryByText(/^Inside /)).toBeNull();
        expect(screen.queryByText(PRIVATE_LINE)).toBeNull();
        // Structured: the raw key:value fallback must NOT render.
        expect(screen.queryByText("action:")).toBeNull();
        expect(screen.queryByText("space:")).toBeNull();
        expect(screen.queryByText("name:")).toBeNull();
    });

    it("reads a create with no space and no parent as My Notes, the API's default", () => {
        renderCard("manage_note_folder", { action: "create", name: "Ideas" });
        expect(screen.getByText("Create folder Ideas")).toBeTruthy();
        expect(screen.getByText("My Notes")).toBeTruthy();
        expect(screen.queryByText(PRIVATE_LINE)).toBeNull();
    });

    it("renders a top-level Team Notes folder and says it stays private until shared", () => {
        renderCard("manage_note_folder", {
            action: "create",
            name: "Handbook",
            space: "team",
        });
        expect(screen.getByText("Create folder Handbook")).toBeTruthy();
        expect(screen.getByText("Team Notes")).toBeTruthy();
        expect(screen.queryByText("My Notes")).toBeNull();
        expect(screen.getByText(PRIVATE_LINE)).toBeTruthy();
    });

    it("reads space case-insensitively, so a stray capital does not hide the private line", () => {
        renderCard("manage_note_folder", { action: "create", name: "Handbook", space: " Team " });
        expect(screen.getByText("Team Notes")).toBeTruthy();
        expect(screen.getByText(PRIVATE_LINE)).toBeTruthy();
    });

    it("names the parent a folder goes inside, in My Notes", () => {
        renderCard("manage_note_folder", {
            action: "create",
            name: "2026",
            space: "personal",
            parent_folder_id: "Research",
        });
        expect(screen.getByText("Create folder 2026")).toBeTruthy();
        expect(screen.getByText("My Notes")).toBeTruthy();
        expect(screen.getByText("Inside Research")).toBeTruthy();
    });

    it("does not claim My Notes when there is a parent and no space", () => {
        renderCard("manage_note_folder", {
            action: "create",
            name: "2026",
            parent_folder_id: "Research",
        });
        expect(screen.getByText("Create folder 2026")).toBeTruthy();
        expect(screen.getByText("Inside Research")).toBeTruthy();
        expect(screen.queryByText("My Notes")).toBeNull();
        expect(screen.queryByText("Team Notes")).toBeNull();
        expect(screen.queryByText(PRIVATE_LINE)).toBeNull();
    });

    it("has no private line for a Team Notes folder inside a parent", () => {
        renderCard("manage_note_folder", {
            action: "create",
            name: "Onboarding",
            space: "team",
            parent_folder_id: "Handbook",
        });
        expect(screen.getByText("Team Notes")).toBeTruthy();
        expect(screen.getByText("Inside Handbook")).toBeTruthy();
        expect(screen.queryByText(PRIVATE_LINE)).toBeNull();
    });

    it("names the parent by its id when the caller may not see its name", () => {
        renderCard("manage_note_folder", {
            action: "create",
            name: "Archive",
            parent_folder_id: "17",
        });
        expect(screen.getByText("Inside 17")).toBeTruthy();
    });

    it("does not read a space it does not know as My Notes or Team Notes", () => {
        renderCard("manage_note_folder", { action: "create", name: "Odd", space: "shared" });
        expect(screen.getByText("shared")).toBeTruthy();
        expect(screen.queryByText("My Notes")).toBeNull();
        expect(screen.queryByText("Team Notes")).toBeNull();
        expect(screen.queryByText(PRIVATE_LINE)).toBeNull();
    });

    it("reads a rename as the current name to the new one, with no where-chips or private line", () => {
        renderCard("manage_note_folder", {
            action: "rename",
            folder_id: "Research",
            name: "User research",
            // A rename never moves a folder, so these are not shown even if sent.
            space: "team",
        });
        expect(screen.getByText("Rename folder Research to User research")).toBeTruthy();
        expect(screen.queryByText(/^Create folder/)).toBeNull();
        expect(screen.queryByText("Team Notes")).toBeNull();
        expect(screen.queryByText(PRIVATE_LINE)).toBeNull();
        expect(screen.queryByText("folder_id:")).toBeNull();
    });

    it("names the folder to rename by its id when the caller may not see its name", () => {
        renderCard("manage_note_folder", {
            action: "rename",
            folder_id: "17",
            name: "Archive",
        });
        expect(screen.getByText("Rename folder 17 to Archive")).toBeTruthy();
    });

    it("stars a note by its title", () => {
        renderCard("favorite_note", {
            note_type: "personal",
            note_id: 42,
            note_title: "Spotlight tips",
            favorite: true,
        });
        expect(screen.getByText("Add Spotlight tips to favorites")).toBeTruthy();
        expect(screen.queryByText(/from favorites/)).toBeNull();
        // Neither the id nor the key:value fallback shows when the title is there.
        expect(screen.queryByText(/#42/)).toBeNull();
        expect(screen.queryByText("note_title:")).toBeNull();
        expect(screen.queryByText("favorite:")).toBeNull();
    });

    it("reads a missing favorite as a star", () => {
        renderCard("favorite_note", {
            note_type: "team",
            note_id: 9,
            note_title: "Onboarding",
        });
        expect(screen.getByText("Add Onboarding to favorites")).toBeTruthy();
    });

    it("stars a folder by its name", () => {
        renderCard("favorite_note", { folder_id: "Research", favorite: true });
        expect(screen.getByText("Add Research to favorites")).toBeTruthy();
    });

    it("takes a note's title over a folder name if both arrive", () => {
        renderCard("favorite_note", {
            folder_id: "Research",
            note_title: "Spotlight tips",
        });
        expect(screen.getByText("Add Spotlight tips to favorites")).toBeTruthy();
    });

    it("unstars a note and a folder", () => {
        const { unmount } = renderCard("favorite_note", {
            note_type: "personal",
            note_id: 42,
            note_title: "Spotlight tips",
            favorite: false,
        });
        expect(screen.getByText("Remove Spotlight tips from favorites")).toBeTruthy();
        expect(screen.queryByText(/^Add /)).toBeNull();
        unmount();

        renderCard("favorite_note", { folder_id: "Research", favorite: false });
        expect(screen.getByText("Remove Research from favorites")).toBeTruthy();
    });

    it('reads favorite sent as the string "false" as an unstar, and "true" as a star', () => {
        const { unmount } = renderCard("favorite_note", {
            folder_id: "Research",
            favorite: "false",
        });
        expect(screen.getByText("Remove Research from favorites")).toBeTruthy();
        unmount();

        renderCard("favorite_note", { folder_id: "Research", favorite: "true" });
        expect(screen.getByText("Add Research to favorites")).toBeTruthy();
    });

    it("falls back to the raw id of a note the caller can't read, then to a neutral word", () => {
        const { unmount } = renderCard("favorite_note", {
            note_type: "team",
            note_id: 9,
            favorite: true,
        });
        expect(screen.getByText("Add this note (#9) to favorites")).toBeTruthy();
        unmount();

        const second = renderCard("favorite_note", { note_type: "team", favorite: false });
        expect(screen.getByText("Remove this note from favorites")).toBeTruthy();
        second.unmount();

        renderCard("favorite_note", { favorite: true });
        expect(screen.getByText("Add this folder to favorites")).toBeTruthy();
    });
});

describe("Note delete and sharing previews (delete_note / delete_note_folder / manage_note_sharing approvals)", () => {
    const NOTE_WARNING = "Deletes the note and its version history for good.";
    const FOLDER_WARNING = "Also deletes every note and folder inside it, for good.";
    const ONLY_EMPTY = "Only goes ahead if the folder is empty.";
    const NOT_NOTIFIED = "They are not notified.";

    it("reads a note delete by its title, with the for-good warning", () => {
        renderCard("delete_note", {
            note_type: "personal",
            note_id: 42,
            note_title: "Spotlight tips",
        });
        expect(screen.getByText("Delete note Spotlight tips")).toBeTruthy();
        expect(screen.getByText(NOTE_WARNING)).toBeTruthy();
        // Structured: the raw key:value fallback must NOT render.
        expect(screen.queryByText("note_id:")).toBeNull();
        expect(screen.queryByText("note_type:")).toBeNull();
        expect(screen.queryByText(/#42/)).toBeNull();
    });

    it("names a note the caller can't read by its id, then by a neutral word", () => {
        const { unmount } = renderCard("delete_note", { note_type: "team", note_id: 9 });
        expect(screen.getByText("Delete this note (#9)")).toBeTruthy();
        expect(screen.getByText(NOTE_WARNING)).toBeTruthy();
        unmount();

        renderCard("delete_note", { note_type: "team" });
        expect(screen.getByText("Delete this note")).toBeTruthy();
        expect(screen.getByText(NOTE_WARNING)).toBeTruthy();
    });

    it("reads a folder delete by its name and says it only goes ahead if the folder is empty", () => {
        renderCard("delete_note_folder", { folder_id: "Research" });
        expect(screen.getByText("Delete folder Research")).toBeTruthy();
        expect(screen.getByText(ONLY_EMPTY)).toBeTruthy();
        expect(screen.queryByText(FOLDER_WARNING)).toBeNull();
        expect(screen.queryByText("folder_id:")).toBeNull();
    });

    it("warns that include_contents deletes everything inside, and drops the empty-only line", () => {
        renderCard("delete_note_folder", { folder_id: "Research", include_contents: true });
        expect(screen.getByText("Delete folder Research")).toBeTruthy();
        expect(screen.getByText(FOLDER_WARNING)).toBeTruthy();
        expect(screen.queryByText(ONLY_EMPTY)).toBeNull();
        expect(screen.queryByText("include_contents:")).toBeNull();
    });

    it("reads include_contents sent as a string, and anything but true as false", () => {
        const { unmount } = renderCard("delete_note_folder", {
            folder_id: "Research",
            include_contents: "true",
        });
        expect(screen.getByText(FOLDER_WARNING)).toBeTruthy();
        unmount();

        const second = renderCard("delete_note_folder", {
            folder_id: "Research",
            include_contents: "false",
        });
        expect(screen.getByText(ONLY_EMPTY)).toBeTruthy();
        expect(screen.queryByText(FOLDER_WARNING)).toBeNull();
        second.unmount();

        renderCard("delete_note_folder", { folder_id: "Research", include_contents: null });
        expect(screen.getByText(ONLY_EMPTY)).toBeTruthy();
    });

    it("names a folder the caller can't see by its id, then by a neutral word", () => {
        const { unmount } = renderCard("delete_note_folder", { folder_id: "17" });
        expect(screen.getByText("Delete folder 17")).toBeTruthy();
        unmount();

        renderCard("delete_note_folder", {});
        expect(screen.getByText("Delete this folder")).toBeTruthy();
    });

    it("reads a share as an editor, and says the person is not notified", () => {
        renderCard("manage_note_sharing", {
            action: "share",
            note_type: "personal",
            note_id: 42,
            note_title: "Spotlight tips",
            user_id: "alice",
            role: "editor",
        });
        expect(screen.getByText("Share Spotlight tips with alice as an editor")).toBeTruthy();
        expect(screen.getByText(NOT_NOTIFIED)).toBeTruthy();
        expect(screen.queryByText("user_id:")).toBeNull();
        expect(screen.queryByText("role:")).toBeNull();
        expect(screen.queryByText("action:")).toBeNull();
    });

    it("reads a share as a viewer", () => {
        renderCard("manage_note_sharing", {
            action: "share",
            note_type: "personal",
            note_id: 42,
            note_title: "Spotlight tips",
            user_id: "alice",
            role: "viewer",
        });
        expect(screen.getByText("Share Spotlight tips with alice as a viewer")).toBeTruthy();
        expect(screen.getByText(NOT_NOTIFIED)).toBeTruthy();
    });

    it("does not read a role it does not know as an editor or a viewer", () => {
        renderCard("manage_note_sharing", {
            action: "share",
            note_type: "personal",
            note_id: 42,
            note_title: "Spotlight tips",
            user_id: "alice",
            role: "owner",
        });
        expect(screen.getByText("Share Spotlight tips with alice")).toBeTruthy();
        expect(screen.getByText("owner")).toBeTruthy();
        expect(screen.queryByText(/as an editor/)).toBeNull();
        expect(screen.queryByText(/as a viewer/)).toBeNull();
    });

    it("reads an unshare without a role and without the not-notified line", () => {
        renderCard("manage_note_sharing", {
            action: "unshare",
            note_type: "personal",
            note_id: 42,
            note_title: "Spotlight tips",
            user_id: "alice",
            // An unshare has no role, so one that is sent is not shown.
            role: "editor",
        });
        expect(screen.getByText("Stop sharing Spotlight tips with alice")).toBeTruthy();
        expect(screen.queryByText(NOT_NOTIFIED)).toBeNull();
        expect(screen.queryByText(/^Share /)).toBeNull();
        expect(screen.queryByText("editor")).toBeNull();
    });

    it("names a note and a person the caller can't read by their ids", () => {
        const { unmount } = renderCard("manage_note_sharing", {
            action: "share",
            note_type: "team",
            note_id: 9,
            user_id: "c54505c5-d24a-4f1a-bf23-ddd135645b88",
            role: "viewer",
        });
        expect(
            screen.getByText(
                "Share this note (#9) with c54505c5-d24a-4f1a-bf23-ddd135645b88 as a viewer"
            )
        ).toBeTruthy();
        unmount();

        renderCard("manage_note_sharing", { action: "unshare", user_id: "alice" });
        expect(screen.getByText("Stop sharing this note with alice")).toBeTruthy();
    });

    it("falls back to a neutral word when the person is missing", () => {
        renderCard("manage_note_sharing", {
            action: "share",
            note_title: "Spotlight tips",
            role: "editor",
        });
        expect(
            screen.getByText("Share Spotlight tips with this person as an editor")
        ).toBeTruthy();
    });
});

describe("RestoreNoteVersionPreview (restore_note_version approval)", () => {
    const UNDOABLE = "What the note says now is kept as a version first, so this can be undone.";

    it("reads a restore by the note's title and the version number, and says it can be undone", () => {
        renderCard("restore_note_version", {
            note_type: "personal",
            note_id: 42,
            note_title: "Spotlight tips",
            version_no: 3,
        });
        expect(screen.getByText("Restore note Spotlight tips to version 3")).toBeTruthy();
        expect(screen.getByText(UNDOABLE)).toBeTruthy();
        // Structured: the raw key:value fallback must NOT render.
        expect(screen.queryByText("version_no:")).toBeNull();
        expect(screen.queryByText("note_id:")).toBeNull();
        expect(screen.queryByText(/#42/)).toBeNull();
    });

    it("is not styled as a delete: no for-good warning", () => {
        renderCard("restore_note_version", {
            note_type: "personal",
            note_id: 42,
            note_title: "Spotlight tips",
            version_no: 3,
        });
        expect(screen.queryByText(/for good/)).toBeNull();
        expect(screen.queryByText("This action cannot be undone")).toBeNull();
    });

    it("names a note the caller can't read by its id, then by a neutral word", () => {
        const { unmount } = renderCard("restore_note_version", {
            note_type: "team",
            note_id: 9,
            version_no: 2,
        });
        expect(screen.getByText("Restore this note (#9) to version 2")).toBeTruthy();
        expect(screen.getByText(UNDOABLE)).toBeTruthy();
        unmount();

        renderCard("restore_note_version", { note_type: "team", version_no: 2 });
        expect(screen.getByText("Restore this note to version 2")).toBeTruthy();
    });

    it("reads a missing version as an earlier one rather than printing a blank", () => {
        const { unmount } = renderCard("restore_note_version", {
            note_type: "personal",
            note_id: 42,
            note_title: "Spotlight tips",
        });
        expect(screen.getByText("Restore note Spotlight tips to an earlier version")).toBeTruthy();
        unmount();

        renderCard("restore_note_version", { note_type: "personal", note_id: 42 });
        expect(screen.getByText("Restore this note (#42) to an earlier version")).toBeTruthy();
    });
});

describe("Project tag and label previews (add_project_tag / manage_project_labels approvals)", () => {
    // The tag chip is neutral and carries the tag's color as a small DOT beside
    // the label (MIP-1122); the dot's background says which color it got.
    const GREY_RGB = "128, 128, 128";
    const BLUE_RGB = "59, 130, 246";
    const dotOf = (label: string) =>
        (
            screen
                .getByText(label)
                .parentElement!.querySelector('span[aria-hidden="true"]') as HTMLElement
        ).style.background;
    const REFUSED = (color: string) =>
        `“${color}” is not a hex color like #3b82f6, so it will be refused.`;
    const chipRoot = (label: string) => screen.getByText(label).closest(".MuiChip-root");

    it("renders a tag as the app's tag chip in its color, on the project", () => {
        renderCard("add_project_tag", {
            project_id: "Website Redesign",
            tag_name: "urgent",
            color: "#3b82f6",
        });
        expect(screen.getByText("Add tag")).toBeTruthy();
        expect(dotOf("urgent")).toContain(BLUE_RGB);
        expect(screen.getByText("on Website Redesign")).toBeTruthy();
        // Structured: the raw key:value fallback must NOT render.
        expect(screen.queryByText("tag_name:")).toBeNull();
        expect(screen.queryByText("color:")).toBeNull();
        expect(screen.queryByText(/is not a hex color/)).toBeNull();
    });

    it("draws a tag with no color in the tool's default grey", () => {
        renderCard("add_project_tag", { project_id: "Website Redesign", tag_name: "later" });
        expect(dotOf("later")).toContain(GREY_RGB);
        expect(screen.queryByText(/is not a hex color/)).toBeNull();
    });

    it("accepts an upper-case #RRGGBB, as the API does", () => {
        renderCard("add_project_tag", {
            project_id: "Website Redesign",
            tag_name: "urgent",
            color: "#3B82F6",
        });
        expect(dotOf("urgent")).toContain(BLUE_RGB);
        expect(screen.queryByText(/is not a hex color/)).toBeNull();
    });

    it.each(["blue", "#ABC", "3b82f6", "#3b82f6ff"])(
        "does not crash on the color %j: draws the default and says it will be refused",
        (color) => {
            renderCard("add_project_tag", {
                project_id: "Website Redesign",
                tag_name: "urgent",
                color,
            });
            expect(dotOf("urgent")).toContain(GREY_RGB);
            expect(screen.getByText(REFUSED(color))).toBeTruthy();
        }
    );

    it("does not crash on a color that is not a string", () => {
        renderCard("add_project_tag", {
            project_id: "Website Redesign",
            tag_name: "urgent",
            color: 255,
        });
        expect(dotOf("urgent")).toContain(GREY_RGB);
        expect(screen.getByText(REFUSED("255"))).toBeTruthy();
    });

    it("prints a project it could not name as the raw id", () => {
        renderCard("add_project_tag", { project_id: 42, tag_name: "urgent" });
        expect(screen.getByText("on 42")).toBeTruthy();
    });

    it("renders a new label as the project list's chip, with the whole-team line", () => {
        renderCard("manage_project_labels", {
            action: "create",
            project_id: "Website Redesign",
            name: "Client Work",
            color: "#0044c2",
        });
        expect(screen.getByText("New project label")).toBeTruthy();
        const chip = chipRoot("Client Work") as HTMLElement;
        expect(chip).toBeTruthy();
        // Solid fill, as in the sidebar; dark blue reads with white text.
        expect(getComputedStyle(chip).backgroundColor).toBe("rgb(0, 68, 194)");
        expect(getComputedStyle(chip).color).toBe("rgb(255, 255, 255)");
        expect(screen.getByText("Visible to the whole team.")).toBeTruthy();
        // A label is not a tag: it names no project here, and the raw args do not render.
        expect(screen.queryByText(/^Put labels on/)).toBeNull();
        expect(screen.queryByText("action:")).toBeNull();
        expect(screen.queryByText("project_id:")).toBeNull();
    });

    it("picks black text on a light label, by the picker's luminance rule", () => {
        renderCard("manage_project_labels", {
            action: "create",
            project_id: "Website Redesign",
            name: "Q3",
            color: "#ffd93b",
        });
        const chip = chipRoot("Q3") as HTMLElement;
        expect(getComputedStyle(chip).backgroundColor).toBe("rgb(255, 217, 59)");
        expect(getComputedStyle(chip).color).toBe("rgb(0, 0, 0)");
    });

    it("draws a label with no color in the tool's default purple with white text", () => {
        renderCard("manage_project_labels", {
            action: "create",
            project_id: "Website Redesign",
            name: "Internal",
        });
        const chip = chipRoot("Internal") as HTMLElement;
        expect(getComputedStyle(chip).backgroundColor).toBe("rgb(124, 58, 237)");
        expect(getComputedStyle(chip).color).toBe("rgb(255, 255, 255)");
        expect(screen.queryByText(/is not a hex color/)).toBeNull();
    });

    it("does not crash on a label color the API would refuse", () => {
        renderCard("manage_project_labels", {
            action: "create",
            project_id: "Website Redesign",
            name: "Internal",
            color: "purple",
        });
        expect(getComputedStyle(chipRoot("Internal") as HTMLElement).backgroundColor).toBe(
            "rgb(124, 58, 237)"
        );
        expect(screen.getByText(REFUSED("purple"))).toBeTruthy();
    });

    it("reads an assign as the label names and the project they go on", () => {
        renderCard("manage_project_labels", {
            action: "assign",
            project_id: "Website Redesign",
            label_ids: ["Client Work", "Q3"],
        });
        expect(screen.getByText("Put labels on Website Redesign")).toBeTruthy();
        expect(screen.getByText("Client Work")).toBeTruthy();
        expect(screen.getByText("Q3")).toBeTruthy();
        expect(screen.queryByText("Visible to the whole team.")).toBeNull();
        expect(screen.queryByText("label_ids:")).toBeNull();
    });

    it("reads an unassign as taking labels off, and prints an id it could not name", () => {
        renderCard("manage_project_labels", {
            action: "unassign",
            project_id: "Website Redesign",
            label_ids: ["Client Work", 7],
        });
        expect(screen.getByText("Take labels off Website Redesign")).toBeTruthy();
        expect(screen.getByText("Client Work")).toBeTruthy();
        expect(screen.getByText("7")).toBeTruthy();
    });

    it("falls back to a neutral heading for an action it does not know", () => {
        renderCard("manage_project_labels", {
            action: "rename",
            project_id: "Website Redesign",
            label_ids: ["Client Work"],
        });
        expect(screen.getByText("Change labels on Website Redesign")).toBeTruthy();
        expect(screen.queryByText(/^Put labels on/)).toBeNull();
        expect(screen.queryByText(/^Take labels off/)).toBeNull();
    });
});

describe("Join request previews (approve_join_request / decline_join_request approvals)", () => {
    const APPROVE_EFFECT =
        "They are added to the project and told. They can then see and edit it.";
    const DECLINE_EFFECT = "The request is closed and they are told it was declined.";

    it("says plainly that an approved person is added and can then see and edit the project", () => {
        renderCard("approve_join_request", { inbox_item_id: "Sam → Website Redesign" });
        expect(screen.getByText("Approve join request: Sam → Website Redesign")).toBeTruthy();
        expect(screen.getByText(APPROVE_EFFECT)).toBeTruthy();
        expect(screen.queryByText(DECLINE_EFFECT)).toBeNull();
        // Structured: the raw key:value fallback must NOT render.
        expect(screen.queryByText("inbox_item_id:")).toBeNull();
    });

    it("says a declined request is closed, and does not claim anyone is added", () => {
        renderCard("decline_join_request", { inbox_item_id: "Sam → Website Redesign" });
        expect(screen.getByText("Decline join request: Sam → Website Redesign")).toBeTruthy();
        expect(screen.getByText(DECLINE_EFFECT)).toBeTruthy();
        expect(screen.queryByText(APPROVE_EFFECT)).toBeNull();
        expect(screen.queryByText("inbox_item_id:")).toBeNull();
    });

    it("names a request it could not read by its number, whether it arrives as a number or digits", () => {
        const { unmount } = renderCard("approve_join_request", { inbox_item_id: 12 });
        expect(screen.getByText("Approve join request #12")).toBeTruthy();
        unmount();

        const second = renderCard("decline_join_request", { inbox_item_id: "12" });
        expect(screen.getByText("Decline join request #12")).toBeTruthy();
        second.unmount();

        renderCard("approve_join_request", {});
        expect(screen.getByText("Approve join request")).toBeTruthy();
    });
});

describe("DeleteProjectPreview (delete_project approval, in the app only)", () => {
    const d = en.tasks.modals.deleteProject;

    it("names the project and lists what is destroyed in the page dialog's own words", () => {
        renderCard("delete_project", {
            project_id: "Website Redesign",
            project_name: "Website Redesign",
        });
        expect(screen.getByText("Delete project Website Redesign")).toBeTruthy();
        expect(screen.getByText("Name given: Website Redesign")).toBeTruthy();
        // The same strings `ModalDeleteProject` renders, not copies of them.
        for (const line of [
            d.destroyedTitle,
            d.destroyedMilestones,
            d.destroyedTasks,
            d.destroyedSprints,
            d.destroyedMembersTags,
            d.chatNote,
        ]) {
            expect(screen.getByText(line)).toBeTruthy();
        }
        expect(screen.getByText("This action cannot be undone")).toBeTruthy();
        expect(screen.queryByText(/not the project's name/)).toBeNull();
        // Structured: the raw key:value fallback must NOT render.
        expect(screen.queryByText("project_id:")).toBeNull();
        expect(screen.queryByText("project_name:")).toBeNull();
    });

    it("is drawn as a destructive card: the delete icon is in the danger color", () => {
        renderCard("delete_project", {
            project_id: "Website Redesign",
            project_name: "Website Redesign",
        });
        expect(document.querySelector('[data-testid="DeleteOutlineRoundedIcon"]')).toBeTruthy();
    });

    it("shows the name as typed and warns when it is not the project's name", () => {
        renderCard("delete_project", {
            project_id: "Website Redesign",
            project_name: "website redesign",
        });
        // The heading is the project the id resolved to; the echo is verbatim.
        expect(screen.getByText("Delete project Website Redesign")).toBeTruthy();
        expect(screen.getByText("Name given: website redesign")).toBeTruthy();
        expect(
            screen.getByText(
                "That is not the project's name. The project is only deleted if the name matches exactly."
            )
        ).toBeTruthy();
        // It still lists what a delete destroys.
        expect(screen.getByText(d.destroyedTasks)).toBeTruthy();
    });

    it("does not warn about a project name with spaces around it that the echo repeats", () => {
        renderCard("delete_project", {
            project_id: " Website Redesign ",
            project_name: " Website Redesign ",
        });
        expect(screen.queryByText(/not the project's name/)).toBeNull();
    });

    it("names a project the caller can't read by the echoed name, without comparing", () => {
        renderCard("delete_project", { project_id: 42, project_name: "Website Redesign" });
        expect(screen.getByText("Delete project Website Redesign")).toBeTruthy();
        expect(screen.queryByText(/^Name given/)).toBeNull();
        expect(screen.queryByText(/not the project's name/)).toBeNull();
    });

    it("falls back to the id, then to a neutral phrase", () => {
        const { unmount } = renderCard("delete_project", { project_id: 42 });
        expect(screen.getByText("Delete this project (#42)")).toBeTruthy();
        unmount();

        renderCard("delete_project", {});
        expect(screen.getByText("Delete this project")).toBeTruthy();
        expect(screen.getByText(d.destroyedTitle)).toBeTruthy();
    });
});

describe("getToolLabel", () => {
    it("maps a known tool_name to its friendly, non-technical label", () => {
        expect(getToolLabel("search_knowledge_base", en)).toBe("Searching your workspace");
        expect(getToolLabel("update_tasks_bulk", en)).toBe("Updating several tasks");
        expect(getToolLabel("create_task", en)).toBe("Creating a task");
    });

    it("labels the todo, milestone and chat tools added with the capability work", () => {
        expect(getToolLabel("manage_milestone", en)).toBe("Managing a milestone");
        expect(getToolLabel("delete_milestone", en)).toBe("Deleting a milestone");
        expect(getToolLabel("delete_todo_item", en)).toBe("Deleting a to-do");
        expect(getToolLabel("list_my_chats", en)).toBe("Finding your chats");
    });

    it("labels the project create-or-change and project member tools", () => {
        expect(getToolLabel("manage_project", en)).toBe("Managing a project");
        expect(getToolLabel("manage_project_members", en)).toBe("Managing project members");
    });

    it("labels the project tag, project label, join request and project delete tools", () => {
        expect(getToolLabel("add_project_tag", en)).toBe("Adding a project tag");
        expect(getToolLabel("manage_project_labels", en)).toBe("Managing project labels");
        expect(getToolLabel("approve_join_request", en)).toBe(
            "Approving a request to join a project"
        );
        expect(getToolLabel("decline_join_request", en)).toBe(
            "Declining a request to join a project"
        );
        expect(getToolLabel("delete_project", en)).toBe("Deleting a project");
    });

    it("labels the note folder and favorite tools", () => {
        expect(getToolLabel("manage_note_folder", en)).toBe("Managing a note folder");
        expect(getToolLabel("favorite_note", en)).toBe("Updating your favorites");
    });

    it("labels the note delete, note folder delete, note sharing and note access tools", () => {
        expect(getToolLabel("delete_note", en)).toBe("Deleting a note");
        expect(getToolLabel("delete_note_folder", en)).toBe("Deleting a note folder");
        expect(getToolLabel("manage_note_sharing", en)).toBe("Managing note sharing");
        expect(getToolLabel("list_note_access", en)).toBe("Checking who can open a note");
    });

    it("labels the note history read and the note version restore", () => {
        expect(getToolLabel("fetch_note_history", en)).toBe("Reading a note's history");
        expect(getToolLabel("restore_note_version", en)).toBe(
            "Restoring an earlier version of a note"
        );
    });

    it("labels the sprint create-or-change and sprint delete tools", () => {
        expect(getToolLabel("manage_sprint", en)).toBe("Managing a sprint");
        expect(getToolLabel("delete_sprint", en)).toBe("Deleting a sprint");
    });

    it("labels the comment edit, comment delete and description restore tools", () => {
        expect(getToolLabel("update_comment", en)).toBe("Replacing one of your comments");
        expect(getToolLabel("delete_comment", en)).toBe("Deleting one of your comments");
        expect(getToolLabel("restore_task_body", en)).toBe("Restoring a task's description");
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
