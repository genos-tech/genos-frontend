/**
 * `useAgentQA` under undo: the data a turn needs to offer Undo, and the one
 * callback that starts it.
 *
 *   - An approved write's result event carries `undo` but names no run, and the
 *     turn's own run id arrives only with `done`. The run the /decide/ resumed
 *     rides on the tool event, so a turn that is cancelled or fails AFTER the write
 *     (no `done`, ever) still offers Undo for a write that really happened.
 *   - The promoted turn carries the list as data (Spotlight persists turns WITHOUT
 *     their tool events).
 *   - `undoStep` is ONE identity for the life of the hook, and reads the live token.
 *   - The approval card's `undoable` / `undo_reason` reach the state untouched.
 */

import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useAgentQA } from "../features/agentQA";
import { resetUndoStore } from "../features/agentQA/undoStore";
import {
    askAgentStream,
    decideAgent,
    undoAgentStep,
    type PendingApprovalPayload,
} from "../services/agentApi";

vi.mock("../services/agentApi", () => ({
    askAgentStream: vi.fn(async () => {}),
    decideAgent: vi.fn(async () => {}),
    submitAgentFeedback: vi.fn(async () => true),
    undoAgentStep: vi.fn(),
}));

type AskArgs = Parameters<typeof askAgentStream>[0];
type DecideArgs = Parameters<typeof decideAgent>[0];
const lastAsk = (): AskArgs => vi.mocked(askAgentStream).mock.calls.at(-1)![0];
const lastDecide = (): DecideArgs => vi.mocked(decideAgent).mock.calls.at(-1)![0];

const UNTIL = "2026-11-11T00:00:00Z";
const PENDING: PendingApprovalPayload = {
    step: 2,
    tool_name: "update_task",
    arguments: { task_id: "PRJ-1", status: "Done" },
    approval_token: "tok-1",
    run_id: "run-p",
};

const mount = (token = "tok") =>
    renderHook(
        (props: { token: string }) => useAgentQA({ accessToken: props.token, teamId: "t1" }),
        {
            initialProps: { token },
        }
    );

// Ask, pause on a write, approve; the resumed stream is `lastDecide()`.
const approved = (pending: PendingApprovalPayload = PENDING) => {
    const hook = mount();
    act(() => {
        hook.result.current.onAsk("q");
    });
    act(() => lastAsk().onPendingApproval?.(pending));
    act(() => hook.result.current.onApprove());
    return hook;
};

const writeRan = (undo?: unknown, step = 2, tool = "update_task") => {
    act(() => lastDecide().onToolStart?.({ step, tool_name: tool, arguments: {} }));
    act(() =>
        lastDecide().onToolResult?.({
            step,
            tool_name: tool,
            summary: "done",
            ...(undo ? { undo: undo as never } : {}),
        })
    );
};

beforeEach(() => {
    vi.clearAllMocks();
    resetUndoStore();
    vi.mocked(askAgentStream).mockImplementation(async () => {});
    vi.mocked(decideAgent).mockImplementation(async () => {});
});

describe("the tool event of an approved write", () => {
    it("carries `undo`, with the run the approval resumed", () => {
        const { result } = approved();
        writeRan({ step_id: 4711, available_until: UNTIL });
        expect(result.current.ask.toolEvents[0]).toMatchObject({
            status: "done",
            undo: { step_id: 4711, available_until: UNTIL, run_id: "run-p" },
        });
    });

    it("a write whose undo was not stored has none: no Undo is promised", () => {
        const { result } = approved();
        writeRan(undefined);
        expect(result.current.ask.toolEvents[0].status).toBe("done");
        expect("undo" in result.current.ask.toolEvents[0]).toBe(false);
    });
});

