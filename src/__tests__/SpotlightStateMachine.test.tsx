/**
 * Characterization tests for Spotlight's ask/answer state machine.
 *
 * `useSpotlight` owns the conversation of the Spotlight overlay AND the Genos
 * page, and it lives at the App root. These tests drive it the way the
 * overlay does (through the returned `onAsk` / `onApprove` / ...), with the
 * network edge (`agentApi`) replaced by a recorder that hands the test the
 * stream handlers, so every event is delivered by hand and in order.
 *
 * They exist to pin behaviour BEFORE the state machine moved onto
 * `useAgentQA`: each test states a user-visible rule, not an implementation
 * detail, so the refactor has to keep them green unchanged.
 */

import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { toWireMentions, type AgentMentionRef } from "../features/agentQA";
import { useSpotlight } from "../features/spotlight/useSpotlight";
import { spotlight as enSpotlight } from "../i18n/locales/en/spotlight";
import {
    askAgentStream,
    decideAgent,
    fetchAgentSessionDetail,
    fetchAgentSessions,
    submitAgentFeedback,
    type PendingApprovalPayload,
} from "../services/agentApi";

const prefs = vi.hoisted(() => ({ aiAnswers: true }));

vi.mock("../services/agentApi", () => ({
    askAgentStream: vi.fn(async () => {}),
    decideAgent: vi.fn(async () => {}),
    fetchAgentSessionDetail: vi.fn(async () => null),
    fetchAgentSessions: vi.fn(async () => []),
    submitAgentFeedback: vi.fn(async () => true),
}));

vi.mock("../services/searchApi", () => ({
    searchSpotlight: vi.fn(async () => ({ results: [] })),
}));

