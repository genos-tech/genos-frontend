/**
 * The /decide/ client under edit before approve (genos-api #570), at the wire:
 * what goes out and how each answer is handed back.
 *
 *   - `edited_args` is sent on an approve with something in it, never on a
 *     reject, and an empty patch is left off (a plain approve).
 *   - A 422 `{error, field_errors}` is NOT a stream and NOT a failed run: it
 *     reaches `onEditsRejected`, and nothing else is called.
 *   - Every other non-OK answer is what it was: `onError(message)`.
 *   - The new event fields survive the client's field-by-field copy.
 */

import { afterEach, describe, expect, it, vi } from "vitest";

import { askAgentStream, decideAgent, type DecideAgentArgs } from "../services/agentApi";

const handlers = () => ({
    onSources: vi.fn(),
    onDelta: vi.fn(),
    onDone: vi.fn(),
    onError: vi.fn(),
    onToolStart: vi.fn(),
    onToolResult: vi.fn(),
    onToolError: vi.fn(),
    onPendingApproval: vi.fn(),
    onEditsRejected: vi.fn(),
});

const base = (h: ReturnType<typeof handlers>, over: Partial<DecideAgentArgs> = {}) => ({
    runId: "run-1",
    approvalToken: "tok-1",
    decision: "approve" as const,
    accessToken: "access",
    ...h,
    ...over,
});

