/**
 * `useAgentQA.decide` under edit before approve: the ONE decision path, now
 * carrying the person's edits, and the state machine around a 422.
 *
 * The turn swaps the card for the spinner the moment Approve is clicked, so a
 * 422 (the edits cannot be applied, nothing was approved) has to GIVE THE CARD
 * BACK: the same pending approval, the sentence per path, and what was typed.
 * The one-shot dedupe must let go too, or the person could never fix a typo.
 */

import { StrictMode } from "react";
import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useAgentQA, type UseAgentQAArgs } from "../features/agentQA";
import { askAgentStream, decideAgent, type PendingApprovalPayload } from "../services/agentApi";

vi.mock("../services/agentApi", () => ({
    askAgentStream: vi.fn(async () => {}),
    decideAgent: vi.fn(async () => {}),
    submitAgentFeedback: vi.fn(async () => true),
}));

type AskArgs = Parameters<typeof askAgentStream>[0];
type DecideArgs = Parameters<typeof decideAgent>[0];

const lastAsk = (): AskArgs => vi.mocked(askAgentStream).mock.calls.at(-1)![0];
const lastDecide = (): DecideArgs => vi.mocked(decideAgent).mock.calls.at(-1)![0];

const PENDING: PendingApprovalPayload = {
    step: 1,
    tool_name: "update_task",
    arguments: { task_id: "PRJ-1", title: "Old title", due_date: "2026-11-20" },
    editable: ["title", "due_date"],
    approval_token: "tok-1",
    run_id: "run-p",
};

const ERRORS = { due_date: "Due date: that date doesn't exist." };

const mount = (strict = false, args: Partial<UseAgentQAArgs> = {}) =>
    renderHook(() => useAgentQA({ accessToken: "tok", teamId: "team-1", ...args }), {
        wrapper: strict ? StrictMode : undefined,
    });

const pause = (strict = false) => {
    const hook = mount(strict);
    act(() => {
        hook.result.current.onAsk("q");
    });
    act(() => lastAsk().onPendingApproval?.(PENDING));
    return hook;
};

const refuse = (errors: Record<string, string> = ERRORS) =>
    act(() =>
        lastDecide().onEditsRejected?.({
            message: "Some changes can't be applied.",
            fieldErrors: errors,
        })
    );

beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(askAgentStream).mockImplementation(async () => {});
    vi.mocked(decideAgent).mockImplementation(async () => {});
});

describe("what an approve sends", () => {
    it("carries the edits the card hands over, and only those", () => {
        const { result } = pause();
        act(() => result.current.onApprove({ title: "New title" }));
        expect(decideAgent).toHaveBeenCalledTimes(1);
        expect(lastDecide()).toMatchObject({
            decision: "approve",
            editedArgs: { title: "New title" },
            runId: "run-p",
            approvalToken: "tok-1",
        });
    });

    it("a plain approve has no `editedArgs` at all", () => {
        const { result } = pause();
        act(() => result.current.onApprove());
        expect(lastDecide()).not.toHaveProperty("editedArgs");
    });

    it("an empty patch is a plain approve", () => {
        const { result } = pause();
        act(() => result.current.onApprove({}));
        expect(lastDecide()).not.toHaveProperty("editedArgs");
    });

    it("a click event is not an edit (a card that wired onClick={onApprove} must not send it)", () => {
        const { result } = pause();
        act(() =>
            (result.current.onApprove as unknown as (e: unknown) => void)(
                new MouseEvent("click", { bubbles: true })
            )
        );
        expect(lastDecide()).not.toHaveProperty("editedArgs");
    });

    it("a reject never carries edits, whatever it is handed", () => {
        const { result } = pause();
        act(() => (result.current.onReject as unknown as (e: unknown) => void)({ title: "x" }));
        expect(lastDecide()).toMatchObject({ decision: "reject" });
        expect(lastDecide()).not.toHaveProperty("editedArgs");
    });

    it("sends one decision under StrictMode", () => {
        const { result } = pause(true);
        act(() => result.current.onApprove({ title: "New title" }));
        expect(decideAgent).toHaveBeenCalledTimes(1);
    });

    it("flips to streaming at once, as before: the card is replaced by the spinner", () => {
        const { result } = pause();
        act(() => result.current.onApprove({ title: "New title" }));
        expect(result.current.ask).toMatchObject({ isStreaming: true, pendingApproval: null });
    });
});

