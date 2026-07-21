// Completion notice for a backgrounded agent run.
//
// Every Ask surface deliberately keeps an in-flight stream alive after
// its window is dismissed, so an answer can land long after the user has
// moved on. These tests pin the contract that decides whether that lands
// silently or interrupts them:
//   1. Overlay/modal CLOSED when the run finishes  -> notify.
//   2. Overlay/modal OPEN when it finishes         -> stay quiet (the
//      user is looking right at the answer).
//   3. Explicit Cancel                             -> stay quiet (they
//      stopped it on purpose).
//   4. One notice per run, whatever the stream does on its way out.

import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useAgentQA } from "../features/agentQA";
import { useSpotlight } from "../features/spotlight/useSpotlight";
import { askAgentStream } from "../services/agentApi";
import { notifyAgentRunComplete } from "../services/notifications/agentRunNotice";
import { NotificationManager } from "../services/notifications/notificationManager";

vi.mock("../services/agentApi", () => ({
    askAgentStream: vi.fn(),
    decideAgent: vi.fn(),
    fetchAgentSessionDetail: vi.fn(async () => null),
    fetchAgentSessions: vi.fn(async () => []),
    fetchAgentUsage: vi.fn(async () => null),
    submitAgentFeedback: vi.fn(async () => true),
}));

vi.mock("../services/searchApi", () => ({
    searchSpotlight: vi.fn(async () => ({ results: [] })),
}));

vi.mock("../hooks/common/useSpotlightPreferences", () => ({
    useSpotlightPreferences: () => ({ aiAnswers: true, webSearch: true }),
}));

const makeManager = () => {
    const manager = new NotificationManager({ currentUserId: "me" });
    return { manager, notify: vi.spyOn(manager, "notify") };
};

describe("agent run completion notice — Spotlight", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        localStorage.clear();
    });

    it("notifies when the answer lands after the overlay was closed", async () => {
        // Hold the stream open so the overlay can be closed mid-answer —
        // this is the whole scenario the feature exists for.
        let finish: (() => void) | null = null;
        vi.mocked(askAgentStream).mockImplementation(async (args) => {
            args.onDelta("Partial…");
            finish = () => args.onDone("sess-1", "run-7");
        });

        const { manager, notify } = makeManager();
        const { result } = renderHook(() =>
            useSpotlight({
                accessToken: "test-token",
                teamId: "team-1",
                notificationManager: manager,
            })
        );

        act(() => result.current.open());
        act(() => result.current.onAsk("why did the deploy fail?"));
        act(() => result.current.close());
        expect(notify).not.toHaveBeenCalled(); // nothing has finished yet

        act(() => finish?.());

        await waitFor(() => expect(notify).toHaveBeenCalledTimes(1));
        const intent = notify.mock.calls[0][0];
        expect(intent.category).toBe("agent_run_done");
        expect(intent.id).toBe("agent-run:spotlight:run-7");
        expect(intent.body).toContain("why did the deploy fail?");
        // Stamping the asker as sender would make the manager drop this
        // as a self-notification — the asker IS the recipient here.
        expect(intent.senderId).toBeUndefined();
    });

    it("stays quiet when the overlay is still open", async () => {
        vi.mocked(askAgentStream).mockImplementation(async (args) => {
            args.onDelta("Because the migration timed out.");
            args.onDone("sess-1", "run-8");
        });

        const { manager, notify } = makeManager();
        const { result } = renderHook(() =>
            useSpotlight({
                accessToken: "test-token",
                teamId: "team-1",
                notificationManager: manager,
            })
        );

        act(() => result.current.open());
        act(() => result.current.onAsk("why did the deploy fail?"));

        await waitFor(() => expect(result.current.turns).toHaveLength(1));
        expect(notify).not.toHaveBeenCalled();
    });

    it("stays quiet for a run the user cancelled", async () => {
        let finish: (() => void) | null = null;
        vi.mocked(askAgentStream).mockImplementation(async (args) => {
            args.onDelta("Thinking…");
            finish = () => args.onDone("sess-1", "run-9");
        });

        const { manager, notify } = makeManager();
        const { result } = renderHook(() =>
            useSpotlight({
                accessToken: "test-token",
                teamId: "team-1",
                notificationManager: manager,
            })
        );

        act(() => result.current.open());
        act(() => result.current.onAsk("summarise the sprint"));
        act(() => result.current.onCancel());
        act(() => result.current.close());
        // A late event after an abort shouldn't resurrect the notice.
        act(() => finish?.());

        await waitFor(() => expect(result.current.ask.isStreaming).toBe(false));
        expect(notify).not.toHaveBeenCalled();
    });
});