describe("the promoted turn", () => {
    it("carries the undo list, run id from the approval (not from `done`)", () => {
        const { result } = approved();
        writeRan({ step_id: 4711, available_until: UNTIL });
        act(() => lastDecide().onDone?.("sess-1", "run-from-done", 900));
        expect(result.current.turns).toHaveLength(1);
        expect(result.current.turns[0].undo).toEqual([
            {
                stepId: 4711,
                step: 2,
                toolName: "update_task",
                runId: "run-p",
                availableUntil: UNTIL,
                undoneAt: null,
            },
        ]);
    });

    it("a turn CANCELLED after the write still offers it (no `done` ever came)", () => {
        const { result } = approved();
        writeRan({ step_id: 4711, available_until: UNTIL });
        act(() => result.current.onCancel());
        expect(result.current.turns[0].runId).toBeNull();
        expect(result.current.turns[0].undo?.[0]).toMatchObject({ stepId: 4711, runId: "run-p" });
    });

    it("a turn that FAILS after the write still offers it", () => {
        const { result } = approved();
        writeRan({ step_id: 4711, available_until: UNTIL });
        act(() => lastDecide().onError?.("stream interrupted"));
        expect(result.current.turns[0].askError).toBe("stream interrupted");
        expect(result.current.turns[0].undo?.[0]).toMatchObject({ stepId: 4711, runId: "run-p" });
    });

    it("keeps several writes, each with its own step", () => {
        const { result } = approved();
        writeRan({ step_id: 4711, available_until: UNTIL }, 2, "create_task");
        writeRan({ step_id: 4712, available_until: UNTIL }, 3, "add_comment");
        act(() => lastDecide().onDone?.("s", "r", 1));
        expect(result.current.turns[0].undo?.map((u) => [u.stepId, u.step, u.toolName])).toEqual([
            [4711, 2, "create_task"],
            [4712, 3, "add_comment"],
        ]);
    });

    it("a turn with no undoable write has no `undo` key (nothing extra is persisted)", () => {
        const { result } = approved();
        writeRan(undefined);
        act(() => lastDecide().onDone?.("s", "r", 1));
        expect("undo" in result.current.turns[0]).toBe(false);
    });

    it("an `undo` on a result that came from /ask/ (no resumed run) takes the turn's run id from `done`", () => {
        const { result } = mount();
        act(() => {
            result.current.onAsk("q");
        });
        act(() => lastAsk().onToolStart?.({ step: 1, tool_name: "update_task", arguments: {} }));
        act(() =>
            lastAsk().onToolResult?.({
                step: 1,
                tool_name: "update_task",
                summary: "x",
                undo: { step_id: 9001, available_until: UNTIL },
            })
        );
        act(() => lastAsk().onDone?.("s", "run-ask", 1));
        expect(result.current.turns[0].undo?.[0]).toMatchObject({
            stepId: 9001,
            runId: "run-ask",
        });
    });
});

describe("the approval card's prediction", () => {
    it("reaches the state untouched", () => {
        const { result } = mount();
        act(() => {
            result.current.onAsk("q");
        });
        act(() =>
            lastAsk().onPendingApproval?.({
                ...PENDING,
                tool_name: "delete_note",
                undoable: false,
                undo_reason: "irreversible_delete",
            })
        );
        expect(result.current.ask.pendingApproval).toMatchObject({
            undoable: false,
            undo_reason: "irreversible_delete",
        });
    });
});

describe("undoStep", () => {
    it("is one identity for the life of the hook, through asks and token changes", () => {
        const { result, rerender } = mount("tok-1");
        const first = result.current.undoStep;
        act(() => {
            result.current.onAsk("q");
        });
        rerender({ token: "tok-2" });
        act(() => lastAsk().onDone?.("s", "r", 1));
        rerender({ token: "tok-3" });
        expect(result.current.undoStep).toBe(first);
    });

    it("starts the request with the LIVE token, and nothing else", async () => {
        vi.mocked(undoAgentStep).mockResolvedValue({
            kind: "refused",
            refusal: {
                code: "network",
                status: 0,
                message: null,
                skipped: [],
                detail: null,
                retryable: true,
            },
        });
        const { result, rerender } = mount("tok-1");
        rerender({ token: "tok-2" });
        await act(async () =>
            result.current.undoStep({ runId: "run-p", stepId: 4711, toolName: "update_task" })
        );
        expect(undoAgentStep).toHaveBeenCalledTimes(1);
        expect(undoAgentStep).toHaveBeenCalledWith({
            runId: "run-p",
            stepId: 4711,
            accessToken: "tok-2",
        });
    });
});
