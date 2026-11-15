/**
 * The ask state machine with `dropped_references` on a run that pauses (MIP-1585, genos-api #879):
 * what a paused run says it could not use is now on the approval card's event, the resumed leg's
 * `done` may add to it, and the turn must hold ONE list, the union, whichever of the two (or both)
 * carried it. The transport is mocked; the hook is the real one.
 */

import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useAgentQA, type AgentMentionRef } from "../features/agentQA";
import {
    askAgentStream,
    decideAgent,
    type DroppedReference,
    type PendingApprovalPayload,
} from "../services/agentApi";

vi.mock("../services/agentApi", () => ({
    askAgentStream: vi.fn(async () => {}),
    decideAgent: vi.fn(async () => {}),
    submitAgentFeedback: vi.fn(async () => true),
}));

type AskArgs = Parameters<typeof askAgentStream>[0];
type DecideArgs = Parameters<typeof decideAgent>[0];
const lastAsk = (): AskArgs => {
    const calls = vi.mocked(askAgentStream).mock.calls;
    return calls[calls.length - 1][0];
};
const lastDecide = (): DecideArgs => {
    const calls = vi.mocked(decideAgent).mock.calls;
    return calls[calls.length - 1][0];
};

const MESSAGE: AgentMentionRef = {
    kind: "message",
    messageId: "5b0c3a52-6a31-4f1a-9a30-0e7f4a8f1c11",
    label: "Alice 14:02",
};

const card = (token = "ap-1"): PendingApprovalPayload => ({
    step: 1,
    tool_name: "add_comment",
    arguments: { task_id: 7, body: "hi" },
    approval_token: token,
    run_id: "run-1",
});

type Hook = ReturnType<typeof mount>;
const mount = () => renderHook(() => useAgentQA({ accessToken: "tok", teamId: "team-1" }));

/** Ask, and let the run pause on a card that carries `dropped` (nothing: a card without the field). */
const pause = (result: Hook["result"], dropped?: DroppedReference[], token = "ap-1") => {
    act(() => {
        result.current.onAsk("reply to this", [MESSAGE]);
    });
    act(() => {
        lastAsk().onToolStart?.({ step: 1, tool_name: "add_comment", arguments: {} });
        if (dropped) lastAsk().onPendingApproval?.(card(token), dropped);
        else lastAsk().onPendingApproval?.(card(token));
    });
};

/** Approve the card on screen, then let the resumed leg finish with `dropped`. */
const approveAndFinish = (result: Hook["result"], dropped?: DroppedReference[]) => {
    act(() => {
        result.current.onApprove();
    });
    act(() => {
        lastDecide().onDelta("done it");
        if (dropped) lastDecide().onDone("sess-1", "run-1", 5, dropped);
        else lastDecide().onDone("sess-1", "run-1", 5);
    });
};

beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(askAgentStream).mockImplementation(async () => {});
    vi.mocked(decideAgent).mockImplementation(async () => {});
});

