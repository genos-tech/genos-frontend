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
});
