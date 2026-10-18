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
            "get_task_blockers",
            "get_task_history",
            "find_task_by_delivery",
            "search_workspace",
            "get_note",
            "get_current_user",
            "get_team_members",
            "list_project_members",
            "list_task_dependencies",
            "list_note_folders",
            "list_uncompleted_todos",
            "list_today_todos",
            "list_calendar_events",
            "list_calendars",
            "get_pr",
            "list_pr_reviews",
            "list_pr_comments",
            "list_pr_files",
            "list_pr_commits",
        ],
        write: [
            "update_task",
            "add_comment",
            "add_task_delivery",
            "update_task_dependencies",
            "create_task",
            "assign_task",
            "update_tasks_bulk",
            "create_task_plan",
            "create_note",
            "update_note",
            "create_todo_item",
            "update_todo_item",
            "create_calendar_event",
            "update_calendar_event",
            "delete_calendar_event",
        ],
    };

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
});
