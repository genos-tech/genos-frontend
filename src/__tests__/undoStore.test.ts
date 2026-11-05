/**
 * The undo store: the state machine every host shares.
 *
 *   - DOUBLE SUBMIT is refused by the state, not by `disabled`: two calls in the
 *     same tick (or from the two mounted copies of one turn) send ONE request.
 *   - a step that was undone, or refused for a reason a retry cannot change (409,
 *     410, 403, 404), sends nothing again; one that failed for the transport
 *     (network, 5xx, 429) can be tried again.
 *   - the app is nudged ONCE per undo, from the request's own completion.
 *   - one step's state does not touch another's, and only its own listeners run.
 *
 * Step ids are not 1: a test that passes on the first id of a fresh table proves
 * nothing about which id went on the wire.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
    getUndoState,
    resetUndoStore,
    runUndo,
    subscribeUndo,
} from "../features/agentQA/undoStore";

const RUN = "run-aaaa";
const A = 4711;
const B = 4712;

const ANSWER = (stepId: number, over: Record<string, unknown> = {}) => ({
    run_id: RUN,
    step_id: stepId,
    tool_name: "update_task",
    undone_at: "2026-11-04T01:02:03Z",
    action: "restored",
    restored: ["status"],
    skipped: [],
    entity: { kind: "task", task_id: 812, project_id: 9, display_id: "PRJ-12" },
    summary: "x",
    ...over,
});

type Reply = { status: number; body: unknown } | "network";

// A fetch whose answers are queued and released by the test, so "in flight" is observable.
const server = () => {
    const calls: string[] = [];
    const queue: Array<{
        resolve: (r: Response) => void;
        reject: (e: Error) => void;
        url: string;
    }> = [];
    vi.stubGlobal(
        "fetch",
        vi.fn(
            (url: string) =>
                new Promise<Response>((resolve, reject) => {
                    calls.push(url);
                    queue.push({ resolve, reject, url });
                })
        )
    );
    const answer = async (reply: Reply) => {
        const next = queue.shift();
        if (!next) throw new Error("no request in flight");
        if (reply === "network") next.reject(new TypeError("Failed to fetch"));
        else
            next.resolve({
                ok: reply.status < 300,
                status: reply.status,
                json: async () => reply.body,
            } as unknown as Response);
        // Let the store's continuation run.
        await new Promise((r) => setTimeout(r, 0));
    };
    return { calls, answer };
};

const events: Array<{ type: string; detail: unknown }> = [];
const TYPES = ["genos:tasks-bulk-changed", "genos:task-touched", "noteChanged"];
let off: Array<() => void> = [];

beforeEach(() => {
    resetUndoStore();
    events.length = 0;
    off = TYPES.map((type) => {
        const handler = (e: Event) => events.push({ type, detail: (e as CustomEvent).detail });
        window.addEventListener(type, handler);
        return () => window.removeEventListener(type, handler);
    });
});
afterEach(() => {
    off.forEach((f) => f());
    vi.unstubAllGlobals();
});

describe("double submit", () => {
    it("two calls in the same tick send ONE request", async () => {
        const s = server();
        const first = runUndo({ runId: RUN, stepId: A, accessToken: "t" });
        const second = runUndo({ runId: RUN, stepId: A, accessToken: "t" });
        expect(s.calls).toHaveLength(1);
        expect(getUndoState(A).status).toBe("undoing");
        await s.answer({ status: 200, body: ANSWER(A) });
        await Promise.all([first, second]);
        expect(s.calls).toHaveLength(1);
    });

    it("a click while the request is in flight is ignored", async () => {
        const s = server();
        void runUndo({ runId: RUN, stepId: A, accessToken: "t" });
        void runUndo({ runId: RUN, stepId: A, accessToken: "t" });
        void runUndo({ runId: RUN, stepId: A, accessToken: "t" });
        expect(s.calls).toHaveLength(1);
        await s.answer({ status: 200, body: ANSWER(A) });
    });

    it("the request names the step: URL ends with its own run and step id", async () => {
        const s = server();
        void runUndo({ runId: RUN, stepId: A, accessToken: "t" });
        expect(s.calls[0].endsWith(`/agent/runs/${RUN}/steps/4711/undo/`)).toBe(true);
        await s.answer({ status: 200, body: ANSWER(A) });
    });

    it("an undone step is never sent again", async () => {
        const s = server();
        const p = runUndo({ runId: RUN, stepId: A, accessToken: "t" });
        await s.answer({ status: 200, body: ANSWER(A) });
        await p;
        expect(getUndoState(A).status).toBe("undone");
        await runUndo({ runId: RUN, stepId: A, accessToken: "t" });
        expect(s.calls).toHaveLength(1);
    });
});

describe("refusals", () => {
    it.each([
        [409, "changed_since"],
        [409, "already_undone"],
        [409, "not_undoable"],
        [410, "expired"],
        [403, "permission_lost"],
        [404, "not_found"],
    ])("%i %s is final: asking again sends nothing", async (status, code) => {
        const s = server();
        const p = runUndo({ runId: RUN, stepId: A, accessToken: "t" });
        await s.answer({ status, body: { error: "no", code } });
        await p;
        const state = getUndoState(A);
        expect(state.status === "refused" && state.refusal.code).toBe(code);
        await runUndo({ runId: RUN, stepId: A, accessToken: "t" });
        expect(s.calls).toHaveLength(1);
    });

    it.each([
        ["a dropped connection", "network" as Reply],
        ["a 503", { status: 503, body: {} } as Reply],
        ["the throttle", { status: 429, body: { detail: "slow down" } } as Reply],
    ])("%s can be tried again, and a success then lands", async (_n, reply) => {
        const s = server();
        const p = runUndo({ runId: RUN, stepId: A, accessToken: "t" });
        await s.answer(reply);
        await p;
        const failed = getUndoState(A);
        expect(failed.status === "refused" && failed.refusal.retryable).toBe(true);

        const again = runUndo({ runId: RUN, stepId: A, accessToken: "t" });
        expect(s.calls).toHaveLength(2);
        await s.answer({ status: 200, body: ANSWER(A) });
        await again;
        expect(getUndoState(A).status).toBe("undone");
    });

    it("a refusal changes nothing in the app: no event fires", async () => {
        const s = server();
        const p = runUndo({ runId: RUN, stepId: A, accessToken: "t" });
        await s.answer({ status: 409, body: { error: "no", code: "changed_since" } });
        await p;
        expect(events).toEqual([]);
    });
});

describe("what the app is told, once", () => {
    const undone = async (answer: unknown) => {
        const s = server();
        const p = runUndo({ runId: RUN, stepId: A, accessToken: "t" });
        await s.answer({ status: 200, body: answer });
        await p;
        // Extra clicks after the fact must not fire it again.
        await runUndo({ runId: RUN, stepId: A, accessToken: "t" });
    };

    it("a restored task: the table is re-read for ITS project, and its activity feed", async () => {
        await undone(ANSWER(A));
        expect(events).toEqual([
            { type: "genos:tasks-bulk-changed", detail: { projectId: 9 } },
            { type: "genos:task-touched", detail: { taskId: 812, kind: "update" } },
        ]);
    });

    it("a deleted task (undoing create_task): the same two, so the open preview reloads", async () => {
        await undone(ANSWER(A, { tool_name: "create_task", action: "deleted", restored: [] }));
        expect(events.map((e) => e.type)).toEqual([
            "genos:tasks-bulk-changed",
            "genos:task-touched",
        ]);
    });

    it("a deleted comment (undoing add_comment): its task re-reads its comments", async () => {
        await undone(
            ANSWER(A, {
                tool_name: "add_comment",
                action: "deleted",
                restored: [],
                entity: {
                    kind: "comment",
                    task_id: 812,
                    project_id: 9,
                    display_id: "PRJ-12",
                    comment_id: 3,
                },
            })
        );
        expect(events).toEqual([
            { type: "genos:task-touched", detail: { taskId: 812, kind: "comment" } },
        ]);
    });

    it("a deleted note (undoing create_note): `noteChanged` with `deleted`, so tabs close", async () => {
        await undone(
            ANSWER(A, {
                tool_name: "create_note",
                action: "deleted",
                restored: [],
                entity: { kind: "note", note_type: "personal", note_id: 55, title: "Plan" },
            })
        );
        expect(events).toEqual([
            {
                type: "noteChanged",
                detail: {
                    note: { note_id: 55, note_type: "personal", title: "Plan", deleted: true },
                    noteFolder: undefined,
                },
            },
        ]);
    });

    it("a note edit undone: `noteChanged` with title and body changed, so it is re-read and pushed", async () => {
        await undone(
            ANSWER(A, {
                tool_name: "update_note",
                restored: ["title", "body"],
                entity: { kind: "note", note_type: "task", note_id: 55, title: "Plan" },
            })
        );
        expect(events).toEqual([
            {
                type: "noteChanged",
                detail: {
                    note: {
                        note_id: 55,
                        note_type: "task",
                        title: "Plan",
                        changed_fields: ["title", "body"],
                    },
                    noteFolder: undefined,
                },
            },
        ]);
    });

    it("an entity this client does not know refreshes nothing, and the undo still counts", async () => {
        await undone(ANSWER(A, { entity: { kind: "sprint", sprint_id: 1 } }));
        expect(events).toEqual([]);
        expect(getUndoState(A).status).toBe("undone");
    });
});

describe("isolation", () => {
    it("one step's state is its own, and only its own listeners run", async () => {
        const s = server();
        const forA = vi.fn();
        const forB = vi.fn();
        const offA = subscribeUndo(A, forA);
        const offB = subscribeUndo(B, forB);
        const p = runUndo({ runId: RUN, stepId: A, accessToken: "t" });
        expect(forA).toHaveBeenCalledTimes(1); // idle -> undoing
        await s.answer({ status: 200, body: ANSWER(A) });
        await p;
        expect(forA).toHaveBeenCalledTimes(2); // -> undone
        expect(forB).not.toHaveBeenCalled();
        expect(getUndoState(B)).toEqual({ status: "idle" });
        offA();
        offB();
    });

    it("the snapshot of an untouched step is ONE object (useSyncExternalStore would loop otherwise)", () => {
        expect(getUndoState(B)).toBe(getUndoState(B));
    });

    it("two steps can be undone at once, each with its own request", async () => {
        const s = server();
        void runUndo({ runId: RUN, stepId: A, accessToken: "t" });
        void runUndo({ runId: RUN, stepId: B, accessToken: "t" });
        expect(s.calls).toHaveLength(2);
        expect(s.calls[0]).toContain("/steps/4711/");
        expect(s.calls[1]).toContain("/steps/4712/");
        await s.answer({ status: 200, body: ANSWER(A) });
        await s.answer({ status: 200, body: ANSWER(B) });
    });
});
