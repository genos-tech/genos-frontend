// Spotlight F1 wiring — the run_id → 👍/👎 pipeline in useSpotlight.
// Two contracts:
//   1. The `done` stream event's run_id is captured into the live ask
//      state and survives promotion into the `turns` history (that id
//      is what keys the feedback POST — without it thumbs stay hidden).
//   2. `submitFeedback` forwards (runId, rating) to the shared
//      services/agentApi.submitAgentFeedback with the access token.

import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useSpotlight } from "../features/spotlight/useSpotlight";
import { askAgentStream, submitAgentFeedback } from "../services/agentApi";

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

// The preferences hook reads Settings state that needs a provider tree;
// pin both gates open so onAsk actually fires.
vi.mock("../hooks/common/useSpotlightPreferences", () => ({
    useSpotlightPreferences: () => ({ aiAnswers: true, webSearch: true }),
}));

describe("Spotlight feedback wiring (F1)", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        localStorage.clear();
    });

    it("captures run_id from the done event and carries it into the promoted turn", async () => {
        vi.mocked(askAgentStream).mockImplementation(async (args) => {
            args.onDelta("The perf budget is Lighthouse 95.");
            args.onDone("sess-1", "run-42");
        });

        const { result } = renderHook(() =>
            useSpotlight({ accessToken: "test-token", teamId: "team-1" })
        );

        act(() => {
            result.current.onAsk("what is the perf budget?");
        });

        await waitFor(() => {
            expect(result.current.turns).toHaveLength(1);
        });
        expect(result.current.turns[0].runId).toBe("run-42");
        expect(result.current.turns[0].answer).toContain("Lighthouse 95");
    });

    it("leaves runId unset when the stream errors before done (thumbs stay hidden)", async () => {
        vi.mocked(askAgentStream).mockImplementation(async (args) => {
            args.onError("boom");
        });

        const { result } = renderHook(() =>
            useSpotlight({ accessToken: "test-token", teamId: "team-1" })
        );

        act(() => {
            result.current.onAsk("anything");
        });

        await waitFor(() => {
            expect(result.current.turns).toHaveLength(1);
        });
        expect(result.current.turns[0].runId ?? null).toBeNull();
        expect(result.current.turns[0].askError).toBe("boom");
    });

    it("submitFeedback POSTs the rating via submitAgentFeedback", () => {
        const { result } = renderHook(() =>
            useSpotlight({ accessToken: "test-token", teamId: "team-1" })
        );

        act(() => {
            result.current.submitFeedback("run-42", 1);
        });

        expect(submitAgentFeedback).toHaveBeenCalledWith({
            runId: "run-42",
            rating: 1,
            accessToken: "test-token",
        });
    });

    it("submitFeedback is a no-op without an access token", () => {
        const { result } = renderHook(() => useSpotlight({ accessToken: null, teamId: "team-1" }));

        act(() => {
            result.current.submitFeedback("run-42", 1);
        });

        expect(submitAgentFeedback).not.toHaveBeenCalled();
    });
});