describe("a 422: the edits cannot be applied", () => {
    it("gives the SAME pending approval back, with the sentences and the refused patch", () => {
        const { result } = pause();
        act(() => result.current.onApprove({ due_date: "2026-02-30" }));
        expect(result.current.ask.pendingApproval).toBeNull();
        refuse();
        expect(result.current.ask.pendingApproval).toBe(PENDING);
        expect(result.current.ask).toMatchObject({
            isStreaming: false,
            approvalFieldErrors: ERRORS,
            approvalEdits: { due_date: "2026-02-30" },
        });
    });

    it("is not an error turn: nothing is promoted, no error is set, the run is not over", () => {
        const onRunComplete = vi.fn();
        const hook = mount(false, { onRunComplete });
        act(() => {
            hook.result.current.onAsk("q");
        });
        act(() => lastAsk().onPendingApproval?.(PENDING));
        act(() => hook.result.current.onApprove({ due_date: "2026-02-30" }));
        refuse();
        expect(hook.result.current.turns).toEqual([]);
        expect(hook.result.current.ask.askError).toBeNull();
        expect(onRunComplete).not.toHaveBeenCalled();
    });

    it("lets the person retry: the dedupe is released, and the retry carries the fixed edits", () => {
        const { result } = pause();
        act(() => result.current.onApprove({ due_date: "2026-02-30" }));
        refuse();
        act(() => result.current.onApprove({ due_date: "2026-02-28" }));
        expect(decideAgent).toHaveBeenCalledTimes(2);
        expect(lastDecide()).toMatchObject({
            decision: "approve",
            approvalToken: "tok-1",
            editedArgs: { due_date: "2026-02-28" },
        });
        // The errors went with the attempt.
        expect(result.current.ask).toMatchObject({
            pendingApproval: null,
            approvalFieldErrors: null,
            approvalEdits: null,
            isStreaming: true,
        });
    });

    it("the person can give up on the edits and approve as proposed, or reject", () => {
        const a = pause();
        act(() => a.result.current.onApprove({ due_date: "2026-02-30" }));
        refuse();
        act(() => a.result.current.onApprove());
        expect(lastDecide()).not.toHaveProperty("editedArgs");

        vi.clearAllMocks();
        const b = pause();
        act(() => b.result.current.onApprove({ due_date: "2026-02-30" }));
        refuse();
        act(() => b.result.current.onReject());
        expect(lastDecide()).toMatchObject({ decision: "reject" });
        expect(lastDecide()).not.toHaveProperty("editedArgs");
    });

    it("the dedupe still holds BEFORE the 422: a double click sends one request", () => {
        const { result } = pause();
        act(() => {
            result.current.onApprove({ title: "A" });
            result.current.onApprove({ title: "B" });
        });
        expect(decideAgent).toHaveBeenCalledTimes(1);
        expect(lastDecide().editedArgs).toEqual({ title: "A" });
    });

    it("and holds again after a refused attempt is retried", () => {
        const { result } = pause();
        act(() => result.current.onApprove({ title: "" }));
        refuse({ title: "Title can't be empty." });
        act(() => {
            result.current.onApprove({ title: "Fixed" });
            result.current.onApprove({ title: "Fixed again" });
        });
        expect(decideAgent).toHaveBeenCalledTimes(2);
    });

    it("a 422 that arrives after Cancel is dropped: the run is gone, no card comes back", () => {
        const { result } = pause();
        act(() => result.current.onApprove({ title: "" }));
        const stale = lastDecide();
        act(() => result.current.onCancel());
        act(() => stale.onEditsRejected?.({ message: "m", fieldErrors: { title: "empty" } }));
        expect(result.current.ask.pendingApproval).toBeNull();
        expect(result.current.ask.approvalFieldErrors ?? null).toBeNull();
    });

    it("a 422 for a superseded request is dropped (a newer decision is in flight)", () => {
        const { result } = pause();
        act(() => result.current.onApprove({ title: "" }));
        const first = lastDecide();
        refuse({ title: "empty" });
        act(() => result.current.onApprove({ title: "ok" }));
        // The first request's late answer must not undo the second.
        act(() => first.onEditsRejected?.({ message: "m", fieldErrors: { title: "empty" } }));
        expect(result.current.ask.pendingApproval).toBeNull();
        expect(result.current.ask.isStreaming).toBe(true);
    });

    it("a new pause starts with no errors and no draft", () => {
        const { result } = pause();
        act(() => result.current.onApprove({ title: "" }));
        refuse({ title: "empty" });
        act(() => result.current.onApprove({ title: "ok" }));
        act(() => lastDecide().onPendingApproval?.({ ...PENDING, approval_token: "tok-2" }));
        expect(result.current.ask).toMatchObject({
            approvalFieldErrors: null,
            approvalEdits: null,
        });
        expect(result.current.ask.pendingApproval?.approval_token).toBe("tok-2");
    });

    it("a new turn starts with no errors and no draft", () => {
        const { result } = pause();
        act(() => result.current.onApprove({ title: "" }));
        refuse({ title: "empty" });
        act(() => result.current.onReject());
        act(() => lastDecide().onDone("sess-1", "run-1"));
        act(() => {
            result.current.onAsk("again");
        });
        expect(result.current.ask.approvalFieldErrors ?? null).toBeNull();
        expect(result.current.ask.approvalEdits ?? null).toBeNull();
    });
});

