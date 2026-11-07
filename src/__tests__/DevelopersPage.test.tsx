/**
 * `/developers` — the public API reference.
 *
 * Pins the claims an integrator would build on and that would rot
 * silently: the auth scheme (`ApiKey`, not `Bearer`), the live spec
 * link, every documented event name, and — most importantly — the two
 * privacy rules that are the reason chat webhooks exist in the shape
 * they do.
 *
 * A docs page is unusually prone to passing review while being wrong,
 * because nothing else in the system depends on it.
 */
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";

import DevelopersPage from "../lp/DevelopersPage";

const renderPage = () =>
    render(
        <MemoryRouter>
            <DevelopersPage />
        </MemoryRouter>
    );

describe("DevelopersPage", () => {
    it("documents the ApiKey scheme rather than Bearer", () => {
        renderPage();
        // The distinction is deliberate server-side — documenting it
        // wrong sends every integrator down the wrong path.
        expect(screen.getAllByText(/ApiKey/).length).toBeGreaterThan(0);
        expect(screen.getAllByText(/gnos_/).length).toBeGreaterThan(0);
    });

    it("links to the spec served by the API, not a bundled copy", () => {
        renderPage();
        const link = screen.getByText("openapi.json").closest("a");
        expect(link?.getAttribute("href")).toContain("/api/public/v1/openapi.json");
    });

    it("lists every webhook event the API can send", () => {
        renderPage();
        for (const event of [
            "task.created",
            "task.updated",
            "task.completed",
            "task.comment_created",
            "message.created",
        ]) {
            expect(screen.getAllByText(event).length).toBeGreaterThan(0);
        }
    });

    it("states that direct messages can never be subscribed to", () => {
        renderPage();
        // The single most important sentence on the page: it is the
        // reason the chat event shipped at all. Matched on the whole
        // document because the phrase is split across a <b> — an
        // element-scoped matcher would fail on formatting, not content.
        expect(document.body.textContent).toMatch(/direct messages can never be subscribed to/i);
    });

    it("explains that the two scope lists mean opposite things", () => {
        renderPage();
        // Empty project_ids = every project; empty channel_ids = none.
        // An integrator who assumes symmetry writes a broken filter.
        expect(screen.getByText(/an allow-list, empty/)).toBeTruthy();
        expect(screen.getByText(/a filter, unset/)).toBeTruthy();
        expect(screen.getByText(/There is no subscribe-to-all-chat/)).toBeTruthy();
    });

    it("documents the signature scheme including the timestamp", () => {
        renderPage();
        expect(screen.getAllByText(/X-Genos-Signature/).length).toBeGreaterThan(0);
        expect(screen.getAllByText(/X-Genos-Timestamp/).length).toBeGreaterThan(0);
        // The timestamp is inside the signed string — that is what makes
        // a captured delivery non-replayable, and it is the detail an
        // implementer most often skips.
        expect(screen.getByText(/cannot be replayed later/)).toBeTruthy();
    });

    it("explains why activity.created is realtime-only and not a webhook", () => {
        renderPage();
        expect(screen.getAllByText(/activity.created/).length).toBeGreaterThan(0);
        expect(document.body.textContent).toMatch(/per-recipient/i);
    });

    it("marks v2 and v3 as internal, not part of the contract", () => {
        renderPage();
        expect(screen.getByText(/are internal surfaces/)).toBeTruthy();
    });

    // ── the detail an integrator actually needs ──────────────────────

    it("documents the query parameters for listing tasks", () => {
        renderPage();
        for (const param of ["team_id", "project_id", "limit", "offset"]) {
            expect(screen.getAllByText(param).length).toBeGreaterThan(0);
        }
    });

    it("explains when team_id is required and when it is ignored", () => {
        renderPage();
        // The single most common integration mistake: a personal token
        // spans teams, so it has to be told which one.
        expect(screen.getByText(/team_id required/)).toBeTruthy();
        expect(screen.getByText(/team_id ignored/)).toBeTruthy();
    });

    it("shows a worked example for every REST route", () => {
        renderPage();
        for (const route of ["/projects/", "/tasks/", "/tasks/{task_id}/", "/api/public/v1/me/"]) {
            expect(
                screen.getAllByText(new RegExp(route.replace(/[{}/]/g, "\\$&"))).length
            ).toBeGreaterThan(0);
        }
    });

    it("documents the socket ack envelope and its error codes", () => {
        renderPage();
        expect(screen.getAllByText(/VALIDATION_FAILED/).length).toBeGreaterThan(0);
        expect(screen.getAllByText(/UNAUTHENTICATED/).length).toBeGreaterThan(0);
        expect(screen.getAllByText(/BACKEND_ERROR/).length).toBeGreaterThan(0);
    });

    it("documents what a client SENDS, not only what it receives", () => {
        renderPage();
        // Half the socket contract, and the half the first version of
        // this page omitted entirely.
        for (const event of ["message.send", "reaction.add / .remove", "read.advance"]) {
            expect(screen.getAllByText(event).length).toBeGreaterThan(0);
        }
    });

    it("lists the flag events that the first extraction missed", () => {
        renderPage();
        // `flag.completed` / `flag.uncompleted` are emitted via an
        // `event_out=` parameter, so a scan for string literals in
        // `emit()` did not find them.
        expect(
            screen.getAllByText(/flag.added \/ .removed \/ .completed \/ .uncompleted/).length
        ).toBeGreaterThan(0);
    });

    it("states that bad input is never a 500", () => {
        renderPage();
        expect(document.body.textContent).toMatch(/Bad input is always a/);
    });

    // ── MCP ──────────────────────────────────────────────────────────

    // genos-api `origin/views/public/mcp/tools.py` CATALOG, in order. A
    // copy, because this repo cannot import that one: when the catalog
    // changes, this list and the page's `MCP_TOOLS` change with it. The
    // page said "Fourteen" through every change from 14 to 39.
    const MCP_CATALOG = {
        read: [
            "get_task",
            "list_my_tasks",
            "list_tasks",
            "list_projects",
            "list_milestones",
            "get_milestone_summary",
            "list_sprints",
            "get_sprint_summary",
            "get_task_blockers",
            "get_task_history",
            "find_task_by_delivery",
            "search_workspace",
            "get_note",
            "list_my_chats",
            "get_chat_thread",
            "list_my_mentions",
            "list_channel_members",
            "get_current_user",
            "get_team_members",
            "list_project_members",
            "list_project_tags",
            "list_task_dependencies",
            "list_note_folders",
            "list_note_access",
            "get_note_history",
            "list_uncompleted_todos",
            "list_today_todos",
            "list_calendar_events",
            "list_calendars",
            "get_my_blockers",
            "list_my_inbox",
            "get_my_throughput",
            "get_workload_distribution",
            "get_top_task_closers",
            "get_task_throughput_stats",
            "get_stale_tasks",
            "get_team_task_summary",
            "get_project_activity_ranking",
            "get_milestone_assignee_counts",
            "get_project_summary",
            "get_my_task_summary",
            "get_pr",
            "list_pr_reviews",
            "list_pr_comments",
            "list_pr_files",
            "list_pr_commits",
            "get_my_briefing",
        ],
        write: [
            "update_task",
            "add_comment",
            "update_comment",
            "delete_comment",
            "restore_task_body",
            "add_task_delivery",
            "remove_task_delivery",
            "update_task_dependencies",
            "create_task",
            "assign_task",
            "update_tasks_bulk",
            "create_task_plan",
            "create_note",
            "update_note",
            "create_todo_item",
            "update_todo_item",
            "delete_todo_item",
            "create_calendar_event",
            "update_calendar_event",
            "delete_calendar_event",
            "manage_milestone",
            "delete_milestone",
            "manage_sprint",
            "delete_sprint",
            "manage_project",
            "manage_project_members",
            "add_project_tag",
            "manage_project_labels",
            "approve_join_request",
            "decline_join_request",
            "manage_note_folder",
            "favorite_note",
            "delete_note",
            "delete_note_folder",
            "manage_note_sharing",
            "restore_note_version",
        ],
    };

    // genos-api `origin/views/public/mcp/prompts.py` PROMPTS, in order. The same
    // kind of copy as the catalog above, for the same reason.
    const MCP_PROMPT_NAMES = ["catch_me_up", "plan_my_day"];

    const mcpTable = () => {
        const label = screen.getByText("Tools · scope");
        return [...label.parentElement!.querySelectorAll("tr")].map((tr) => {
            const cells = tr.querySelectorAll("td");
            return { name: cells[0].textContent, type: cells[1].textContent };
        });
    };

    it("lists exactly the published MCP tools, each with its scope", () => {
        renderPage();
        expect(mcpTable()).toEqual([
            ...MCP_CATALOG.read.map((name) => ({ name, type: "read" })),
            ...MCP_CATALOG.write.map((name) => ({ name, type: "write" })),
        ]);
    });

    it("describes list_note_folders as the My Notes and Team Notes folders", () => {
        renderPage();
        const row = [...document.querySelectorAll("tr")].find(
            (tr) => tr.querySelector("td")?.textContent === "list_note_folders"
        );
        expect(row?.textContent).toContain("The note folders in your My Notes and in Team Notes.");
        // "Personal note" is retired from the UI: the space is My Notes.
        expect(row?.textContent).not.toMatch(/personal/i);
    });

    it("gates the note deletes and sharing on the destructive opt-in, and not the restore", () => {
        renderPage();
        const rowOf = (name: string) =>
            [...document.querySelectorAll("tr")].find(
                (tr) => tr.querySelector("td")?.textContent === name
            )?.textContent ?? "";
        for (const name of ["delete_note", "delete_note_folder", "manage_note_sharing"]) {
            expect(rowOf(name)).toContain("destructive opt-in");
        }
        // A restore keeps what the note says now as a version, so it can be undone.
        expect(rowOf("restore_note_version")).not.toContain("destructive opt-in");
        expect(rowOf("restore_note_version")).toContain("can itself be undone");
    });

    it("says the destructive opt-in on exactly the eleven tools that need it", () => {
        renderPage();
        const rows = [...document.querySelectorAll("tr")].filter((tr) =>
            tr.textContent?.includes("destructive opt-in")
        );
        expect(rows.map((tr) => tr.querySelector("td")?.textContent)).toEqual([
            "delete_comment",
            "delete_todo_item",
            "delete_calendar_event",
            "delete_milestone",
            "delete_sprint",
            "manage_project_members",
            "approve_join_request",
            "delete_note",
            "delete_note_folder",
            "manage_note_sharing",
        ]);
    });

    it("lets a person in only with the opt-in, and lets a decline through without it", () => {
        renderPage();
        const rowOf = (name: string) =>
            [...document.querySelectorAll("tr")].find(
                (tr) => tr.querySelector("td")?.textContent === name
            )?.textContent ?? "";
        expect(rowOf("approve_join_request")).toContain("because it changes who has access");
        expect(rowOf("decline_join_request")).not.toContain("destructive opt-in");
        // Adding a tag or a label lets nobody in and destroys nothing.
        expect(rowOf("add_project_tag")).not.toContain("destructive opt-in");
        expect(rowOf("manage_project_labels")).not.toContain("destructive opt-in");
    });

    it("does not publish delete_project, which exists in the app only", () => {
        renderPage();
        expect(
            [...document.querySelectorAll("tr")].some(
                (tr) => tr.querySelector("td")?.textContent === "delete_project"
            )
        ).toBe(false);
    });

    // ── the secretary: briefing, prompts ────────────────────

    const rowOf = (name: string) =>
        [...document.querySelectorAll("tr")].find(
            (tr) => tr.querySelector("td")?.textContent === name
        );

    it("lists the secretary tools with the scope each really has", () => {
        renderPage();
        const typeOf = (name: string) => rowOf(name)?.querySelectorAll("td")[1].textContent;
        expect(typeOf("get_my_briefing")).toBe("read");
        // The worklog tools are gone (MIP-1170): nothing on the page names them.
        expect(rowOf("capture_worklog")).toBeUndefined();
        expect(rowOf("list_my_worklog")).toBeUndefined();
        expect(document.body.textContent).not.toMatch(/worklog/i);
    });

    it("says the briefing reads the calendar live and never stores it", () => {
        renderPage();
        const text = rowOf("get_my_briefing")?.textContent ?? "";
        expect(text).toContain("read from Google each time and never stored");
        expect(text).toMatch(/since_last/);
        expect(document.body.textContent).toMatch(/Genos does not\s+keep your calendar events/);
    });

    it("says the briefing is private to the member, in the prose", () => {
        renderPage();
        expect(screen.getByText("The briefing is yours alone")).toBeTruthy();
        const text = document.body.textContent ?? "";
        expect(text).toMatch(/built from what you can open and from other\s+people/);
    });

    it("lists both prompts as the commands a client shows", () => {
        renderPage();
        const label = screen.getByText("Prompts · commands");
        const names = [...label.parentElement!.querySelectorAll("tr")].map(
            (tr) => tr.querySelector("td")?.textContent
        );
        expect(names).toEqual(MCP_PROMPT_NAMES);
        const text = document.body.textContent ?? "";
        for (const name of MCP_PROMPT_NAMES) {
            expect(text).toContain(`/mcp__genos__${name}`);
        }
    });

    it("says what the prompts ask of the model, and that a read key only describes", () => {
        renderPage();
        const text = document.body.textContent ?? "";
        expect(text).toMatch(/a short answer that ends\s+on a question you can answer in a word/);
        expect(text).toMatch(/change nothing until\s+you say yes/);
        expect(text).toMatch(/read-only key is told to describe a change instead of\s+making it/);
    });

    it("says a note's comment threads come back with it", () => {
        renderPage();
        const text = rowOf("get_note")?.textContent ?? "";
        expect(text).toContain("comment threads");
        expect(text).toContain("include_resolved");
    });

    it("no longer says every tool is one the in-app agent uses", () => {
        renderPage();
        const text = document.body.textContent ?? "";
        expect(text).not.toMatch(/over the same tools the in-app agent uses/);
        expect(text).toMatch(/plus a few made for outside clients/);
    });

    it("states counts that agree with the tool table", () => {
        renderPage();
        const { read, write } = MCP_CATALOG;
        const text = document.body.textContent ?? "";
        expect(text).toContain(
            `${read.length + write.length} tools, ${read.length} reads and ${write.length} writes`
        );
        expect(text).toContain(`returns the ${read.length} reads only`);
        expect(text).toContain(`the ${write.length} writes in the table above need a write key`);
        // The original cut's numbers, which outlived it by 25 tools.
        expect(text).not.toMatch(/Fourteen|out of the 57|three writes/);
    });

    it("warns that MCP writes have no confirmation step and no undo", () => {
        renderPage();
        expect(screen.getByText("No confirmation step")).toBeTruthy();
        expect(document.body.textContent).toMatch(/Over MCP none of them do/);
        expect(document.body.textContent).toMatch(/there is no undo/);
    });

    it("warns that a read-scoped key reaches the owner's chats, direct messages included", () => {
        renderPage();
        const text = document.body.textContent ?? "";
        expect(text).toMatch(/read your own chats, direct messages included/);
        expect(text).toMatch(/a read-scoped key can call both/);
        expect(text).toMatch(/A key handed to an outside agent\s+exposes all of them/);
    });
});
