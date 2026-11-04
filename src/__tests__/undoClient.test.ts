/**
 * The undo client at the wire (genos-api `undo_apply.py`, `agent_views.py`):
 *
 *   - the request: POST /agent/runs/<run>/steps/<step>/undo/, the bearer token,
 *     and NO body. Ids are deliberately not 1, so a URL that dropped or swapped
 *     either one cannot pass by accident.
 *   - the success answer, with the entity kinds the backend really sends (task,
 *     note and COMMENT: undoing `add_comment` is not in the brief's list).
 *   - one typed refusal per backend code, the DRF throttle's `{detail}` body, a 5xx,
 *     a dropped connection, an HTML 404, and a 200 that is not an answer.
 *   - which refusals can be retried: only where the cause is not the workspace.
 *   - the new event fields survive the stream client's field-by-field copy, and an
 *     older backend's events (none of them) still come through unchanged.
 */

import { afterEach, describe, expect, it, vi } from "vitest";

import {
    askAgentStream,
    decideAgent,
    undoAgentStep,
    type UndoRefusalCode,
} from "../services/agentApi";

const RUN = "5f0c9a7e-1d2b-4c3d-8e4f-0a1b2c3d4e5f";
const STEP = 4711;

const respond = (status: number, body: unknown, ok = status >= 200 && status < 300): Response =>
    ({
        ok,
        status,
        json: async () => {
            if (body === undefined) throw new SyntaxError("Unexpected token < in JSON");
            return body;
        },
    }) as unknown as Response;

const stubFetch = (response: Response | (() => Promise<Response>)) => {
    const fetchMock = vi.fn(typeof response === "function" ? response : async () => response);
    vi.stubGlobal("fetch", fetchMock);
    return fetchMock;
};

const call = (token: string | null = "access") =>
    undoAgentStep({ runId: RUN, stepId: STEP, accessToken: token });

afterEach(() => {
    vi.unstubAllGlobals();
});

describe("the request", () => {
    it("POSTs to the step's undo URL with the bearer token and no body", async () => {
        const fetchMock = stubFetch(respond(200, {}));
        await call();
        expect(fetchMock).toHaveBeenCalledTimes(1);
        const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
        expect(url.endsWith(`/agent/runs/${RUN}/steps/4711/undo/`)).toBe(true);
        expect(init.method).toBe("POST");
        expect(init.body).toBeUndefined();
        expect(init.headers).toEqual({ Authorization: "Bearer access" });
    });

    it("encodes the ids it puts in the path", async () => {
        const fetchMock = stubFetch(respond(200, {}));
        await undoAgentStep({ runId: "a/b c", stepId: 7, accessToken: "t" });
        const [url] = fetchMock.mock.calls[0] as unknown as [string];
        expect(url.endsWith("/agent/runs/a%2Fb%20c/steps/7/undo/")).toBe(true);
    });

    it("sends nothing and says so when there is no token", async () => {
        const fetchMock = stubFetch(respond(200, {}));
        const result = await call(null);
        expect(fetchMock).not.toHaveBeenCalled();
        expect(result).toMatchObject({
            kind: "refused",
            refusal: { code: "unauthorized", retryable: false },
        });
    });
});

