/**
 * "A task or milestone keeps its own Ask conversation" (MIP-1057, genos-api #874): the client half the
 * entry points share, with the transport real and `fetch` stubbed.
 *
 *   - `GET /agent/task-session/` (restore on open): the request, the answer's three shapes (a
 *     conversation, nothing yet / the flag off, gone) and what is a failure instead of "gone"
 *   - `POST /agent/ask/` with `task_context` / `session_id` / `new_conversation`: the body, and the 404
 *     and 400 answers
 *
 * Everything here is inert with the server flag off: `task_context` is ignored like an unknown field and
 * the restore route answers an empty 200.
 */

import { afterEach, describe, expect, it, vi } from "vitest";

import { askAgentStream, fetchTaskSession, isTaskId } from "../services/agentApi";

const TURN = {
    run_id: "r1",
    query: "what is left?",
    answer: "Two things.",
    status: "done",
    error: null,
    started_at: "2026-11-14T10:00:00Z",
    sources: [],
};

const json = (status: number, body: unknown): Response =>
    new Response(JSON.stringify(body), {
        status,
        headers: { "Content-Type": "application/json" },
    });

const stubFetch = (res: Response | (() => Response | Promise<Response>)) => {
    const fn = vi.fn(async () => (typeof res === "function" ? res() : res));
    vi.stubGlobal("fetch", fn);
    return fn;
};
const urlOf = (fn: ReturnType<typeof vi.fn>): string => String(fn.mock.calls[0][0]);
const initOf = (fn: ReturnType<typeof vi.fn>): RequestInit => fn.mock.calls[0][1] as RequestInit;

afterEach(() => {
    vi.unstubAllGlobals();
});

describe("isTaskId", () => {
    it("is a positive integer and nothing else", () => {
        expect(isTaskId(1)).toBe(true);
        expect(isTaskId(2039)).toBe(true);
        for (const bad of [0, -3, 1.5, NaN, Infinity, "12", null, undefined, true, "MIP-12", {}]) {
            expect(isTaskId(bad), String(bad)).toBe(false);
        }
        // Beyond what a JSON number carries exactly: the server could not read it either.
        expect(isTaskId(2 ** 53)).toBe(false);
    });
});

