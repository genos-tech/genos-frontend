/**
 * The ask state machine with a selected passage and a message (MIP-1058): what `onAsk` puts on the
 * request, what the finished turn keeps so Retry re-sends it verbatim, and where the `done` event's
 * `dropped_references` end up. The transport is mocked; `askSelection` is the real one.
 */

import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useAgentQA, type AgentMentionRef } from "../features/agentQA";
import { makeAskSelection, SELECTED_TEXT_MAX } from "../features/agentQA/askSelection";
import { askAgentStream } from "../services/agentApi";

vi.mock("../services/agentApi", () => ({
    askAgentStream: vi.fn(async () => {}),
    decideAgent: vi.fn(async () => {}),
    submitAgentFeedback: vi.fn(async () => true),
}));

type AskArgs = Parameters<typeof askAgentStream>[0];
const lastAsk = (): AskArgs => {
    const calls = vi.mocked(askAgentStream).mock.calls;
    return calls[calls.length - 1][0];
};

const UUID = "5b0c3a52-6a31-4f1a-9a30-0e7f4a8f1c11";
const MESSAGE: AgentMentionRef = { kind: "message", messageId: UUID, label: "Alice 14:02" };
const SELECTION = makeAskSelection("the passage Alice wrote", MESSAGE)!;

const mount = () => renderHook(() => useAgentQA({ accessToken: "tok", teamId: "team-1" }));

beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(askAgentStream).mockImplementation(async () => {});
});

describe("onAsk with a selection", () => {
    it("puts selected_text and selected_from on the request", () => {
        const { result } = mount();
        act(() => {
            result.current.onAsk("what does this mean?", [MESSAGE], undefined, SELECTION);
        });
        const sent = lastAsk();
        expect(sent.selectedText).toBe("the passage Alice wrote");
        expect(sent.selectedFrom).toEqual({
            type: "message",
            message_id: UUID,
            label: "Alice 14:02",
        });
        expect(sent.mentions).toEqual([
            { type: "message", message_id: UUID, label: "Alice 14:02" },
        ]);
    });

    it("an ordinary ask carries neither key", () => {
        const { result } = mount();
        act(() => {
            result.current.onAsk("hello");
        });
        expect(lastAsk()).not.toHaveProperty("selectedText");
        expect(lastAsk()).not.toHaveProperty("selectedFrom");
        expect(result.current.ask.askedSelection).toBeUndefined();
    });

    it("a blank selection is no selection: nothing is sent and nothing is kept", () => {
        const { result } = mount();
        act(() => {
            result.current.onAsk("hello", undefined, undefined, { text: "   ", from: MESSAGE });
        });
        expect(lastAsk()).not.toHaveProperty("selectedText");
        expect(lastAsk()).not.toHaveProperty("selectedFrom");
        expect(result.current.ask.askedSelection).toBeUndefined();
    });

    it("sends no more than the server reads, and keeps what it sent", () => {
        const { result } = mount();
        act(() => {
            result.current.onAsk("hello", undefined, undefined, {
                text: "q".repeat(SELECTED_TEXT_MAX + 100),
            });
        });
        expect(Array.from(lastAsk().selectedText ?? "")).toHaveLength(SELECTED_TEXT_MAX);
        expect(Array.from(result.current.ask.askedSelection?.text ?? "")).toHaveLength(
            SELECTED_TEXT_MAX
        );
    });
});