describe("the events of an edited approve", () => {
    const approveWithEdit = () => {
        const hook = pause();
        act(() => hook.result.current.onApprove({ title: "New title" }));
        // The resumed leg announces the effective call, then its result.
        act(() =>
            lastDecide().onToolStart?.({
                step: 1,
                tool_name: "update_task",
                arguments: { task_id: "PRJ-1", title: "New title", due_date: "2026-11-20" },
            })
        );
        return hook;
    };

    it("the strip shows the effective arguments and, on the result, the edited mark and the values", () => {
        const { result } = approveWithEdit();
        act(() =>
            lastDecide().onToolResult?.({
                step: 1,
                tool_name: "update_task",
                summary: "Updated PRJ-1",
                edited: true,
                edited_arguments: { title: "New title" },
            })
        );
        expect(result.current.ask.toolEvents).toEqual([
            expect.objectContaining({
                step: 1,
                status: "done",
                summary: "Updated PRJ-1",
                arguments: expect.objectContaining({ title: "New title" }),
                edited: true,
                edited_arguments: { title: "New title" },
            }),
        ]);
    });

    it("a plain approve's event has no edited mark", () => {
        const hook = pause();
        act(() => hook.result.current.onApprove());
        act(() =>
            lastDecide().onToolStart?.({ step: 1, tool_name: "update_task", arguments: {} })
        );
        act(() =>
            lastDecide().onToolResult?.({ step: 1, tool_name: "update_task", summary: "ok" })
        );
        expect(hook.result.current.ask.toolEvents[0]).not.toHaveProperty("edited");
        expect(hook.result.current.ask.toolEvents[0]).not.toHaveProperty("edited_arguments");
    });

    it("the mark is on the promoted turn too, once the stream is done", () => {
        const { result } = approveWithEdit();
        act(() =>
            lastDecide().onToolResult?.({
                step: 1,
                tool_name: "update_task",
                summary: "Updated PRJ-1",
                edited: true,
                edited_arguments: { title: "New title" },
            })
        );
        act(() => lastDecide().onDone("sess-1", "run-1"));
        expect(result.current.turns[0].toolEvents[0]).toMatchObject({
            edited: true,
            edited_arguments: { title: "New title" },
        });
    });

    it("an error after an edit (e.g. a tag that does not exist) is an ordinary tool error", () => {
        const { result } = approveWithEdit();
        act(() =>
            lastDecide().onToolError?.({
                step: 1,
                tool_name: "update_task",
                error: "Unknown tag: nope",
            })
        );
        expect(result.current.ask.toolEvents[0]).toMatchObject({
            status: "error",
            error: "Unknown tag: nope",
        });
        expect(result.current.ask.toolEvents[0]).not.toHaveProperty("edited");
    });
});
