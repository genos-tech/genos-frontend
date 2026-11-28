/**
 * MIP-2604: a past ask that was cancelled, or is still waiting for approval, must not open as an
 * empty conversation.
 *
 * The server sends such a run as a turn with no answer. A cancelled one opens with its question
 * and one line; one awaiting approval opens with its question, the pending change and the same
 * Approve / Reject card the live view uses.
 */

import { CssVarsProvider } from "@mui/joy/styles";
import { act, render, renderHook, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AgentTurn, type AgentTurnProps } from "../features/agentQA/AgentTurn";
import { buildAgentTurnLabels } from "../features/agentQA/agentTurnLabels";
import { useSpotlight } from "../features/spotlight/useSpotlight";
import { useThreadAsk } from "../features/threadAsk/useThreadAsk";
import { getMessages, loadLocale } from "../i18n";
import {
    askAgentStream,
    decideAgent,
    fetchAgentSessionDetail,
    fetchThreadSummary,
    type AgentSessionTurn,
} from "../services/agentApi";

vi.mock("../services/agentApi", async (importOriginal) => {
    const actual = await importOriginal<typeof import("../services/agentApi")>();
    return {
        ...actual,
        askAgentStream: vi.fn(),
        decideAgent: vi.fn(async () => {}),
        fetchAgentSessionDetail: vi.fn(),
        fetchAgentSessions: vi.fn(async () => []),
        fetchThreadSummary: vi.fn(),
        submitAgentFeedback: vi.fn(async () => true),
    };
});
vi.mock("../services/searchApi", () => ({
    searchSpotlight: vi.fn(async () => ({ results: [] })),
}));
vi.mock("../hooks/common/spotlightPreferencesState", () => ({
    useSpotlightPreferences: () => ({ aiAnswers: true, webSearch: true }),
}));

const turn = (over: Partial<AgentSessionTurn> = {}): AgentSessionTurn => ({
    run_id: "run-1",
    query: "question",
    answer: "answer",
    status: "done",
    error: null,
    started_at: "2026-11-28T10:00:00Z",
    sources: [],
    ...over,
});

const CARD = {
    step: 1,
    tool_name: "add_comment",
    arguments: { task_id: "PRJ-1", body_text: "Live check" },
    editable: ["body_text"],
    undoable: true,
    approval_token: "tok-pending",
    run_id: "run-p",
};

const cancelled = turn({ run_id: "run-c", query: "mip 1813", answer: "", status: "cancelled" });
const waiting = turn({
    run_id: "run-p",
    query: "Add a comment",
    answer: "",
    status: "awaiting_approval",
    pending_approval: CARD,
});

const resume = async (turns: AgentSessionTurn[]) => {
    vi.mocked(fetchAgentSessionDetail).mockResolvedValue({
        session_id: "sess-1",
        created_at: "2026-11-28T10:00:00Z",
        last_active_at: "2026-11-28T10:00:00Z",
        turns,
    });
    const hook = renderHook(() =>
        useSpotlight({ accessToken: "tok", teamId: "team-1", isPageActive: true })
    );
    act(() => hook.result.current.resumeSession("sess-1"));
    await waitFor(() => expect(hook.result.current.ask.sessionId).toBe("sess-1"));
    return hook;
};

beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
});
afterEach(() => localStorage.clear());

describe("opening a past ask from the sidebar", () => {
    it("marks a cancelled ask so the turn can say so", async () => {
        const { result } = await resume([cancelled]);
        expect(result.current.turns).toHaveLength(1);
        expect(result.current.turns[0]).toMatchObject({
            askedQuery: "mip 1813",
            unanswered: "cancelled",
        });
    });

    it("does not mark a cancelled ask that has part of an answer", async () => {
        const { result } = await resume([turn({ status: "cancelled", answer: "Half of it" })]);
        expect(result.current.turns[0].unanswered).toBeUndefined();
    });

    it("puts an ask awaiting approval back on the live card", async () => {
        const { result } = await resume([turn({ run_id: "run-0" }), waiting]);
        expect(result.current.turns.map((t) => t.askedQuery)).toEqual(["question"]);
        expect(result.current.ask).toMatchObject({
            askedQuery: "Add a comment",
            pendingApproval: CARD,
            isStreaming: false,
            sessionId: "sess-1",
        });
    });

    it("approves it with the stored token, and the answer joins the conversation", async () => {
        vi.mocked(decideAgent).mockImplementation(async (args) => {
            args.onDelta("Done.");
            args.onDone("sess-1", "run-p");
        });
        const { result } = await resume([turn({ run_id: "run-0" }), waiting]);

        act(() => result.current.onApprove());

        expect(vi.mocked(decideAgent).mock.calls[0][0]).toMatchObject({
            runId: "run-p",
            approvalToken: "tok-pending",
            decision: "approve",
        });
        await waitFor(() => expect(result.current.turns).toHaveLength(2));
        expect(result.current.turns[1]).toMatchObject({
            askedQuery: "Add a comment",
            answer: "Done.",
        });
        expect(result.current.turns[1].id).not.toBe(result.current.turns[0].id);
        expect(result.current.ask.pendingApproval).toBeNull();
    });

    it("can be decided again after the same conversation is reopened", async () => {
        const { result } = await resume([waiting]);
        // The first click never reached the server: the stream is still open.
        act(() => result.current.onApprove());
        act(() => result.current.resumeSession("sess-1"));
        await waitFor(() => expect(result.current.ask.pendingApproval).toEqual(CARD));
        act(() => result.current.onApprove());
        expect(decideAgent).toHaveBeenCalledTimes(2);
    });

    it("does not start another ask while the restored card waits", async () => {
        const { result } = await resume([waiting]);
        act(() => result.current.onAsk("something else"));
        expect(askAgentStream).not.toHaveBeenCalled();
    });

    it("says so for an ask left behind earlier in the conversation, or with no card", async () => {
        const { result } = await resume([
            waiting,
            turn({ run_id: "run-2" }),
            turn({ run_id: "run-3", answer: "", status: "awaiting_approval" }),
        ]);
        expect(result.current.ask.pendingApproval).toBeNull();
        expect(result.current.turns.map((t) => t.unanswered)).toEqual([
            "notDecided",
            undefined,
            "notDecided",
        ]);
    });

    it("keeps the question when the restored card is cancelled", async () => {
        const { result } = await resume([waiting]);
        act(() => result.current.onCancel());
        expect(result.current.turns).toMatchObject([
            { askedQuery: "Add a comment", unanswered: "notDecided" },
        ]);
    });

    it("keeps the waiting question across a reload, without its token", async () => {
        const first = await resume([waiting]);
        await waitFor(
            () =>
                expect(localStorage.getItem("spotlight:session:v1:team-1")).toContain(
                    "Add a comment"
                ),
            { timeout: 2000 }
        );
        expect(localStorage.getItem("spotlight:session:v1:team-1")).not.toContain("tok-pending");
        first.unmount();
        const { result } = renderHook(() =>
            useSpotlight({ accessToken: "tok", teamId: "team-1", isPageActive: true })
        );
        expect(result.current.turns).toMatchObject([
            { askedQuery: "Add a comment", unanswered: "notDecided" },
        ]);
    });

    it("keeps an ordinary conversation as it was", async () => {
        const { result } = await resume([turn()]);
        expect(result.current.turns[0]).not.toHaveProperty("unanswered");
        expect(result.current.ask.pendingApproval).toBeNull();
    });
});