describe("a success", () => {
    const task = {
        run_id: RUN,
        step_id: STEP,
        tool_name: "update_task",
        undone_at: "2026-11-04T01:02:03Z",
        action: "restored",
        restored: ["status", "due_date"],
        skipped: [{ field: "priority", reason: "changed_since" }],
        entity: { kind: "task", task_id: 812, project_id: 9, display_id: "PRJ-12" },
        summary: "Put back status, due_date of task PRJ-12.",
    };

    it("is handed back typed, with what was put back and what was left", async () => {
        stubFetch(respond(200, task));
        const result = await call();
        expect(result).toEqual({
            kind: "undone",
            answer: {
                run_id: RUN,
                step_id: STEP,
                tool_name: "update_task",
                undone_at: "2026-11-04T01:02:03Z",
                action: "restored",
                restored: ["status", "due_date"],
                skipped: [{ field: "priority", reason: "changed_since" }],
                entity: { kind: "task", task_id: 812, project_id: 9, display_id: "PRJ-12" },
                summary: "Put back status, due_date of task PRJ-12.",
            },
        });
    });

    it("reads a deleted task", async () => {
        stubFetch(
            respond(200, {
                ...task,
                tool_name: "create_task",
                action: "deleted",
                restored: [],
                skipped: [],
            })
        );
        const result = await call();
        expect(result).toMatchObject({
            kind: "undone",
            answer: { action: "deleted", restored: [], entity: { kind: "task", task_id: 812 } },
        });
    });

    it("reads a note, whose type is the FAMILY, and the live-editor outcome", async () => {
        stubFetch(
            respond(200, {
                ...task,
                tool_name: "update_note",
                restored: ["title", "body"],
                skipped: [],
                entity: { kind: "note", note_type: "task", note_id: 55, title: "Plan" },
                live_editor: "sent",
            })
        );
        const result = await call();
        expect(result).toMatchObject({
            kind: "undone",
            answer: {
                entity: { kind: "note", note_type: "task", note_id: 55, title: "Plan" },
                live_editor: "sent",
            },
        });
    });

    it("reads a COMMENT entity (undoing add_comment), which the brief did not list", async () => {
        stubFetch(
            respond(200, {
                ...task,
                tool_name: "add_comment",
                action: "deleted",
                restored: [],
                skipped: [],
                entity: {
                    kind: "comment",
                    task_id: 812,
                    project_id: 9,
                    display_id: "PRJ-12",
                    comment_id: 3,
                },
                comment_count: 2,
            })
        );
        const result = await call();
        expect(result).toMatchObject({
            kind: "undone",
            answer: {
                action: "deleted",
                entity: { kind: "comment", task_id: 812, comment_id: 3 },
            },
        });
    });

    it("keeps an entity kind it does not know as null instead of guessing", async () => {
        stubFetch(respond(200, { ...task, entity: { kind: "sprint", sprint_id: 1 } }));
        const result = await call();
        expect(result).toMatchObject({ kind: "undone", answer: { entity: null } });
    });

    it("a 200 that is not an undo answer is not reported as one", async () => {
        stubFetch(respond(200, { ok: true }));
        const result = await call();
        expect(result).toMatchObject({ kind: "refused", refusal: { code: "unknown" } });
    });
});

describe("a refusal", () => {
    const CASES: Array<[number, UndoRefusalCode, boolean]> = [
        [404, "not_found", false],
        [409, "not_undoable", false],
        [409, "already_undone", false],
        [409, "changed_since", false],
        [410, "expired", false],
        [403, "permission_lost", false],
    ];

    it.each(CASES)("%i %s is typed and cannot be retried", async (status, code, retryable) => {
        stubFetch(respond(status, { error: `English for ${code}`, code }));
        const result = await call();
        expect(result).toEqual({
            kind: "refused",
            refusal: {
                code,
                status,
                message: `English for ${code}`,
                skipped: [],
                detail: null,
                retryable,
            },
        });
    });

    it("carries which fields had changed on a changed_since", async () => {
        stubFetch(
            respond(409, {
                error: "Task PRJ-12 has changed since Genos made this change.",
                code: "changed_since",
                skipped: [
                    { field: "status", reason: "changed_since" },
                    { field: "body", reason: "changed_since" },
                ],
            })
        );
        const result = await call();
        expect(result).toMatchObject({
            kind: "refused",
            refusal: {
                code: "changed_since",
                skipped: [
                    { field: "status", reason: "changed_since" },
                    { field: "body", reason: "changed_since" },
                ],
            },
        });
    });

    it("carries a note's `detail`", async () => {
        stubFetch(respond(409, { error: "e", code: "changed_since", detail: "has sub-notes" }));
        const result = await call();
        expect(result).toMatchObject({ refusal: { detail: "has sub-notes" } });
    });

    it("reads DRF's throttle, which is {detail} with no code, as retryable", async () => {
        stubFetch(
            respond(429, { detail: "Request was throttled. Expected available in 12 seconds." })
        );
        const result = await call();
        expect(result).toMatchObject({
            kind: "refused",
            refusal: {
                code: "throttled",
                status: 429,
                message: "Request was throttled. Expected available in 12 seconds.",
                retryable: true,
            },
        });
    });

    it("a 5xx is a server failure and retryable, whatever its body", async () => {
        stubFetch(respond(502, undefined));
        const result = await call();
        expect(result).toMatchObject({
            refusal: { code: "server", status: 502, retryable: true },
        });
    });

    it("a dropped connection is `network` and retryable", async () => {
        stubFetch(async () => {
            throw new TypeError("Failed to fetch");
        });
        const result = await call();
        expect(result).toMatchObject({
            refusal: { code: "network", status: 0, retryable: true },
        });
    });

    it("a 401 is the token, and a retry can help once it is renewed", async () => {
        stubFetch(respond(401, { detail: "Authentication credentials were not provided." }));
        const result = await call();
        expect(result).toMatchObject({ refusal: { code: "unauthorized", retryable: true } });
    });

    it("a 404 with no body (a backend without the route) is still `not_found`", async () => {
        stubFetch(respond(404, undefined));
        const result = await call();
        expect(result).toMatchObject({ refusal: { code: "not_found", retryable: false } });
    });

    it("a 409 with a code it does not know is `unknown`, with the server's words, no retry", async () => {
        stubFetch(respond(409, { error: "Something new.", code: "brand_new" }));
        const result = await call();
        expect(result).toMatchObject({
            refusal: { code: "unknown", message: "Something new.", retryable: false },
        });
    });
});

