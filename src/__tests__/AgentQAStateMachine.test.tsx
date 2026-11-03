/**
 * `useAgentQA` is the one ask/answer state machine behind the thread ask,
 * the note ask and Spotlight. These tests pin the contract of the options
 * that let those surfaces differ (and the drift fixes made when Spotlight's
 * private copy of the machine was folded in).
 */

import { StrictMode } from "react";
import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useAgentQA, type AgentMentionRef, type UseAgentQAArgs } from "../features/agentQA";
import { askAgentStream, decideAgent, type PendingApprovalPayload } from "../services/agentApi";

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

const PENDING: PendingApprovalPayload = {
    step: 1,
    tool_name: "update_task",
    arguments: {},
    approval_token: "tok-1",
    run_id: "run-p",
};
const MENTION: AgentMentionRef = { kind: "task", taskId: 7, label: "Fix login" };

const mount = (args: Partial<UseAgentQAArgs> = {}, strict = false) =>
    renderHook(() => useAgentQA({ accessToken: "tok", teamId: "team-1", ...args }), {
        wrapper: strict ? StrictMode : undefined,
    });

const answered = (result: { current: ReturnType<typeof useAgentQA> }, q = "q") => {
    act(() => {
        result.current.onAsk(q);
    });
    act(() => {
        lastAsk().onDelta("a");
        lastAsk().onDone("sess-1", "run-1");
    });
};

beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(askAgentStream).mockImplementation(async () => {});
    vi.mocked(decideAgent).mockImplementation(async () => {});
});

describe("onAsk", () => {
    it("returns true when it dispatched a request and false when it ignored the ask", () => {
        const { result } = mount();
        let started: boolean | undefined;
        act(() => {
            started = result.current.onAsk("   ");
        });
        expect(started).toBe(false);
        act(() => {
            started = result.current.onAsk("one");
        });
        expect(started).toBe(true);
        // A run is in flight now.
        act(() => {
            started = result.current.onAsk("two");
        });
        expect(started).toBe(false);
        expect(askAgentStream).toHaveBeenCalledTimes(1);
    });

    it("does not put `newConversation` on the request unless the conversation was cleared", () => {
        const { result } = mount();
        answered(result);
        act(() => {
            result.current.onAsk("two");
        });
        expect(lastAsk()).not.toHaveProperty("newConversation");
        act(() => {
            lastAsk().onDone("sess-1", "run-2");
        });
        act(() => result.current.clearConversation());
        act(() => {
            result.current.onAsk("fresh");
        });
        expect(lastAsk().newConversation).toBe(true);
    });
});

describe("noTeamError option", () => {
    it("unset (thread / note): an ask with no team is ignored silently", () => {
        const { result } = mount({ teamId: null });
        let started = true;
        act(() => {
            started = result.current.onAsk("hello");
        });
        expect(started).toBe(false);
        expect(askAgentStream).not.toHaveBeenCalled();
        expect(result.current.ask.askError).toBeNull();
        expect(result.current.ask.turnId).toBe(0);
    });

    it("set (Spotlight): the message becomes the turn's error and nothing is sent", () => {
        const { result } = mount({ teamId: null, noTeamError: "No team selected." });
        let started = true;
        act(() => {
            started = result.current.onAsk("hello");
        });
        expect(started).toBe(false);
        expect(askAgentStream).not.toHaveBeenCalled();
        expect(result.current.ask).toMatchObject({
            askedQuery: "hello",
            askError: "No team selected.",
            isStreaming: false,
            turnId: 1,
        });
    });

    it("an empty question or a run in flight still wins over the no-team message", () => {
        const { result } = mount({ teamId: null, noTeamError: "No team selected." });
        act(() => {
            result.current.onAsk("  ");
        });
        expect(result.current.ask.askError).toBeNull();
    });
});

describe("resumeVisibleSession option", () => {
    it("off (default): never sends resume", () => {
        const { result } = mount();
        answered(result);
        act(() => {
            result.current.onAsk("follow up");
        });
        expect(lastAsk().sessionId).toBe("sess-1");
        expect(lastAsk()).not.toHaveProperty("resume");
    });

    it("on: sends resume only once there are completed turns under a live session", () => {
        const { result } = mount({ resumeVisibleSession: true });
        act(() => {
            result.current.onAsk("first");
        });
        expect(lastAsk()).not.toHaveProperty("resume");
        act(() => {
            lastAsk().onDelta("a");
            lastAsk().onDone("sess-1", "run-1");
        });
        act(() => {
            result.current.onAsk("second");
        });
        expect(lastAsk().resume).toBe(true);
    });

    it("on: a seeded session with no visible turns does not send it", () => {
        const { result } = mount({ resumeVisibleSession: true });
        act(() => result.current.reset({ sessionId: "sess-x", turns: [] }));
        act(() => {
            result.current.onAsk("first");
        });
        expect(lastAsk().sessionId).toBe("sess-x");
        expect(lastAsk()).not.toHaveProperty("resume");
    });
});

