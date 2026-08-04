/**
 * Page-mode (`isPageActive`) + session-resume tests for `useSpotlight`.
 *
 * The Genos page renders the same SpotlightContent the overlay does,
 * driven by the SAME hook instance at the App root. These tests pin
 * the contract that makes that sharing work:
 *   - the search pipeline runs while the page is active with the
 *     overlay closed, and transient query/filter state survives an
 *     overlay close while the page is active (overlay→page handoff);
 *   - Cmd/Ctrl-K hands focus to the page input instead of opening the
 *     overlay while the page is active;
 *   - `resumeSession` restores an archived session into the LIVE
 *     conversation (turns + sessionId + localStorage snapshot), and
 *     the next ask carries `resume: true` so the backend reuses an
 *     idle-expired session instead of silently forking it.
 */

import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useSpotlight } from "../features/spotlight/useSpotlight";
import { askAgentStream, fetchAgentSessionDetail } from "../services/agentApi";
import { searchSpotlight } from "../services/searchApi";

vi.mock("../services/agentApi", async (importOriginal) => {
    const actual = await importOriginal<typeof import("../services/agentApi")>();
    return {
        ...actual,
        askAgentStream: vi.fn(),
        decideAgent: vi.fn(),
        fetchAgentSessionDetail: vi.fn(async () => null),
        fetchAgentSessions: vi.fn(async () => []),
        submitAgentFeedback: vi.fn(async () => true),
    };
});

vi.mock("../services/searchApi", () => ({
    searchSpotlight: vi.fn(async () => ({ results: [] })),
}));

vi.mock("../hooks/common/useSpotlightPreferences", () => ({
    useSpotlightPreferences: () => ({ aiAnswers: true, webSearch: true }),
}));

const SESSION_DETAIL = {
    session_id: "sess-42",
    created_at: "2026-08-01T10:00:00Z",
    last_active_at: "2026-08-01T10:30:00Z",
    turns: [
        {
            run_id: "run-1",
            query: "what is blocked?",
            answer: "Two tasks are blocked.",
            status: "done",
            error: null,
            started_at: "2026-08-01T10:00:00Z",
            sources: [],
        },
        {
            run_id: "run-2",
            query: "why?",
            answer: "",
            status: "error",
            error: "boom",
            started_at: "2026-08-01T10:10:00Z",
            sources: [],
        },
    ],
};

// Ctrl-K works on every platform in the hook (`mac ? metaKey : ctrlKey`
// with jsdom reporting non-mac), so tests dispatch ctrlKey.
const pressCtrlK = () => {
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "k", ctrlKey: true }));
};

describe("useSpotlight page mode", () => {
    beforeEach(() => {
        vi.mocked(searchSpotlight).mockClear();
        vi.mocked(askAgentStream).mockClear();
        vi.mocked(fetchAgentSessionDetail).mockClear();
        localStorage.clear();
    });

    it("runs the search pipeline while the page is active with the overlay closed", async () => {
        const { result } = renderHook(() =>
            useSpotlight({ accessToken: "test-token", teamId: "team-1", isPageActive: true })
        );
        expect(result.current.isOpen).toBe(false);
        act(() => {
            result.current.setQuery("meeting");
        });
        await waitFor(() => {
            expect(searchSpotlight).toHaveBeenCalledTimes(2);
        });
    });

    it("keeps query/filter state when the overlay closes while the page is active", async () => {
        const { result } = renderHook(() =>
            useSpotlight({ accessToken: "test-token", teamId: "team-1", isPageActive: true })
        );
        act(() => {
            result.current.open();
            result.current.setQuery("meeting");
            result.current.onToggleFilterService("task");
        });
        act(() => {
            result.current.close();
        });
        // Page still active → the close reset is skipped.
        expect(result.current.query).toBe("meeting");
        expect(result.current.filterServices).toEqual(["task"]);
    });

    it("wipes derived state but keeps the draft query when neither surface is showing", async () => {
        const { result, rerender } = renderHook(
            ({ pageActive }: { pageActive: boolean }) =>
                useSpotlight({
                    accessToken: "test-token",
                    teamId: "team-1",
                    isPageActive: pageActive,
                }),
            { initialProps: { pageActive: true } }
        );
        act(() => {
            result.current.setQuery("meeting");
            result.current.onToggleFilterService("task");
        });
        // Navigating away from the page (overlay closed the whole time).
        rerender({ pageActive: false });
        await waitFor(() => {
            expect(result.current.filterServices).toEqual([]);
        });
        expect(result.current.results).toEqual([]);
        // The unsent draft is user-authored — it survives so the next
        // open (either surface) restores what was being composed.
        expect(result.current.query).toBe("meeting");
    });

    it("still clears the input after an ask is submitted", async () => {
        const { result } = renderHook(() =>
            useSpotlight({ accessToken: "test-token", teamId: "team-1", isPageActive: true })
        );
        act(() => {
            result.current.setQuery("what is blocked?");
        });
        act(() => {
            result.current.onAsk();
        });
        await waitFor(() => {
            expect(askAgentStream).toHaveBeenCalledTimes(1);
        });
        // Draft preservation must not resurrect a question already sent.
        expect(result.current.query).toBe("");
    });

    it("Ctrl-K focuses the page input instead of opening the overlay while the page is active", () => {
        const { result } = renderHook(() =>
            useSpotlight({ accessToken: "test-token", teamId: "team-1", isPageActive: true })
        );
        const focus = vi.fn();
        act(() => {
            result.current.registerPageInputFocus(focus);
        });
        act(() => {
            pressCtrlK();
        });
        expect(focus).toHaveBeenCalledTimes(1);
        expect(result.current.isOpen).toBe(false);
    });

    it("Ctrl-K still toggles the overlay when the page is not active", () => {
        const { result } = renderHook(() =>
            useSpotlight({ accessToken: "test-token", teamId: "team-1" })
        );
        const focus = vi.fn();
        act(() => {
            result.current.registerPageInputFocus(focus);
        });
        act(() => {
            pressCtrlK();
        });
        expect(result.current.isOpen).toBe(true);
        expect(focus).not.toHaveBeenCalled();
        act(() => {
            pressCtrlK();
        });
        expect(result.current.isOpen).toBe(false);
    });

    it("Ctrl-K with the overlay open on the page still closes it", () => {
        const { result } = renderHook(() =>
            useSpotlight({ accessToken: "test-token", teamId: "team-1", isPageActive: true })
        );
        act(() => {
            result.current.open();
        });
        act(() => {
            pressCtrlK();
        });
        expect(result.current.isOpen).toBe(false);
    });
});