vi.mock("../hooks/common/useSpotlightPreferences", () => ({
    useSpotlightPreferences: () => ({ aiAnswers: prefs.aiAnswers, webSearch: true }),
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

const STORAGE_KEY = "spotlight:session:v1:team-1";
const mount = (extra: { teamId?: string | null; isPageActive?: boolean } = {}) =>
    renderHook(() =>
        useSpotlight({
            accessToken: "tok",
            teamId: "teamId" in extra ? extra.teamId : "team-1",
            isPageActive: extra.isPageActive,
        })
    );

const PENDING: PendingApprovalPayload = {
    step: 1,
    tool_name: "create_task_plan",
    arguments: { title: "Ship it" },
    approval_token: "tok-1",
    run_id: "run-pending",
};

const MENTION: AgentMentionRef = { kind: "task", taskId: 7, label: "Fix login" };

beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(askAgentStream).mockImplementation(async () => {});
    vi.mocked(decideAgent).mockImplementation(async () => {});
    prefs.aiAnswers = true;
    localStorage.clear();
});

describe("streaming events become a turn", () => {
    it("shows the live answer, then promotes it into turns and keeps the session", async () => {
        const { result } = mount();
        act(() => result.current.onAsk("what is blocked?"));

        expect(result.current.ask).toMatchObject({
            isStreaming: true,
            askedQuery: "what is blocked?",
            answer: "",
            turnId: 1,
            sessionId: null,
        });
        expect(lastAsk()).toMatchObject({ query: "what is blocked?", teamId: "team-1" });

        const src = [{ id: "t1", entity_type: "task", title: "A" }] as never;
        act(() => {
            lastAsk().onSources(src);
            lastAsk().onDelta("Two ");
            lastAsk().onDelta("tasks.");
        });
        expect(result.current.ask).toMatchObject({ answer: "Two tasks.", answerSources: src });
        expect(result.current.turns).toHaveLength(0);

        act(() => lastAsk().onDone("sess-1", "run-1", 4200));

        expect(result.current.turns).toHaveLength(1);
        expect(result.current.turns[0]).toMatchObject({
            id: 1,
            askedQuery: "what is blocked?",
            answer: "Two tasks.",
            answerSources: src,
            askError: null,
            runId: "run-1",
            elapsedMs: 4200,
        });
        // The live slot is emptied but keeps the session + turn counter.
        expect(result.current.ask).toMatchObject({
            isStreaming: false,
            askedQuery: "",
            answer: "",
            answerSources: [],
            sessionId: "sess-1",
            turnId: 1,
        });
    });

    it("clears the input once the ask is sent", () => {
        const { result } = mount();
        act(() => result.current.setQuery("typed question"));
        act(() => result.current.onAsk());
        expect(lastAsk().query).toBe("typed question");
        expect(result.current.query).toBe("");
    });

    it("an ask with an override (retry / starter chip) also clears the draft", () => {
        // Retry / starter chips pass an override. The draft is cleared on
        // every started ask (the old behaviour, overlay and page alike).
        const { result } = mount();
        act(() => result.current.setQuery("draft"));
        act(() => result.current.onAsk("override"));
        expect(lastAsk().query).toBe("override");
        expect(result.current.query).toBe("");
    });

    it("promotes an error turn (even with no content) so the failure stays visible", () => {
        const { result } = mount();
        act(() => result.current.onAsk("boom?"));
        act(() => lastAsk().onError("model unavailable"));

        expect(result.current.turns).toHaveLength(1);
        expect(result.current.turns[0]).toMatchObject({
            askedQuery: "boom?",
            answer: "",
            askError: "model unavailable",
        });
        expect(result.current.ask.isStreaming).toBe(false);
    });

    it("does not promote a turn that ended with no content at all", () => {
        const { result } = mount();
        act(() => result.current.onAsk("silent"));
        act(() => lastAsk().onDone("sess-9"));
        expect(result.current.turns).toHaveLength(0);
        expect(result.current.ask.sessionId).toBe("sess-9");
    });

    it("promotes once even when both done and error arrive", () => {
        const { result } = mount();
        act(() => result.current.onAsk("q"));
        act(() => {
            lastAsk().onDelta("partial");
            lastAsk().onError("late failure");
            lastAsk().onDone("sess-1", "run-1");
        });
        expect(result.current.turns).toHaveLength(1);
        expect(result.current.turns[0].askError).toBe("late failure");
    });

    it("drops late events from a superseded turn", () => {
        const { result } = mount();
        act(() => result.current.onAsk("first"));
        const first = lastAsk();
        act(() => first.onDelta("one"));
        act(() => first.onDone("sess-1", "run-1"));
        act(() => result.current.onAsk("second"));
        act(() => {
            // A straggler from turn 1 must not touch turn 2's live answer.
            first.onDelta("STALE");
            first.onError("STALE");
        });
        expect(result.current.ask).toMatchObject({
            askedQuery: "second",
            answer: "",
            askError: null,
            isStreaming: true,
        });
        expect(result.current.turns).toHaveLength(1);
    });

    it("follow-up: the next ask carries the session id and resume:true (visible transcript)", () => {
        const { result } = mount();
        act(() => result.current.onAsk("first"));
        expect(lastAsk()).not.toHaveProperty("resume");
        expect(lastAsk().sessionId).toBeUndefined();
        act(() => {
            lastAsk().onDelta("a1");
            lastAsk().onDone("sess-1", "run-1");
        });
        act(() => result.current.onAsk("second"));
        expect(lastAsk().sessionId).toBe("sess-1");
        expect(lastAsk().resume).toBe(true);
        expect(result.current.ask.turnId).toBe(2);
    });

    it("never asks the backend for a brand new conversation", () => {
        // Spotlight's New conversation just drops the session id; it must
        // not start sending `new_conversation` (that is the thread/note
        // clearConversation protocol).
        const { result } = mount();
        act(() => result.current.onAsk("first"));
        act(() => {
            lastAsk().onDelta("a");
            lastAsk().onDone("sess-1", "run-1");
        });
        act(() => result.current.onNewConversation());
        act(() => result.current.onAsk("second"));
        expect(lastAsk().sessionId).toBeUndefined();
        expect(lastAsk()).not.toHaveProperty("newConversation");
        expect(lastAsk()).not.toHaveProperty("resume");
    });

    it("sends structured mentions on the wire and keeps them on the turn", () => {
        const { result } = mount();
        act(() => result.current.onAsk("see @Fix login", [MENTION]));
        expect(lastAsk().mentions).toEqual(toWireMentions([MENTION]));
        expect(result.current.ask.askedMentions).toEqual([MENTION]);
        act(() => {
            lastAsk().onDelta("ok");
            lastAsk().onDone("s", "r");
        });
        expect(result.current.turns[0].mentions).toEqual([MENTION]);
    });

    it("never scopes the ask by the search filters", () => {
        const { result } = mount();
        act(() => {
            result.current.onToggleFilterService("task");
            result.current.onChangeFilterProjects([3]);
        });
        act(() => result.current.onAsk("anything"));
        const args = lastAsk() as unknown as Record<string, unknown>;
        expect(args).not.toHaveProperty("entityTypes");
        expect(args).not.toHaveProperty("projectIds");
    });

    it("keeps streaming into the same turn after the overlay is closed", () => {
        const { result } = mount();
        act(() => result.current.open());
        act(() => result.current.onAsk("long one"));
        act(() => result.current.close());
        expect(result.current.ask.isStreaming).toBe(true);
        expect(lastAsk().signal?.aborted).toBe(false);
        act(() => {
            lastAsk().onDelta("done while closed");
            lastAsk().onDone("s", "r");
        });
        expect(result.current.turns).toHaveLength(1);
        expect(result.current.turns[0].answer).toBe("done while closed");
    });
});

describe("ask guards", () => {
    it("ignores an empty / whitespace question and keeps the draft", () => {
        const { result } = mount();
        act(() => result.current.setQuery("   "));
        act(() => result.current.onAsk());
        expect(askAgentStream).not.toHaveBeenCalled();
        expect(result.current.query).toBe("   ");
    });

    it("ignores an ask while one is streaming", () => {
        const { result } = mount();
        act(() => result.current.onAsk("one"));
        act(() => result.current.onAsk("two"));
        expect(askAgentStream).toHaveBeenCalledTimes(1);
    });

    it("ignores an ask while an approval is pending", () => {
        const { result } = mount();
        act(() => result.current.onAsk("one"));
        act(() => lastAsk().onPendingApproval?.(PENDING));
        act(() => result.current.onAsk("two"));
        expect(askAgentStream).toHaveBeenCalledTimes(1);
    });

    it("honours the AI-answers setting (Spotlight only): no request, draft kept", () => {
        prefs.aiAnswers = false;
        const { result } = mount();
        expect(result.current.aiAnswersEnabled).toBe(false);
        act(() => result.current.setQuery("hello"));
        act(() => result.current.onAsk());
        expect(askAgentStream).not.toHaveBeenCalled();
        expect(result.current.query).toBe("hello");
        expect(result.current.ask.turnId).toBe(0);
    });

    it("with no team: shows the noTeam error as the turn, sends nothing, keeps the draft", () => {
        const { result } = mount({ teamId: null });
        act(() => result.current.setQuery("hi"));
        act(() => result.current.onAsk());
        expect(askAgentStream).not.toHaveBeenCalled();
        expect(result.current.ask).toMatchObject({
            askedQuery: "hi",
            askError: enSpotlight.errors.noTeam,
            isStreaming: false,
            turnId: 1,
        });
        expect(result.current.turns).toHaveLength(0);
        expect(result.current.query).toBe("hi");
    });
});

describe("tool events", () => {
    it("one row per tool call: start -> result, errors, and a de-duplicated re-announce", () => {
        const { result } = mount();
        act(() => result.current.onAsk("q"));
        act(() => {
            lastAsk().onToolStart?.({ step: 1, tool_name: "search", arguments: { q: "x" } });
            lastAsk().onToolStart?.({ step: 1, tool_name: "search", arguments: { q: "x" } });
            lastAsk().onToolStart?.({ step: 2, tool_name: "get_task", arguments: {} });
        });
        expect(result.current.ask.toolEvents.map((e) => [e.step, e.status])).toEqual([
            [1, "pending"],
            [2, "pending"],
        ]);
        act(() => {
            lastAsk().onToolResult?.({
                step: 1,
                tool_name: "search",
                summary: "3 hits",
                duration_ms: 120,
            });
            lastAsk().onToolError?.({
                step: 2,
                tool_name: "get_task",
                error: "not found",
                duration_ms: 5,
            });
        });
        expect(result.current.ask.toolEvents).toMatchObject([
            { step: 1, status: "done", summary: "3 hits", duration_ms: 120 },
            { step: 2, status: "error", error: "not found", duration_ms: 5 },
        ]);
        // Tool-only turns (no answer text) are still worth keeping.
        act(() => lastAsk().onDone("s", "r"));
        expect(result.current.turns).toHaveLength(1);
        expect(result.current.turns[0].toolEvents).toHaveLength(2);
    });
});

describe("approve / reject", () => {
    const pause = () => {
        const hook = mount();
        act(() => hook.result.current.onAsk("create a plan"));
        act(() => {
            lastAsk().onToolStart?.({
                step: 1,
                tool_name: "create_task_plan",
                arguments: { title: "Ship it" },
            });
            lastAsk().onDelta("I will create it. ");
            lastAsk().onPendingApproval?.(PENDING);
        });
        return hook;
    };

    it("a write tool pauses the turn: not streaming, not promoted, approval shown", () => {
        const { result } = pause();
        expect(result.current.ask).toMatchObject({
            isStreaming: false,
            pendingApproval: PENDING,
            answer: "I will create it. ",
        });
        expect(result.current.turns).toHaveLength(0);
    });

    it("approve resumes the SAME turn with the approval token and finishes as one turn", () => {
        const { result } = pause();
        act(() => result.current.onApprove());

        expect(decideAgent).toHaveBeenCalledTimes(1);
        expect(lastDecide()).toMatchObject({
            runId: "run-pending",
            approvalToken: "tok-1",
            decision: "approve",
            accessToken: "tok",
        });
        expect(result.current.ask).toMatchObject({
            isStreaming: true,
            pendingApproval: null,
            turnId: 1,
        });

        // The resume stream re-announces the paused tool, then completes it.
        act(() => {
            lastDecide().onToolStart?.({
                step: 1,
                tool_name: "create_task_plan",
                arguments: { title: "Ship it" },
            });
            lastDecide().onToolResult?.({
                step: 1,
                tool_name: "create_task_plan",
                summary: "created",
            });
            lastDecide().onDelta("Done.");
            lastDecide().onDone("sess-2", "run-2");
        });

        expect(result.current.turns).toHaveLength(1);
        expect(result.current.turns[0]).toMatchObject({
            id: 1,
            askedQuery: "create a plan",
            answer: "I will create it. Done.",
            runId: "run-2",
        });
        expect(result.current.turns[0].toolEvents).toMatchObject([
            { step: 1, status: "done", summary: "created" },
        ]);
        expect(result.current.ask.sessionId).toBe("sess-2");
    });

    it("reject sends decision:reject", () => {
        const { result } = pause();
        act(() => result.current.onReject());
        expect(lastDecide().decision).toBe("reject");
        expect(result.current.ask.isStreaming).toBe(true);
    });

    it("a double click on Approve sends ONE decision", () => {
        const { result } = pause();
        act(() => {
            result.current.onApprove();
            result.current.onApprove();
        });
        expect(decideAgent).toHaveBeenCalledTimes(1);
    });

    it("approve with nothing pending is a no-op", () => {
        const { result } = mount();
        act(() => result.current.onApprove());
        expect(decideAgent).not.toHaveBeenCalled();
    });

    it("an error on the resumed stream still promotes the turn once", () => {
        const { result } = pause();
        act(() => result.current.onApprove());
        act(() => lastDecide().onError("tool crashed"));
        expect(result.current.turns).toHaveLength(1);
        expect(result.current.turns[0].askError).toBe("tool crashed");
    });
});

describe("cancel and ask again", () => {
    it("aborts the stream and keeps the partial answer (with its mentions) as a turn", () => {
        const { result } = mount();
        act(() => result.current.onAsk("explain @Fix login", [MENTION]));
        const signal = lastAsk().signal as AbortSignal;
        act(() => lastAsk().onDelta("partial answer"));

        act(() => result.current.onCancel());

        expect(signal.aborted).toBe(true);
        expect(result.current.ask.isStreaming).toBe(false);
        expect(result.current.turns).toHaveLength(1);
        expect(result.current.turns[0]).toMatchObject({
            askedQuery: "explain @Fix login",
            answer: "partial answer",
            mentions: [MENTION],
        });
    });

    it("Ask again on a cancelled turn re-sends its @/# references", () => {
        const { result } = mount();
        act(() => result.current.onAsk("explain @Fix login", [MENTION]));
        act(() => lastAsk().onDelta("partial"));
        act(() => result.current.onCancel());

        const turn = result.current.turns[0];
        act(() => result.current.onAsk(turn.askedQuery, turn.mentions, "retry"));

        expect(lastAsk().query).toBe("explain @Fix login");
        expect(lastAsk().mentions).toEqual(toWireMentions([MENTION]));
    });

    it("cancelling before anything arrived leaves no turn behind", () => {
        const { result } = mount();
        act(() => result.current.onAsk("nothing yet"));
        act(() => result.current.onCancel());
        expect(result.current.turns).toHaveLength(0);
        expect(result.current.ask).toMatchObject({ isStreaming: false, askedQuery: "" });
    });

    it("cancel while waiting on an approval keeps the turn and clears the card", () => {
        const { result } = mount();
        act(() => result.current.onAsk("create a plan"));
        act(() => {
            lastAsk().onDelta("plan ready");
            lastAsk().onPendingApproval?.(PENDING);
        });
        act(() => result.current.onCancel());
        expect(result.current.ask.pendingApproval).toBeNull();
        expect(result.current.turns).toHaveLength(1);
        expect(result.current.turns[0].answer).toBe("plan ready");
    });

    it("a late event after cancel cannot resurrect or duplicate the turn", () => {
        const { result } = mount();
        act(() => result.current.onAsk("q"));
        const args = lastAsk();
        act(() => args.onDelta("partial"));
        act(() => result.current.onCancel());
        act(() => {
            args.onDelta("LATE");
            args.onDone("s", "r");
        });
        expect(result.current.turns).toHaveLength(1);
        expect(result.current.turns[0].answer).toBe("partial");
    });

    it("cancel with nothing in flight is a no-op", () => {
        const { result } = mount();
        act(() => result.current.onCancel());
        expect(result.current.ask.turnId).toBe(0);
    });
});

describe("conversation lifecycle", () => {
    const answered = (result: { current: ReturnType<typeof useSpotlight> }, q = "q") => {
        act(() => result.current.onAsk(q));
        act(() => {
            lastAsk().onDelta("a");
            lastAsk().onDone("sess-1", "run-1");
        });
    };

    it("New conversation wipes turns, session and the open History view", () => {
        const { result } = mount();
        answered(result);
        act(() => result.current.openHistory());
        act(() => result.current.onNewConversation());
        expect(result.current.turns).toEqual([]);
        expect(result.current.ask.sessionId).toBeNull();
        expect(result.current.ask.turnId).toBe(0);
        expect(result.current.historyMode).toBe("closed");
    });

    it("New conversation aborts an in-flight answer", () => {
        const { result } = mount();
        act(() => result.current.onAsk("q"));
        const signal = lastAsk().signal as AbortSignal;
        act(() => result.current.onNewConversation());
        expect(signal.aborted).toBe(true);
        expect(result.current.ask.isStreaming).toBe(false);
    });

    it("showStoredAnswer shows a collected answer without a request, as a lingering non-streaming ask", () => {
        const { result } = mount();
        answered(result);
        act(() =>
            result.current.showStoredAnswer({
                id: "a1",
                entity_type: "spotlight_answer",
                title: "How do releases work?",
                answer_text: "Weekly on Tuesdays.",
                answer_sources: [{ id: "n1", entity_type: "note", title: "Release" }],
            } as never)
        );
        expect(askAgentStream).toHaveBeenCalledTimes(1); // only the live ask
        expect(result.current.turns).toEqual([]);
        expect(result.current.ask).toMatchObject({
            isStreaming: false,
            askedQuery: "How do releases work?",
            answer: "Weekly on Tuesdays.",
            answerSources: [{ id: "n1", entity_type: "note", title: "Release" }],
            sessionId: null,
            turnId: 2,
            pendingApproval: null,
        });
        // The next live ask starts a fresh (session-less) conversation.
        act(() => result.current.onAsk("next"));
        expect(lastAsk().sessionId).toBeUndefined();
        expect(result.current.ask.turnId).toBe(3);
    });

    it("showStoredAnswer closes History and aborts a live stream", () => {
        const { result } = mount();
        act(() => result.current.onAsk("q"));
        const signal = lastAsk().signal as AbortSignal;
        act(() => result.current.openHistory());
        act(() =>
            result.current.showStoredAnswer({ id: "a", title: "T", answer_text: "A" } as never)
        );
        expect(signal.aborted).toBe(true);
        expect(result.current.historyMode).toBe("closed");
    });

    it("History: list -> detail -> back -> close, and a failed list load is flagged", async () => {
        vi.mocked(fetchAgentSessions).mockResolvedValueOnce([
            { session_id: "s1", title: "One" },
        ] as never);
        const { result } = mount();
        act(() => result.current.openHistory());
        expect(result.current.historyMode).toBe("list");
        await waitFor(() => expect(result.current.historySessions).toHaveLength(1));
        expect(fetchAgentSessions).toHaveBeenCalledWith({ accessToken: "tok", teamId: "team-1" });

        vi.mocked(fetchAgentSessionDetail).mockResolvedValueOnce({
            session_id: "s1",
            turns: [],
        } as never);
        act(() => result.current.viewHistorySession("s1"));
        expect(result.current.historyMode).toBe("detail");
        await waitFor(() => expect(result.current.historyDetail?.session_id).toBe("s1"));
        act(() => result.current.backToHistoryList());
        expect(result.current.historyMode).toBe("list");
        expect(result.current.historyDetail).toBeNull();
        act(() => result.current.closeHistory());
        expect(result.current.historyMode).toBe("closed");

        vi.mocked(fetchAgentSessions).mockResolvedValueOnce(null as never);
        act(() => result.current.openHistory());
        await waitFor(() => expect(result.current.historyLoadFailed).toBe(true));
        // A failed refresh keeps the rows already on screen for the same team.
        expect(result.current.historySessions).toHaveLength(1);
    });

    it("resumeSession aborts a live stream and the restored session's next ask continues it", async () => {
        vi.mocked(fetchAgentSessionDetail).mockResolvedValue({
            session_id: "sess-old",
            turns: [
                { query: "q1", answer: "a1", sources: [], run_id: "r1", error: null },
                { query: "q2", answer: "a2", sources: [], run_id: "r2", error: null },
            ],
        } as never);
        const { result } = mount();
        act(() => result.current.onAsk("in flight"));
        const signal = lastAsk().signal as AbortSignal;
        act(() => result.current.resumeSession("sess-old"));
        await waitFor(() => expect(result.current.turns).toHaveLength(2));
        expect(signal.aborted).toBe(true);
        expect(result.current.ask).toMatchObject({
            isStreaming: false,
            sessionId: "sess-old",
            turnId: 2,
        });
        act(() => result.current.onAsk("follow up"));
        expect(lastAsk()).toMatchObject({ sessionId: "sess-old", resume: true });
        act(() => {
            lastAsk().onDelta("a3");
            lastAsk().onDone("sess-old", "r3");
        });
        expect(result.current.turns.map((t) => t.id)).toEqual([1, 2, 3]);
    });
});

describe("feedback", () => {
    it("posts the rating for a run, and only with a run id", () => {
        const { result } = mount();
        act(() => result.current.submitFeedback("run-1", 1));
        act(() => result.current.submitFeedback("", 1));
        expect(submitAgentFeedback).toHaveBeenCalledTimes(1);
        expect(submitAgentFeedback).toHaveBeenCalledWith({
            runId: "run-1",
            rating: 1,
            accessToken: "tok",
        });
    });
});

describe("localStorage persistence", () => {
    const stored = (over: Record<string, unknown> = {}) => ({
        version: 1,
        savedAt: Date.now(),
        sessionId: "sess-saved",
        turns: [
            {
                id: 1,
                askedQuery: "old q",
                answer: "old a",
                answerSources: [],
                toolEvents: [],
                askError: null,
                runId: "run-old",
            },
        ],
        ...over,
    });
    const readStored = () => JSON.parse(localStorage.getItem(STORAGE_KEY) as string);

    it("saves the conversation (debounced), stripping tool events", async () => {
        const { result } = mount();
        act(() => result.current.onAsk("q"));
        act(() => {
            lastAsk().onToolStart?.({ step: 1, tool_name: "search", arguments: { big: "blob" } });
            lastAsk().onDelta("a");
            lastAsk().onDone("sess-1", "run-1");
        });
        await waitFor(() => expect(localStorage.getItem(STORAGE_KEY)).toBeTruthy(), {
            timeout: 3000,
        });
        const saved = readStored();
        expect(saved.version).toBe(1);
        expect(saved.sessionId).toBe("sess-1");
        expect(saved.turns).toHaveLength(1);
        expect(saved.turns[0]).toMatchObject({ askedQuery: "q", answer: "a", toolEvents: [] });
        expect(typeof saved.savedAt).toBe("number");
    });

    it("keeps only the 10 most recent turns", async () => {
        const turns = Array.from({ length: 12 }, (_, i) => ({
            id: i + 1,
            askedQuery: `q${i + 1}`,
            answer: "a",
            answerSources: [],
            toolEvents: [],
            askError: null,
        }));
        localStorage.setItem(STORAGE_KEY, JSON.stringify(stored({ turns })));
        const { result } = mount();
        // All 12 are restored into memory...
        expect(result.current.turns).toHaveLength(12);
        // ...and the hydrated conversation is re-saved, capped at 10.
        await waitFor(() => expect(readStored().turns).toHaveLength(10), { timeout: 3000 });
        expect(readStored().turns[0].askedQuery).toBe("q3");
        expect(readStored().turns.at(-1).askedQuery).toBe("q12");
    });

    it("restores turns and the session on mount", () => {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(stored()));
        const { result } = mount();
        expect(result.current.turns).toHaveLength(1);
        expect(result.current.turns[0].answer).toBe("old a");
        expect(result.current.ask.sessionId).toBe("sess-saved");
    });

    it("restored turns are followed up on with the saved session and resume:true", () => {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(stored()));
        const { result } = mount();
        act(() => result.current.onAsk("follow up"));
        expect(lastAsk()).toMatchObject({ sessionId: "sess-saved", resume: true });
    });

    it("the first ask after a reload is promoted as the NEXT turn, not lost", () => {
        localStorage.setItem(
            STORAGE_KEY,
            JSON.stringify(
                stored({
                    turns: [
                        {
                            id: 1,
                            askedQuery: "q1",
                            answer: "a1",
                            answerSources: [],
                            toolEvents: [],
                            askError: null,
                        },
                        {
                            id: 2,
                            askedQuery: "q2",
                            answer: "a2",
                            answerSources: [],
                            toolEvents: [],
                            askError: null,
                        },
                    ],
                })
            )
        );
        const { result } = mount();
        act(() => result.current.onAsk("after reload"));
        act(() => {
            lastAsk().onDelta("fresh answer");
            lastAsk().onDone("sess-saved", "run-new");
        });
        // LATENT BUG ON MAIN (fixed by the state-machine merge): hydration
        // restores turn ids 1..2 but leaves the turn counter at 0, so the
        // new turn is id 1 -- already "promoted" -- and is never moved into
        // `turns`; it just sits in the live slot and the next ask drops it.
        expect(result.current.turns.map((t) => t.askedQuery)).toEqual(["q1", "q2"]);
        expect(result.current.ask.answer).toBe("fresh answer");
    });

    it("ignores an entry older than 4 hours", () => {
        localStorage.setItem(
            STORAGE_KEY,
            JSON.stringify(stored({ savedAt: Date.now() - 4 * 60 * 60 * 1000 - 1000 }))
        );
        const { result } = mount();
        expect(result.current.turns).toEqual([]);
        expect(result.current.ask.sessionId).toBeNull();
    });

    it("restores an entry just inside the TTL", () => {
        localStorage.setItem(
            STORAGE_KEY,
            JSON.stringify(stored({ savedAt: Date.now() - 4 * 60 * 60 * 1000 + 60_000 }))
        );
        const { result } = mount();
        expect(result.current.turns).toHaveLength(1);
    });

    it("ignores a version mismatch, corrupt JSON, and an empty entry", () => {
        for (const raw of [
            JSON.stringify(stored({ version: 2 })),
            "{not json",
            JSON.stringify(stored({ turns: [], sessionId: null })),
        ]) {
            localStorage.setItem(STORAGE_KEY, raw);
            const { result, unmount } = mount();
            expect(result.current.turns).toEqual([]);
            expect(result.current.ask.sessionId).toBeNull();
            unmount();
        }
    });

    it("is scoped per team", () => {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(stored()));
        const { result } = mount({ teamId: "team-2" });
        expect(result.current.turns).toEqual([]);
    });

    it("does nothing without a team", () => {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(stored()));
        const { result } = mount({ teamId: null });
        expect(result.current.turns).toEqual([]);
    });

    it("New conversation removes the saved entry immediately", () => {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(stored()));
        const { result } = mount();
        act(() => result.current.onNewConversation());
        expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
    });
});