describe("the stream events carry the new fields", () => {
    const stream = (events: unknown[]): Response => {
        const payload = new TextEncoder().encode(
            events.map((e) => JSON.stringify(e) + "\n").join("")
        );
        let sent = false;
        return {
            ok: true,
            status: 200,
            body: {
                getReader: () => ({
                    read: async () =>
                        sent
                            ? { value: undefined, done: true as const }
                            : ((sent = true), { value: payload, done: false as const }),
                    releaseLock() {},
                }),
            },
        } as unknown as Response;
    };
    const handlers = () => ({
        onSources: vi.fn(),
        onDelta: vi.fn(),
        onDone: vi.fn(),
        onError: vi.fn(),
        onToolStart: vi.fn(),
        onToolResult: vi.fn(),
        onToolError: vi.fn(),
        onPendingApproval: vi.fn(),
    });
    const DONE = { type: "done", session_id: "s", run_id: "r" };
    const run = async (events: unknown[]) => {
        stubFetch(stream(events));
        const h = handlers();
        await decideAgent({
            runId: "r",
            approvalToken: "t",
            decision: "approve",
            accessToken: "a",
            ...h,
        });
        return h;
    };
    const ask = async (events: unknown[]) => {
        stubFetch(stream(events));
        const h = handlers();
        await askAgentStream({ query: "q", teamId: "1", accessToken: "a", ...h });
        return h;
    };
    const RESULT = { type: "tool_call_result", step: 2, tool_name: "update_task", summary: "ok" };
    const PENDING = {
        type: "tool_call_pending_approval",
        step: 2,
        tool_name: "delete_note",
        arguments: {},
        approval_token: "ap",
        run_id: "r",
    };

    it("tool_call_result: `undo` reaches the handler", async () => {
        const h = await run([
            { ...RESULT, undo: { step_id: 4711, available_until: "2026-11-11T00:00:00Z" } },
            DONE,
        ]);
        expect(h.onToolResult).toHaveBeenCalledWith(
            expect.objectContaining({
                undo: { step_id: 4711, available_until: "2026-11-11T00:00:00Z" },
            })
        );
    });

    it.each([
        ["null", null],
        ["not an object", "yes"],
        ["no step id", { available_until: "2026-11-11T00:00:00Z" }],
        ["a step id that is not a number", { step_id: "4711", available_until: "x" }],
        ["no date", { step_id: 4711 }],
    ])("tool_call_result: an `undo` that is %s is dropped, never half-used", async (_n, undo) => {
        const h = await run([{ ...RESULT, undo }, DONE]);
        expect(h.onToolResult.mock.calls[0][0].undo).toBeUndefined();
    });

    it("tool_call_result from an older backend (no undo) is as it was", async () => {
        const h = await run([RESULT, DONE]);
        expect(h.onToolResult.mock.calls[0][0].undo).toBeUndefined();
    });

    it("pending approval: `undoable:false` and its reason reach the handler", async () => {
        const h = await ask([{ ...PENDING, undoable: false, undo_reason: "irreversible_delete" }]);
        expect(h.onPendingApproval).toHaveBeenCalledWith(
            expect.objectContaining({ undoable: false, undo_reason: "irreversible_delete" })
        );
    });

    it("pending approval: `undoable:true` is passed and carries no reason", async () => {
        const h = await ask([{ ...PENDING, undoable: true, undo_reason: "stray" }]);
        const payload = h.onPendingApproval.mock.calls[0][0];
        expect(payload.undoable).toBe(true);
        expect("undo_reason" in payload).toBe(false);
    });

    it("pending approval from an older backend has neither key (no claim is made)", async () => {
        const h = await ask([PENDING]);
        const payload = h.onPendingApproval.mock.calls[0][0];
        expect("undoable" in payload).toBe(false);
        expect("undo_reason" in payload).toBe(false);
    });

    it("pending approval: a non-boolean `undoable` is no claim", async () => {
        const h = await ask([{ ...PENDING, undoable: "no", undo_reason: "not_yet" }]);
        const payload = h.onPendingApproval.mock.calls[0][0];
        expect("undoable" in payload).toBe(false);
        expect("undo_reason" in payload).toBe(false);
    });
});