describe("the thread Ask window", () => {
    it("restores a waiting ask with its card too", async () => {
        vi.mocked(fetchThreadSummary).mockResolvedValue({
            summary: "s",
            generated: false,
            last_updated_iso: "2026-11-28T10:00:00Z",
            fingerprint: "f",
            message_count: 3,
            agent_session_id: "thread-sess",
            turns: [waiting],
        } as never);
        const { result } = renderHook(() =>
            useThreadAsk({ accessToken: "tok", teamId: "team-1" })
        );
        act(() => result.current.open({ chatType: 2, chatId: "c1", threadId: "m1" } as never));
        await waitFor(() => expect(result.current.agentQA.ask.pendingApproval).toEqual(CARD));
        expect(result.current.agentQA.turns).toEqual([]);
    });
});

describe("the line a turn without an answer shows", () => {
    const renderTurn = (over: Partial<AgentTurnProps>, locale: "en" | "ja" = "en") =>
        render(
            <CssVarsProvider>
                <AgentTurn
                    answer=""
                    answerSources={[]}
                    askedQuery="mip 1813"
                    askError={null}
                    isCurrent={false}
                    labels={buildAgentTurnLabels(getMessages(locale), "spotlight")}
                    runId="run-c"
                    toolEvents={[]}
                    onFeedback={vi.fn()}
                    onPreview={vi.fn()}
                    {...over}
                />
            </CssVarsProvider>
        );

    it("is the cancelled sentence, with nothing to rate", () => {
        renderTurn({ unanswered: "cancelled" });
        expect(screen.getByText("This ask was cancelled before an answer.")).toBeTruthy();
        expect(screen.queryByText(getMessages("en").spotlight.states.noAnswer)).toBeNull();
        expect(screen.queryByLabelText(getMessages("en").spotlight.actions.feedbackUp)).toBeNull();
    });

    it("is the not-decided sentence for an ask nobody answered", () => {
        renderTurn({ unanswered: "notDecided" });
        expect(screen.getByText("This ask was not approved or rejected.")).toBeTruthy();
    });

    it("is translated", async () => {
        await loadLocale("ja");
        renderTurn({ unanswered: "cancelled" }, "ja");
        const ja = getMessages("ja").spotlight.states.cancelledBeforeAnswer;
        expect(ja).not.toBe(getMessages("en").spotlight.states.cancelledBeforeAnswer);
        expect(screen.getByText(ja)).toBeTruthy();
    });
});

describe("an ask refused before it began (MIP-2609)", () => {
    const refused = turn({
        run_id: "run-r",
        query: "summarise this",
        answer: "",
        status: "error",
    });

    it("opens with its question, marked refused", async () => {
        const { result } = await resume([refused]);
        expect(result.current.turns).toMatchObject([
            { askedQuery: "summarise this", unanswered: "refused" },
        ]);
    });

    it("keeps the server's own words when the run has an error message", async () => {
        const { result } = await resume([{ ...refused, error: "It broke." }]);
        expect(result.current.turns[0].askError).toBe("It broke.");
        expect(result.current.turns[0].unanswered).toBeUndefined();
    });

    it("says it could not be answered", () => {
        render(
            <CssVarsProvider>
                <AgentTurn
                    answer=""
                    answerSources={[]}
                    askedQuery="summarise this"
                    askError={null}
                    isCurrent={false}
                    labels={buildAgentTurnLabels(getMessages("en"), "spotlight")}
                    runId="run-r"
                    toolEvents={[]}
                    unanswered="refused"
                    onFeedback={vi.fn()}
                    onPreview={vi.fn()}
                />
            </CssVarsProvider>
        );
        expect(screen.getByText("This ask couldn't be answered.")).toBeTruthy();
    });
});