describe("a run that pauses with a dropped message", () => {
    it("holds the kinds on the live turn while the card waits", () => {
        const { result } = mount();
        pause(result, ["message"]);
        expect(result.current.ask.pendingApproval).not.toBeNull();
        expect(result.current.ask.droppedReferences).toEqual(["message"]);
        // Not finished: the turn is still the live one.
        expect(result.current.turns).toHaveLength(0);
    });

    it("keeps the card exactly as it was: the kinds are the run's, not the card's", () => {
        const { result } = mount();
        const pending = card();
        act(() => {
            result.current.onAsk("reply to this", [MESSAGE]);
        });
        act(() => {
            lastAsk().onPendingApproval?.(pending, ["message"]);
        });
        expect(result.current.ask.pendingApproval).toBe(pending);
        expect(result.current.ask.pendingApproval).not.toHaveProperty("dropped_references");
    });

    it("still holds them while the resumed leg streams", () => {
        const { result } = mount();
        pause(result, ["message"]);
        act(() => {
            result.current.onApprove();
        });
        expect(result.current.ask.isStreaming).toBe(true);
        expect(result.current.ask.droppedReferences).toEqual(["message"]);
    });

    it("says it once when the card and the resumed done carry the same list", () => {
        const { result } = mount();
        pause(result, ["message"]);
        approveAndFinish(result, ["message"]);
        expect(result.current.turns).toHaveLength(1);
        expect(result.current.turns[0].droppedReferences).toEqual(["message"]);
    });

    it("says it once for two kinds carried by both", () => {
        const { result } = mount();
        pause(result, ["selection", "message"]);
        approveAndFinish(result, ["selection", "message"]);
        expect(result.current.turns[0].droppedReferences).toEqual(["selection", "message"]);
    });

    it("keeps what the card said when the resumed done carries nothing", () => {
        // `AGENT_RESUME_KEEPS_BLOCKS` off on the server: nothing is kept at a pause, so the resumed
        // `done` carries nothing, and the card is the only place the ask's drops were said.
        const { result } = mount();
        pause(result, ["message"]);
        approveAndFinish(result);
        expect(result.current.turns[0].droppedReferences).toEqual(["message"]);
    });

    it("does the same after a reject", () => {
        const { result } = mount();
        pause(result, ["message"]);
        act(() => {
            result.current.onReject();
        });
        act(() => {
            lastDecide().onDone("sess-1", "run-1", 5, ["message"]);
        });
        expect(result.current.turns[0].droppedReferences).toEqual(["message"]);
    });
});

describe("a resumed leg that dropped a task", () => {
    it("adds the task to what the card said", () => {
        const { result } = mount();
        pause(result, ["message"]);
        approveAndFinish(result, ["message", "task"]);
        expect(result.current.turns[0].droppedReferences).toEqual(["message", "task"]);
    });

    it("adds it even when the card said nothing", () => {
        const { result } = mount();
        pause(result);
        expect(result.current.ask.droppedReferences).toBeUndefined();
        approveAndFinish(result, ["task"]);
        expect(result.current.turns[0].droppedReferences).toEqual(["task"]);
    });

    it("adds it to a DIFFERENT kind on the card, keeping both", () => {
        const { result } = mount();
        pause(result, ["selection"]);
        approveAndFinish(result, ["task"]);
        expect(result.current.turns[0].droppedReferences).toEqual(["selection", "task"]);
    });

    it("keeps a turn that ended with no answer and only this to say", () => {
        const { result } = mount();
        act(() => {
            result.current.onAsk("do it");
        });
        act(() => {
            lastAsk().onPendingApproval?.(card());
        });
        act(() => {
            result.current.onApprove();
        });
        act(() => {
            lastDecide().onDone("sess-1", "run-1", 1, ["task"]);
        });
        expect(result.current.turns).toHaveLength(1);
        expect(result.current.turns[0].droppedReferences).toEqual(["task"]);
    });
});

describe("a leg that pauses again", () => {
    it("merges the second card's list into the first's", () => {
        const { result } = mount();
        pause(result, ["message"]);
        act(() => {
            result.current.onApprove();
        });
        act(() => {
            lastDecide().onPendingApproval?.(card("ap-2"), ["message", "task"]);
        });
        expect(result.current.ask.pendingApproval?.approval_token).toBe("ap-2");
        expect(result.current.ask.droppedReferences).toEqual(["message", "task"]);
        act(() => {
            result.current.onApprove();
        });
        act(() => {
            lastDecide().onDone("sess-1", "run-1", 5, ["message", "task"]);
        });
        expect(result.current.turns[0].droppedReferences).toEqual(["message", "task"]);
    });
});

describe("a second card that says something else", () => {
    it("is added to what the first said, not put in its place", () => {
        // The server repeats the whole list on a second card, so this is the union in its plainest
        // form: the client holds whatever any event said, whichever came last.
        const { result } = mount();
        pause(result, ["selection"]);
        act(() => {
            result.current.onApprove();
        });
        act(() => {
            lastDecide().onPendingApproval?.(card("ap-2"), ["task"]);
        });
        expect(result.current.ask.droppedReferences).toEqual(["selection", "task"]);
    });

    it("and a second card with no field leaves what the first said", () => {
        const { result } = mount();
        pause(result, ["message"]);
        act(() => {
            result.current.onApprove();
        });
        act(() => {
            lastDecide().onPendingApproval?.(card("ap-2"));
        });
        expect(result.current.ask.droppedReferences).toEqual(["message"]);
    });
});