describe("the finished turn and Retry", () => {
    const finish = (_result: { current: ReturnType<typeof useAgentQA> }) => {
        act(() => {
            lastAsk().onDelta("an answer");
            lastAsk().onDone("sess-1", "run-1");
        });
    };

    it("keeps the selection on the turn, and a retry re-sends it verbatim", () => {
        const { result } = mount();
        act(() => {
            result.current.onAsk("what does this mean?", [MESSAGE], undefined, SELECTION);
        });
        finish(result);
        const turn = result.current.turns[0];
        expect(turn.selection).toEqual(SELECTION);
        expect(turn.mentions).toEqual([MESSAGE]);

        // What the hosts do on "Ask again": the turn's own mentions and selection.
        act(() => {
            result.current.onAsk(
                turn.askedQuery,
                turn.mentions,
                undefined,
                turn.selection ?? null
            );
        });
        expect(lastAsk().selectedText).toBe("the passage Alice wrote");
        expect(lastAsk().selectedFrom).toEqual({
            type: "message",
            message_id: UUID,
            label: "Alice 14:02",
        });
        expect(lastAsk().mentions).toEqual([
            { type: "message", message_id: UUID, label: "Alice 14:02" },
        ]);
    });

    it("a retry of a turn that had no selection sends none", () => {
        const { result } = mount();
        act(() => {
            result.current.onAsk("first", undefined, undefined, SELECTION);
        });
        finish(result);
        act(() => {
            result.current.onAsk("second");
        });
        finish(result);
        const second = result.current.turns[1];
        expect(second.selection).toBeUndefined();
        act(() => {
            result.current.onAsk(second.askedQuery, second.mentions, undefined, null);
        });
        expect(lastAsk()).not.toHaveProperty("selectedText");
    });

    it("a turn that failed still keeps the selection, so Retry can send it", () => {
        const { result } = mount();
        act(() => {
            result.current.onAsk("what?", undefined, undefined, SELECTION);
        });
        act(() => {
            lastAsk().onError("boom");
        });
        expect(result.current.turns[0].selection).toEqual(SELECTION);
    });
});

describe("what the turn keeps of the selection", () => {
    it("is what was sent: a person as the source is not kept, the cut text is", () => {
        const { result } = mount();
        const person: AgentMentionRef = { kind: "user", userId: "u1", label: "Alice" };
        act(() => {
            result.current.onAsk("what?", undefined, undefined, {
                text: "  the passage  ",
                from: person,
                truncated: true,
            });
        });
        expect(lastAsk().selectedText).toBe("the passage");
        expect(lastAsk()).not.toHaveProperty("selectedFrom");
        expect(result.current.ask.askedSelection).toEqual({
            text: "the passage",
            truncated: true,
        });
    });

    it("keeps the source that was sent", () => {
        const { result } = mount();
        act(() => {
            result.current.onAsk("what?", undefined, undefined, SELECTION);
        });
        expect(result.current.ask.askedSelection).toEqual(SELECTION);
    });
});

describe("done.dropped_references", () => {
    it("keeps a turn that ended with no answer, so the note can say what could not be used", () => {
        const { result } = mount();
        act(() => {
            result.current.onAsk("what?", [MESSAGE]);
        });
        act(() => {
            lastAsk().onDone("sess-1", "run-1", 1, ["message"]);
        });
        expect(result.current.turns).toHaveLength(1);
        expect(result.current.turns[0].droppedReferences).toEqual(["message"]);
    });

    it("still drops a turn that ended with nothing and nothing dropped", () => {
        const { result } = mount();
        act(() => {
            result.current.onAsk("what?");
        });
        act(() => {
            lastAsk().onDone("sess-1", "run-1", 1);
        });
        expect(result.current.turns).toHaveLength(0);
    });

    it("lands on the finished turn", () => {
        const { result } = mount();
        act(() => {
            result.current.onAsk("what?", [MESSAGE], undefined, SELECTION);
        });
        act(() => {
            lastAsk().onDelta("an answer");
            lastAsk().onDone("sess-1", "run-1", 12, ["selected_from", "message"]);
        });
        expect(result.current.turns[0].droppedReferences).toEqual(["selected_from", "message"]);
    });

    it("is not on a turn that dropped nothing", () => {
        const { result } = mount();
        act(() => {
            result.current.onAsk("what?");
        });
        act(() => {
            lastAsk().onDelta("an answer");
            lastAsk().onDone("sess-1", "run-1", 12);
        });
        expect(result.current.turns[0]).not.toHaveProperty("droppedReferences");
        expect(result.current.turns[0]).not.toHaveProperty("selection");
    });

    it("the next ask starts clean: the note belongs to the run it came from", () => {
        const { result } = mount();
        act(() => {
            result.current.onAsk("one");
        });
        act(() => {
            lastAsk().onDelta("an answer");
            lastAsk().onDone("sess-1", "run-1", 1, ["message"]);
        });
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
