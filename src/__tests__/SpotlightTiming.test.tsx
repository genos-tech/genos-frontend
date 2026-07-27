// Timing display for agent turns — the stream's server-measured
// `duration_ms` (per tool) and `elapsed_ms` (per turn) must survive the
// hook state machine and reach the UI:
//   1. formatDurationMs renders ms below a second, one-decimal seconds above.
//   2. useSpotlight copies duration_ms onto the matching ToolEvent and
//      elapsed_ms onto the promoted turn.
//   3. ToolProgressList shows a duration only for events that carry one
//      (pending rows and cache hits have none).
// All fields are optional on the wire — the old-backend case (nothing
// sent) must leave the UI exactly as it was before.

import { CssVarsProvider } from "@mui/joy/styles";
import { act, render, renderHook, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { formatDurationMs, ToolProgressList, type ToolEvent } from "../features/agentQA";
import { useSpotlight } from "../features/spotlight/useSpotlight";
import { askAgentStream } from "../services/agentApi";

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

describe("formatDurationMs", () => {
    it("uses ms below one second and one-decimal seconds above", () => {
        expect(formatDurationMs(0)).toBe("0ms");
        expect(formatDurationMs(999)).toBe("999ms");
        expect(formatDurationMs(1000)).toBe("1.0s");
        expect(formatDurationMs(12440)).toBe("12.4s");
    });
});

describe("useSpotlight timing capture", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        localStorage.clear();
    });

    it("copies duration_ms onto the tool event and elapsed_ms onto the promoted turn", async () => {
        vi.mocked(askAgentStream).mockImplementation(async (args) => {
            args.onToolStart?.({ step: 0, tool_name: "search_kb", arguments: {} });
            args.onToolResult?.({
                step: 0,
                tool_name: "search_kb",
                summary: "found 3",
                duration_ms: 456,
            });
            args.onDelta("answer");
            args.onDone("sess-1", "run-1", 9876);
        });

        const { result } = renderHook(() =>
            useSpotlight({ accessToken: "test-token", teamId: "team-1" })
        );

        act(() => {
            result.current.onAsk("q");
        });

        await waitFor(() => {
            expect(result.current.turns).toHaveLength(1);
        });
        expect(result.current.turns[0].elapsedMs).toBe(9876);
        expect(result.current.turns[0].toolEvents[0].duration_ms).toBe(456);
    });

    it("leaves elapsedMs null when an old backend sends no timing", async () => {
        vi.mocked(askAgentStream).mockImplementation(async (args) => {
            args.onDelta("answer");
            args.onDone("sess-1", "run-1");
        });

        const { result } = renderHook(() =>
            useSpotlight({ accessToken: "test-token", teamId: "team-1" })
        );

        act(() => {
            result.current.onAsk("q");
        });

        await waitFor(() => {
            expect(result.current.turns).toHaveLength(1);
        });
        expect(result.current.turns[0].elapsedMs ?? null).toBeNull();
    });
});

describe("ToolProgressList durations", () => {
    it("shows a duration for timed events and none for untimed ones", () => {
        const events: ToolEvent[] = [
            {
                step: 0,
                tool_name: "search_kb",
                arguments: {},
                status: "done",
                summary: "found 3",
                duration_ms: 1230,
            },
            // Cache hit / old backend: no duration field at all.
            {
                step: 1,
                tool_name: "list_tasks",
                arguments: {},
                status: "done",
                summary: "12 tasks",
            },
        ];
        render(
            <CssVarsProvider>
                <ToolProgressList events={events} isDark={false} />
            </CssVarsProvider>
        );
        expect(screen.getByText("1.2s")).toBeInTheDocument();
        expect(screen.getByText("12 tasks")).toBeInTheDocument();
        // Exactly one timing chip — the untimed row renders none.
        expect(screen.getAllByText(/^\d+(\.\d+)?(ms|s)$/)).toHaveLength(1);
    });
});