describe("nothing dropped, or the server flag off", () => {
    it("a card with no field and a done with none: no droppedReferences anywhere", () => {
        const { result } = mount();
        pause(result);
        expect(result.current.ask).not.toHaveProperty("droppedReferences");
        approveAndFinish(result);
        expect(result.current.turns).toHaveLength(1);
        expect(result.current.turns[0]).not.toHaveProperty("droppedReferences");
    });

    it("an empty list is no list", () => {
        const { result } = mount();
        pause(result, []);
        expect(result.current.ask.droppedReferences).toBeUndefined();
        approveAndFinish(result, []);
        expect(result.current.turns[0]).not.toHaveProperty("droppedReferences");
    });

    it("the next ask starts clean: the note belongs to the run it came from", () => {
        const { result } = mount();
        pause(result, ["message"]);
        approveAndFinish(result, ["message", "task"]);
        act(() => {
            result.current.onAsk("two");
        });
        expect(result.current.ask.droppedReferences).toBeUndefined();
        act(() => {
            lastAsk().onDelta("an answer");
            lastAsk().onDone("sess-1", "run-2", 1);
        });
        expect(result.current.turns[1]).not.toHaveProperty("droppedReferences");
    });
});

describe("the card is refused, cancelled or late", () => {
    it("a refused edit (422) puts the card back and keeps the kinds", () => {
        const { result } = mount();
        pause(result, ["message"]);
        act(() => {
            result.current.onApprove({ body: "x".repeat(10) });
        });
        act(() => {
            lastDecide().onEditsRejected?.({ message: "no", fieldErrors: { body: "too short" } });
        });
        expect(result.current.ask.pendingApproval).not.toBeNull();
        expect(result.current.ask.droppedReferences).toEqual(["message"]);
    });

    it("Cancel while the card waits keeps the note on the turn it keeps, like everything else on it", () => {
        const { result } = mount();
        pause(result, ["message"]);
        act(() => {
            result.current.onCancel();
        });
        expect(result.current.turns).toHaveLength(1);
        expect(result.current.turns[0].droppedReferences).toEqual(["message"]);
        expect(result.current.ask.droppedReferences).toBeUndefined();
    });

    it("a resumed leg that fails keeps the note on the turn it ends, beside the error", () => {
        const { result } = mount();
        pause(result, ["message"]);
        act(() => {
            result.current.onApprove();
        });
        act(() => {
            lastDecide().onError("the connection dropped");
        });
        expect(result.current.turns).toHaveLength(1);
        expect(result.current.turns[0].askError).toBe("the connection dropped");
        expect(result.current.turns[0].droppedReferences).toEqual(["message"]);
    });

    it("a card event that arrives after its turn was left does not reach the next turn", () => {
        const { result } = mount();
        act(() => {
            result.current.onAsk("one");
        });
        const stale = lastAsk();
        act(() => {
            result.current.onCancel();
        });
        act(() => {
            result.current.onAsk("two");
        });
        act(() => {
            stale.onPendingApproval?.(card("ap-old"), ["message"]);
        });
        expect(result.current.ask.droppedReferences).toBeUndefined();
        expect(result.current.ask.pendingApproval).toBeNull();
    });

    it("a late done of a left turn does not reach the next turn either", () => {
        const { result } = mount();
        pause(result, ["message"]);
        act(() => {
            result.current.onApprove();
        });
        const staleDecide = lastDecide();
        act(() => {
            result.current.onCancel();
        });
        act(() => {
            result.current.onAsk("two");
        });
        act(() => {
            staleDecide.onDone("sess-1", "run-1", 5, ["message", "task"]);
        });
        expect(result.current.ask.droppedReferences).toBeUndefined();
    });
});