describe("onRunComplete", () => {
    it("reports elapsed time, citation count and the caller's meta on a clean finish", () => {
        const onRunComplete = vi.fn();
        const { result } = mount({ onRunComplete });
        act(() => {
            result.current.onAsk("q", undefined, { origin: "starter" });
        });
        act(() => {
            lastAsk().onSources([{ id: "a" }, { id: "b" }] as never);
            lastAsk().onDelta("answer");
            lastAsk().onDone("sess-1", "run-1", 3100);
        });
        expect(onRunComplete).toHaveBeenCalledTimes(1);
        expect(onRunComplete.mock.calls[0][0]).toEqual({
            turnId: 1,
            askedQuery: "q",
            answer: "answer",
            runId: "run-1",
            error: null,
            elapsedMs: 3100,
            sourceCount: 2,
            meta: { origin: "starter" },
        });
    });

    it("reports an error finish once; a later done does not fire it again", () => {
        const onRunComplete = vi.fn();
        const { result } = mount({ onRunComplete });
        act(() => {
            result.current.onAsk("q");
        });
        act(() => {
            lastAsk().onError("bad");
            lastAsk().onDone("sess-1", "run-1", 10);
        });
        expect(onRunComplete).toHaveBeenCalledTimes(1);
        expect(onRunComplete.mock.calls[0][0]).toMatchObject({
            error: "bad",
            elapsedMs: null,
            sourceCount: 0,
        });
    });

    it("stays silent for a cancelled run", () => {
        const onRunComplete = vi.fn();
        const { result } = mount({ onRunComplete });
        act(() => {
            result.current.onAsk("q");
        });
        act(() => lastAsk().onDelta("partial"));
        act(() => result.current.onCancel());
        act(() => lastAsk().onDone("sess-1", "run-1"));
        expect(onRunComplete).not.toHaveBeenCalled();
    });

    it("a resumed (approved) run reports once, at the end of the resumed stream", () => {
        const onRunComplete = vi.fn();
        const { result } = mount({ onRunComplete });
        act(() => {
            result.current.onAsk("q");
        });
        act(() => lastAsk().onPendingApproval?.(PENDING));
        expect(onRunComplete).not.toHaveBeenCalled();
        act(() => result.current.onApprove());
        act(() => lastDecide().onDone("sess-1", "run-9", 900));
        expect(onRunComplete).toHaveBeenCalledTimes(1);
        expect(onRunComplete.mock.calls[0][0]).toMatchObject({ runId: "run-9", elapsedMs: 900 });
    });
});

describe("decide (approve / reject)", () => {
    const pause = (strict = false) => {
        const hook = mount({}, strict);
        act(() => {
            hook.result.current.onAsk("q");
        });
        act(() => lastAsk().onPendingApproval?.(PENDING));
        return hook;
    };

    it("sends exactly one decision under StrictMode (no request started inside an updater)", () => {
        const { result } = pause(true);
        act(() => result.current.onApprove());
        expect(decideAgent).toHaveBeenCalledTimes(1);
        expect(result.current.ask).toMatchObject({ isStreaming: true, pendingApproval: null });
    });

    it("a double click sends one decision", () => {
        const { result } = pause();
        act(() => {
            result.current.onReject();
            result.current.onReject();
        });
        expect(decideAgent).toHaveBeenCalledTimes(1);
        expect(lastDecide()).toMatchObject({
            decision: "reject",
            runId: "run-p",
            approvalToken: "tok-1",
        });
    });

    it("a second pause in the same run (new token) can be decided again", () => {
        const { result } = pause();
        act(() => result.current.onApprove());
        act(() => lastDecide().onPendingApproval?.({ ...PENDING, approval_token: "tok-2" }));
        act(() => result.current.onApprove());
        expect(decideAgent).toHaveBeenCalledTimes(2);
        expect(lastDecide().approvalToken).toBe("tok-2");
    });

    it("is a no-op with nothing pending", () => {
        const { result } = mount();
        act(() => result.current.onApprove());
        expect(decideAgent).not.toHaveBeenCalled();
    });
});

describe("cancel keeps the @/# references (drift fix)", () => {
    it("the cancelled turn carries its mentions, so Ask again re-sends them", () => {
        const { result } = mount();
        act(() => {
            result.current.onAsk("explain @Fix login", [MENTION]);
        });
        act(() => lastAsk().onDelta("partial"));
        act(() => result.current.onCancel());

        const turn = result.current.turns[0];
        expect(turn.mentions).toEqual([MENTION]);
        act(() => {
            result.current.onAsk(turn.askedQuery, turn.mentions);
        });
        expect(lastAsk().mentions).toHaveLength(1);
    });
});

describe("showStaticAnswer", () => {
    it("puts a finished answer in the live slot without a request, replacing the conversation", () => {
        const { result } = mount();
        answered(result);
        act(() =>
            result.current.showStaticAnswer({
                askedQuery: "Past question",
                answer: "Past answer",
                answerSources: [],
            })
        );
        expect(askAgentStream).toHaveBeenCalledTimes(1);
        expect(result.current.turns).toEqual([]);
        expect(result.current.ask).toMatchObject({
            isStreaming: false,
            askedQuery: "Past question",
            answer: "Past answer",
            sessionId: null,
            turnId: 2,
        });
    });
});

describe("reset seeds the turn counter", () => {
    it("the first ask after restoring turns is promoted as the next turn", () => {
        const { result } = mount();
        act(() =>
            result.current.reset({
                sessionId: "sess-r",
                turns: [4, 5].map((id) => ({
                    id,
                    askedQuery: `q${id}`,
                    answer: "a",
                    answerSources: [],
                    toolEvents: [],
                    askError: null,
                })),
            })
        );
        expect(result.current.ask.turnId).toBe(5);
        act(() => {
            result.current.onAsk("next");
        });
        act(() => {
            lastAsk().onDelta("fresh");
            lastAsk().onDone("sess-r", "run-n");
        });
        expect(result.current.turns.map((t) => t.askedQuery)).toEqual(["q4", "q5", "next"]);
        expect(result.current.ask.answer).toBe("");
    });
});
