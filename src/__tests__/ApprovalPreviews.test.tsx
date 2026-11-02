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
            screen.getByText("Reminder: 2026-11-05 09:00 → 2026-11-06T09:00 (Asia/Tokyo)")
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