describe("GET /agent/task-session/ (restore on open)", () => {
    const restore = (over: Partial<Parameters<typeof fetchTaskSession>[0]> = {}) =>
        fetchTaskSession({ accessToken: "tok", teamId: "team-9", taskId: 2039, ...over });

    it("is a GET with the team and the numeric task id, and the caller's token", async () => {
        const fn = stubFetch(json(200, { agent_session_id: null, turns: [] }));
        await restore();
        expect(fn).toHaveBeenCalledTimes(1);
        expect(urlOf(fn)).toMatch(/\/agent\/task-session\/\?team_id=team-9&task_id=2039$/);
        const init = initOf(fn);
        expect(init.method ?? "GET").toBe("GET");
        expect(init.body).toBeUndefined();
        expect((init.headers as Record<string, string>).Authorization).toBe("Bearer tok");
    });

    it("returns the conversation: the session id and its turns", async () => {
        stubFetch(json(200, { agent_session_id: "sess-1", turns: [TURN] }));
        expect(await restore()).toEqual({
            kind: "ok",
            agentSessionId: "sess-1",
            turns: [TURN],
        });
    });

    it("never asked about it: an empty conversation, not an error", async () => {
        stubFetch(json(200, { agent_session_id: null, turns: [] }));
        expect(await restore()).toEqual({ kind: "ok", agentSessionId: null, turns: [] });
    });

    it("the flag off is the same empty 200: nothing to restore, nothing wrong", async () => {
        stubFetch(json(200, {}));
        expect(await restore()).toEqual({ kind: "ok", agentSessionId: null, turns: [] });
    });

    it("a session id that is not text is no session id", async () => {
        stubFetch(json(200, { agent_session_id: 7, turns: "nope" }));
        expect(await restore()).toEqual({ kind: "ok", agentSessionId: null, turns: [] });
    });

    it("404 {error} is gone: one answer for deleted, lost access and never there", async () => {
        stubFetch(json(404, { error: "Task not found." }));
        expect(await restore()).toEqual({ kind: "gone" });
    });

    it("a 404 that is not the platform's {error} is a failure to load, never a claim about the task", async () => {
        // A backend without the route answers Django's page or DRF's {detail}.
        stubFetch(new Response("<html>Not found</html>", { status: 404 }));
        expect((await restore()).kind).toBe("failed");
        stubFetch(json(404, { detail: "Not found." }));
        expect((await restore()).kind).toBe("failed");
    });

    it("400 and 5xx are failures that carry a sentence; a 400 keeps the server's own words", async () => {
        stubFetch(json(400, { error: "task_id must be a positive integer." }));
        expect(await restore()).toEqual({
            kind: "failed",
            message: "task_id must be a positive integer.",
        });
        stubFetch(new Response("boom", { status: 502 }));
        const failed = await restore();
        expect(failed).toMatchObject({ kind: "failed" });
        expect((failed as { message: string }).message).toContain("502");
    });

    it("a dropped connection is a failure, not a throw", async () => {
        vi.stubGlobal(
            "fetch",
            vi.fn(async () => {
                throw new TypeError("Failed to fetch");
            })
        );
        const failed = await restore();
        expect(failed.kind).toBe("failed");
        expect((failed as { message: string }).message).toContain("Failed to fetch");
    });

    it("an aborted restore is a quiet failure the caller ignores (it checks its own signal)", async () => {
        vi.stubGlobal(
            "fetch",
            vi.fn(async () => {
                throw new DOMException("aborted", "AbortError");
            })
        );
        expect(await restore()).toEqual({ kind: "failed", message: "" });
    });

    it("sends nothing without a token, a team or a real task id", async () => {
        const fn = stubFetch(json(200, {}));
        expect((await restore({ accessToken: null })).kind).toBe("failed");
        expect((await restore({ teamId: "" })).kind).toBe("failed");
        expect((await restore({ teamId: undefined })).kind).toBe("failed");
        for (const taskId of [0, -1, 1.5, NaN]) {
            expect((await restore({ taskId })).kind, String(taskId)).toBe("failed");
        }
        expect(fn).not.toHaveBeenCalled();
    });

    it("escapes the team id", async () => {
        const fn = stubFetch(json(200, {}));
        await restore({ teamId: "a b&c" });
        expect(urlOf(fn)).toContain("team_id=a%20b%26c");
    });
});

// --- the ask ------------------------------------------------------------------------------------

const handlers = () => ({
    onSources: vi.fn(),
    onDelta: vi.fn(),
    onDone: vi.fn(),
    onError: vi.fn(),
});

const ndjson = (events: unknown[]): Response =>
    new Response(events.map((e) => JSON.stringify(e) + "\n").join(""), { status: 200 });

const ask = async (
    extra: Partial<Parameters<typeof askAgentStream>[0]> = {},
    res: Response = ndjson([{ type: "done", session_id: "s1", run_id: "r1" }])
) => {
    const fn = stubFetch(res);
    const h = handlers();
    await askAgentStream({
        query: "what is left?",
        teamId: "team-9",
        accessToken: "tok",
        ...h,
        ...extra,
    });
    const body = fn.mock.calls.length ? JSON.parse(initOf(fn).body as string) : null;
    return { body, h, fn };
};