const ndjson = (events: unknown[]): Response => {
    const payload = new TextEncoder().encode(events.map((e) => JSON.stringify(e) + "\n").join(""));
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

const jsonResponse = (status: number, body: unknown): Response =>
    ({
        ok: false,
        status,
        json: async () => body,
        text: async () => JSON.stringify(body),
    }) as unknown as Response;

const stubFetch = (response: Response) => {
    const fetchMock = vi.fn(async () => response);
    vi.stubGlobal("fetch", fetchMock);
    return fetchMock;
};

const sentBody = (fetchMock: ReturnType<typeof stubFetch>) =>
    JSON.parse((fetchMock.mock.calls[0] as unknown as [string, RequestInit])[1].body as string);

afterEach(() => {
    vi.unstubAllGlobals();
});

describe("the request body", () => {
    const DONE = { type: "done", session_id: "s", run_id: "r" };

    it("an approve with edits sends `edited_args`: only what the caller passed", async () => {
        const fetchMock = stubFetch(ndjson([DONE]));
        await decideAgent(
            base(handlers(), { editedArgs: { title: "New title", "updates[2].priority": "High" } })
        );
        expect(sentBody(fetchMock)).toEqual({
            run_id: "run-1",
            approval_token: "tok-1",
            decision: "approve",
            edited_args: { title: "New title", "updates[2].priority": "High" },
        });
    });

    it("keeps an empty string and an empty tag list: they are edits (clear a date, clear tags)", async () => {
        const fetchMock = stubFetch(ndjson([DONE]));
        await decideAgent(base(handlers(), { editedArgs: { due_date: "", tags: [] } }));
        expect(sentBody(fetchMock).edited_args).toEqual({ due_date: "", tags: [] });
    });

    it("a plain approve has no `edited_args` key at all", async () => {
        const fetchMock = stubFetch(ndjson([DONE]));
        await decideAgent(base(handlers()));
        expect(sentBody(fetchMock)).toEqual({
            run_id: "run-1",
            approval_token: "tok-1",
            decision: "approve",
        });
        expect(sentBody(fetchMock)).not.toHaveProperty("edited_args");
    });

    it("an empty patch is a plain approve: not sent", async () => {
        const fetchMock = stubFetch(ndjson([DONE]));
        await decideAgent(base(handlers(), { editedArgs: {} }));
        expect(sentBody(fetchMock)).not.toHaveProperty("edited_args");
    });

    it("a reject never carries edits, even when the caller hands some in (the server answers 400)", async () => {
        const fetchMock = stubFetch(ndjson([DONE]));
        await decideAgent(base(handlers(), { decision: "reject", editedArgs: { title: "x" } }));
        expect(sentBody(fetchMock)).toEqual({
            run_id: "run-1",
            approval_token: "tok-1",
            decision: "reject",
        });
    });

    it("with no access token nothing is sent", async () => {
        const fetchMock = stubFetch(ndjson([DONE]));
        const h = handlers();
        await decideAgent(base(h, { accessToken: null, editedArgs: { title: "x" } }));
        expect(fetchMock).not.toHaveBeenCalled();
        expect(h.onError).toHaveBeenCalledTimes(1);
    });
});

describe("a 422 from /decide/", () => {
    const BODY = {
        error: "Some of your changes can't be applied. Nothing was approved or run: fix them and approve again.",
        field_errors: {
            title: "Title can't be empty.",
            "updates[1].priority": "Priority: choose one of Minimal, Low, Normal, High, Critical.",
        },
    };

    it("reaches onEditsRejected with the message and the sentence per path, and nothing else", async () => {
        stubFetch(jsonResponse(422, BODY));
        const h = handlers();
        await decideAgent(base(h, { editedArgs: { title: "" } }));
        expect(h.onEditsRejected).toHaveBeenCalledTimes(1);
        expect(h.onEditsRejected).toHaveBeenCalledWith({
            message: BODY.error,
            fieldErrors: BODY.field_errors,
        });
        // Not a failed run, not a stream: the turn must not be promoted.
        expect(h.onError).not.toHaveBeenCalled();
        expect(h.onDone).not.toHaveBeenCalled();
        expect(h.onToolStart).not.toHaveBeenCalled();
        expect(h.onPendingApproval).not.toHaveBeenCalled();
    });

    it("keeps an empty field_errors object: it is still a refusal of the edits", async () => {
        stubFetch(jsonResponse(422, { error: "nope", field_errors: {} }));
        const h = handlers();
        await decideAgent(base(h, { editedArgs: { title: "x" } }));
        expect(h.onEditsRejected).toHaveBeenCalledWith({ message: "nope", fieldErrors: {} });
        expect(h.onError).not.toHaveBeenCalled();
    });

    it("drops an entry that is not text rather than failing", async () => {
        stubFetch(jsonResponse(422, { error: "e", field_errors: { title: "bad", due_date: 5 } }));
        const h = handlers();
        await decideAgent(base(h, { editedArgs: { title: "x" } }));
        expect(h.onEditsRejected).toHaveBeenCalledWith({
            message: "e",
            fieldErrors: { title: "bad" },
        });
    });

    it("a 422 with no field_errors object is any other failure: onError", async () => {
        stubFetch(jsonResponse(422, { error: "something else" }));
        const h = handlers();
        await decideAgent(base(h, { editedArgs: { title: "x" } }));
        expect(h.onEditsRejected).not.toHaveBeenCalled();
        expect(h.onError).toHaveBeenCalledWith("something else");
    });

    it("a caller that does not handle edits gets the 422 as an ordinary error, as before", async () => {
        stubFetch(jsonResponse(422, BODY));
        const h = handlers();
        await decideAgent({ ...base(h), onEditsRejected: undefined });
        expect(h.onError).toHaveBeenCalledWith(BODY.error);
    });
});

describe("every other status is unchanged: onError with the server's words", () => {
    it.each([
        [
            400,
            "A rejected action can't carry edits: edited_args is only accepted with decision 'approve'.",
        ],
        [403, "Not authorized to resume this run."],
        [409, "run is not awaiting approval (the approval was already used)."],
        [503, "Could not resume this run just now. Nothing was executed; try again."],
    ])("%i", async (status, error) => {
        stubFetch(jsonResponse(status, { error, field_errors: { title: "ignored here" } }));
        const h = handlers();
        await decideAgent(base(h, { editedArgs: { title: "x" } }));
        expect(h.onError).toHaveBeenCalledWith(error);
        expect(h.onEditsRejected).not.toHaveBeenCalled();
    });
});

describe("the new event fields reach the handlers", () => {
    it("tool_call_pending_approval carries `editable` (and still its other keys)", async () => {
        stubFetch(
            ndjson([
                {
                    type: "tool_call_pending_approval",
                    step: 2,
                    tool_name: "update_tasks_bulk",
                    arguments: { updates: [{ task_id: 5, priority: "High" }] },
                    editable: ["updates[0].priority"],
                    approval_token: "tok-9",
                    run_id: "run-9",
                },
            ])
        );
        const h = handlers();
        await askAgentStream({ query: "q", teamId: "t", accessToken: "a", ...h });
        expect(h.onPendingApproval).toHaveBeenCalledWith({
            step: 2,
            tool_name: "update_tasks_bulk",
            arguments: { updates: [{ task_id: 5, priority: "High" }] },
            editable: ["updates[0].priority"],
            approval_token: "tok-9",
            run_id: "run-9",
        });
    });

    it("an older backend sends no `editable`: it reads as undefined", async () => {
        stubFetch(
            ndjson([
                {
                    type: "tool_call_pending_approval",
                    step: 1,
                    tool_name: "update_task",
                    arguments: {},
                    approval_token: "t",
                    run_id: "r",
                },
            ])
        );
        const h = handlers();
        await askAgentStream({ query: "q", teamId: "t", accessToken: "a", ...h });
        expect(h.onPendingApproval.mock.calls[0][0].editable).toBeUndefined();
    });

    it("tool_call_result carries `edited` and `edited_arguments` on the resumed stream", async () => {
        stubFetch(
            ndjson([
                {
                    type: "tool_call_start",
                    step: 1,
                    tool_name: "update_task",
                    arguments: { title: "New title" },
                },
                {
                    type: "tool_call_result",
                    step: 1,
                    tool_name: "update_task",
                    summary: "Updated PRJ-1",
                    duration_ms: 12,
                    edited: true,
                    edited_arguments: { title: "New title" },
                },
                { type: "done", session_id: "s", run_id: "r" },
            ])
        );
        const h = handlers();
        await decideAgent(base(h, { editedArgs: { title: "New title" } }));
        expect(h.onToolStart).toHaveBeenCalledWith({
            step: 1,
            tool_name: "update_task",
            arguments: { title: "New title" },
        });
        expect(h.onToolResult).toHaveBeenCalledWith(
            expect.objectContaining({
                summary: "Updated PRJ-1",
                edited: true,
                edited_arguments: { title: "New title" },
            })
        );
    });

    it("a plain approve's result has neither key", async () => {
        stubFetch(
            ndjson([
                { type: "tool_call_result", step: 1, tool_name: "update_task", summary: "ok" },
                { type: "done" },
            ])
        );
        const h = handlers();
        await decideAgent(base(h));
        const payload = h.onToolResult.mock.calls[0][0];
        expect(payload.edited).toBeUndefined();
        expect(payload.edited_arguments).toBeUndefined();
    });
});