describe("agent run completion notice — useAgentQA (thread / note surfaces)", () => {
    beforeEach(() => vi.clearAllMocks());

    it("fires onRunComplete exactly once even when error and done both arrive", async () => {
        // runNdjsonStream doesn't stop dispatching after an error event,
        // so both handlers really can fire for one turn.
        vi.mocked(askAgentStream).mockImplementation(async (args) => {
            args.onDelta("Half an answer");
            args.onError("stream died");
            args.onDone("sess-2", "run-10");
        });

        const onRunComplete = vi.fn();
        const { result } = renderHook(() =>
            useAgentQA({ accessToken: "t", teamId: "team-1", onRunComplete })
        );

        act(() => result.current.onAsk("what changed in the schema?"));

        await waitFor(() => expect(onRunComplete).toHaveBeenCalledTimes(1));
        const outcome = onRunComplete.mock.calls[0][0];
        expect(outcome.askedQuery).toBe("what changed in the schema?");
        // The mirrored answer must carry the deltas — reading `ask`
        // state from inside the handler would have returned "".
        expect(outcome.answer).toBe("Half an answer");
        expect(outcome.error).toBe("stream died");
    });

    it("reports the run id from a clean finish", async () => {
        vi.mocked(askAgentStream).mockImplementation(async (args) => {
            args.onDelta("All good.");
            args.onDone("sess-3", "run-11");
        });

        const onRunComplete = vi.fn();
        const { result } = renderHook(() =>
            useAgentQA({ accessToken: "t", teamId: "team-1", onRunComplete })
        );

        act(() => result.current.onAsk("status?"));

        await waitFor(() => expect(onRunComplete).toHaveBeenCalledTimes(1));
        expect(onRunComplete.mock.calls[0][0]).toMatchObject({
            runId: "run-11",
            error: null,
            answer: "All good.",
        });
    });

    it("still announces a turn whose id was reused after clearConversation", async () => {
        // clearConversation rewinds turnId to 0. If the already-notified
        // set weren't cleared alongside it, the first turn of the new
        // conversation would be silently swallowed.
        vi.mocked(askAgentStream).mockImplementation(async (args) => {
            args.onDelta("ok");
            args.onDone("sess-4", undefined);
        });

        const onRunComplete = vi.fn();
        const { result } = renderHook(() =>
            useAgentQA({ accessToken: "t", teamId: "team-1", onRunComplete })
        );

        act(() => result.current.onAsk("first"));
        await waitFor(() => expect(onRunComplete).toHaveBeenCalledTimes(1));

        act(() => result.current.clearConversation());
        act(() => result.current.onAsk("second"));

        await waitFor(() => expect(onRunComplete).toHaveBeenCalledTimes(2));
        expect(onRunComplete.mock.calls[1][0].askedQuery).toBe("second");
    });
});

describe("notifyAgentRunComplete", () => {
    it("is a no-op without a manager (Spotlight tests construct one without)", () => {
        expect(
            notifyAgentRunComplete(null, { surface: "spotlight", askedQuery: "x", turnId: 1 })
        ).toBeNull();
    });

    it("falls back to the turn id when the run never reported one", () => {
        const { manager, notify } = makeManager();
        notifyAgentRunComplete(manager, {
            surface: "note",
            askedQuery: "what does this note say?",
            runId: null,
            turnId: 3,
        });
        expect(notify.mock.calls[0][0].id).toBe("agent-run:note:3");
    });

    it("truncates a long question rather than dumping it into the card", () => {
        const { manager, notify } = makeManager();
        notifyAgentRunComplete(manager, {
            surface: "thread",
            askedQuery: "q".repeat(400),
            turnId: 1,
        });
        expect(notify.mock.calls[0][0].body.length).toBeLessThanOrEqual(121);
        expect(notify.mock.calls[0][0].body.endsWith("…")).toBe(true);
    });
});