describe("useSpotlight resumeSession", () => {
    beforeEach(() => {
        vi.mocked(searchSpotlight).mockClear();
        vi.mocked(askAgentStream).mockClear();
        vi.mocked(fetchAgentSessionDetail).mockClear();
        localStorage.clear();
    });

    it("restores turns + sessionId from the archive, keeping error turns", async () => {
        vi.mocked(fetchAgentSessionDetail).mockResolvedValue(
            SESSION_DETAIL as never // wire shape; only mapped fields matter
        );
        const { result } = renderHook(() =>
            useSpotlight({ accessToken: "test-token", teamId: "team-1", isPageActive: true })
        );
        act(() => {
            result.current.resumeSession("sess-42");
        });
        await waitFor(() => {
            expect(result.current.turns).toHaveLength(2);
        });
        expect(result.current.ask.sessionId).toBe("sess-42");
        // Next ask id continues past the restored ids.
        expect(result.current.ask.turnId).toBe(2);
        expect(result.current.turns[0]).toMatchObject({
            id: 1,
            askedQuery: "what is blocked?",
            answer: "Two tasks are blocked.",
            toolEvents: [],
            runId: "run-1",
        });
        // The error turn stays in the transcript.
        expect(result.current.turns[1]).toMatchObject({ id: 2, askError: "boom" });
        expect(result.current.resumeError).toBeNull();
    });

    it("persists the restored conversation to localStorage", async () => {
        vi.mocked(fetchAgentSessionDetail).mockResolvedValue(SESSION_DETAIL as never);
        const { result } = renderHook(() =>
            useSpotlight({ accessToken: "test-token", teamId: "team-1", isPageActive: true })
        );
        act(() => {
            result.current.resumeSession("sess-42");
        });
        await waitFor(() => {
            expect(result.current.turns).toHaveLength(2);
        });
        // The persistence effect debounces 500 ms.
        await waitFor(
            () => {
                const raw = localStorage.getItem("spotlight:session:v1:team-1");
                expect(raw).toBeTruthy();
                const stored = JSON.parse(raw as string);
                expect(stored.version).toBe(1);
                expect(stored.sessionId).toBe("sess-42");
                expect(stored.turns).toHaveLength(2);
            },
            { timeout: 2000 }
        );
    });

    it("keeps the current conversation and surfaces resumeError on a failed fetch", async () => {
        // fetchAgentSessionDetail resolves null on any failure (404
        // outside retention, network error) — it never rejects.
        vi.mocked(fetchAgentSessionDetail).mockResolvedValue(null);
        const { result } = renderHook(() =>
            useSpotlight({ accessToken: "test-token", teamId: "team-1", isPageActive: true })
        );
        act(() => {
            result.current.resumeSession("sess-gone");
        });
        await waitFor(() => {
            expect(result.current.resumeError).toBeTruthy();
        });
        expect(result.current.turns).toHaveLength(0);
        expect(result.current.resumeIsLoading).toBe(false);
    });

    it("sends resume: true on an ask that continues a visible transcript, omits it otherwise", async () => {
        vi.mocked(fetchAgentSessionDetail).mockResolvedValue(SESSION_DETAIL as never);
        const { result } = renderHook(() =>
            useSpotlight({ accessToken: "test-token", teamId: "team-1", isPageActive: true })
        );

        // Fresh conversation: no turns, no session → flag omitted.
        act(() => {
            result.current.onAsk("first question");
        });
        await waitFor(() => {
            expect(askAgentStream).toHaveBeenCalledTimes(1);
        });
        expect(vi.mocked(askAgentStream).mock.calls[0][0]).not.toHaveProperty("resume");

        // Restored session: transcript on screen → flag rides along.
        act(() => {
            result.current.resumeSession("sess-42");
        });
        await waitFor(() => {
            expect(result.current.turns).toHaveLength(2);
        });
        act(() => {
            result.current.onAsk("follow up");
        });
        await waitFor(() => {
            expect(askAgentStream).toHaveBeenCalledTimes(2);
        });
        const followUpArgs = vi.mocked(askAgentStream).mock.calls[1][0];
        expect(followUpArgs.sessionId).toBe("sess-42");
        expect(followUpArgs.resume).toBe(true);
    });
});