describe("POST /agent/ask/ with task_context", () => {
    it("an ordinary ask has none of the three: the body is what it was", async () => {
        const { body } = await ask();
        expect(Object.keys(body).sort()).toEqual(["locale", "query", "team_id"]);
    });

    it("carries task_context as {task_id} and nothing else of the task", async () => {
        const { body } = await ask({ taskContext: { taskId: 2039 } });
        expect(body.task_context).toEqual({ task_id: 2039 });
        expect(body).not.toHaveProperty("session_id");
        expect(body).not.toHaveProperty("new_conversation");
    });

    it("carries the team that was given (the task's own team) as team_id", async () => {
        const { body } = await ask({ taskContext: { taskId: 7 }, teamId: "host-team" });
        expect(body.team_id).toBe("host-team");
    });

    it("carries the restored session_id", async () => {
        const { body } = await ask({ taskContext: { taskId: 7 }, sessionId: "sess-1" });
        expect(body.session_id).toBe("sess-1");
        expect(body.task_context).toEqual({ task_id: 7 });
    });

    it("a new conversation is new_conversation: true, and only when asked for", async () => {
        const fresh = await ask({ taskContext: { taskId: 7 }, newConversation: true });
        expect(fresh.body.new_conversation).toBe(true);
        const plain = await ask({ taskContext: { taskId: 7 }, newConversation: false });
        expect(plain.body).not.toHaveProperty("new_conversation");
    });

    it("keeps the mentions it is given (the task as a # mention rides beside task_context)", async () => {
        const { body } = await ask({
            taskContext: { taskId: 7 },
            mentions: [{ type: "task", task_id: 7, label: "MIP-7" }],
        });
        expect(body.mentions).toEqual([{ type: "task", task_id: 7, label: "MIP-7" }]);
        expect(body.task_context).toEqual({ task_id: 7 });
    });

    it("never sends a task_context the server would answer with a 400", async () => {
        for (const taskId of [0, -1, 2.5, NaN, "12" as unknown as number]) {
            const { body } = await ask({ taskContext: { taskId } });
            expect(body, String(taskId)).not.toHaveProperty("task_context");
        }
    });

    it("sends no thread_context or note_context beside it (the server refuses the pair with a 400)", async () => {
        const { body } = await ask({ taskContext: { taskId: 7 } });
        expect(body).not.toHaveProperty("thread_context");
        expect(body).not.toHaveProperty("note_context");
    });
});

describe("the answers to an ask about a task", () => {
    it("404: tells the host once, then ends the turn in OUR sentence, not the server's English", async () => {
        const onTaskNotFound = vi.fn();
        const { h, fn } = await ask(
            { taskContext: { taskId: 7 }, onTaskNotFound },
            json(404, { error: "Task not found." })
        );
        expect(fn).toHaveBeenCalledTimes(1);
        expect(onTaskNotFound).toHaveBeenCalledTimes(1);
        expect(h.onError).toHaveBeenCalledTimes(1);
        const sentence = h.onError.mock.calls[0][0] as string;
        expect(sentence).not.toBe("Task not found.");
        expect(sentence).toMatch(/can't be opened any more/);
        expect(h.onDone).not.toHaveBeenCalled();
    });

    it("404 with no handler still ends the turn in the same sentence", async () => {
        const { h } = await ask({ taskContext: { taskId: 7 } }, json(404, { error: "x" }));
        expect(h.onError.mock.calls[0][0]).toMatch(/can't be opened any more/);
    });

    it("a 404 of an ask with NO task_context is an ordinary failure: the server's words, no gone", async () => {
        const onTaskNotFound = vi.fn();
        const { h } = await ask({ onTaskNotFound }, json(404, { error: "Something else." }));
        expect(onTaskNotFound).not.toHaveBeenCalled();
        expect(h.onError).toHaveBeenCalledWith("Something else.");
    });

    it("400 (a malformed task_context, or one combined with a thread or note) keeps the server's words and is not 'gone'", async () => {
        const onTaskNotFound = vi.fn();
        const { h } = await ask(
            { taskContext: { taskId: 7 }, onTaskNotFound },
            json(400, { error: "task_context must have an integer task_id." })
        );
        expect(onTaskNotFound).not.toHaveBeenCalled();
        expect(h.onError).toHaveBeenCalledWith("task_context must have an integer task_id.");
    });

    it("a 5xx is an ordinary failure, not 'gone'", async () => {
        const onTaskNotFound = vi.fn();
        const { h } = await ask(
            { taskContext: { taskId: 7 }, onTaskNotFound },
            new Response("down", { status: 503 })
        );
        expect(onTaskNotFound).not.toHaveBeenCalled();
        expect(h.onError).toHaveBeenCalledTimes(1);
    });

    it("200 streams as ever: no gone, the session id arrives on done", async () => {
        const onTaskNotFound = vi.fn();
        const { h } = await ask({ taskContext: { taskId: 7 }, onTaskNotFound });
        expect(onTaskNotFound).not.toHaveBeenCalled();
        expect(h.onDone).toHaveBeenCalledWith("s1", "r1", undefined);
    });
});
