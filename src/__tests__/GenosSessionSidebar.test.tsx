/**
 * Genos page "Ask history" sidebar tests.
 *
 * The sidebar is the page's history surface — unlike the overlay's
 * read-only archive, clicking a row RESUMES the session. These tests
 * pin the component contract (render, active highlight, callbacks), the
 * search + pin affordances that let a user reach an ask older than the
 * server's recent-list cap, and the `useGenosSessions` refresh model
 * (fetch on mount/team change/refreshKey bump, debounced search,
 * optimistic pinning).
 */

import { CssVarsProvider } from "@mui/joy/styles";
import { act, render, renderHook, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { GenosSessionSidebar } from "../features/genos/GenosSessionSidebar";
import { useGenosSessions } from "../features/genos/useGenosSessions";
import {
    fetchAgentSessions,
    setAgentSessionPin,
    type AgentSessionSummary,
} from "../services/agentApi";

vi.mock("../services/agentApi", async (importOriginal) => {
    const actual = await importOriginal<typeof import("../services/agentApi")>();
    return {
        ...actual,
        fetchAgentSessions: vi.fn(async () => []),
        setAgentSessionPin: vi.fn(async () => true),
    };
});

const SESSIONS: AgentSessionSummary[] = [
    {
        session_id: "sess-1",
        created_at: "2026-08-01T09:00:00Z",
        last_active_at: "2026-08-01T10:00:00Z",
        first_query: "what shipped last week?",
        turn_count: 3,
        is_pinned: false,
    },
    {
        session_id: "sess-2",
        created_at: "2026-08-01T08:00:00Z",
        last_active_at: "2026-08-01T08:30:00Z",
        first_query: "summarize the auth thread",
        turn_count: 1,
        is_pinned: false,
    },
];

const renderSidebar = (over: Partial<React.ComponentProps<typeof GenosSessionSidebar>> = {}) => {
    const props = {
        sessions: SESSIONS,
        isLoading: false,
        activeSessionId: null as string | null,
        resumeError: null as string | null,
        search: "",
        pinError: null as string | null,
        onSearchChange: vi.fn(),
        onTogglePin: vi.fn(),
        onSelectSession: vi.fn(),
        onNewChat: vi.fn(),
        ...over,
    };
    render(
        <CssVarsProvider>
            <GenosSessionSidebar {...props} />
        </CssVarsProvider>
    );
    return props;
};

describe("GenosSessionSidebar", () => {
    it("renders one row per session with first query and turn count", () => {
        renderSidebar();
        expect(screen.getByText("what shipped last week?")).toBeTruthy();
        expect(screen.getByText("summarize the auth thread")).toBeTruthy();
    });

    it("clicking a row resumes that session", async () => {
        const user = userEvent.setup();
        const props = renderSidebar();
        await user.click(screen.getByText("summarize the auth thread"));
        expect(props.onSelectSession).toHaveBeenCalledWith("sess-2");
    });

    it("marks the live session's row via aria-current", () => {
        renderSidebar({ activeSessionId: "sess-1" });
        const active = screen.getByText("what shipped last week?").closest("button");
        expect(active?.getAttribute("aria-current")).toBe("true");
        const inactive = screen.getByText("summarize the auth thread").closest("button");
        expect(inactive?.getAttribute("aria-current")).toBeNull();
    });

    it("New chat fires onNewChat", async () => {
        const user = userEvent.setup();
        const props = renderSidebar();
        await user.click(screen.getByText("New chat"));
        expect(props.onNewChat).toHaveBeenCalledTimes(1);
    });

    it("shows the resume-failure notice when set", () => {
        renderSidebar({ resumeError: "load failed" });
        expect(screen.getByText("Couldn't reopen that conversation.")).toBeTruthy();
    });

    it("shows the empty state without sessions", () => {
        renderSidebar({ sessions: [] });
        expect(
            screen.getByText("No conversations yet. Ask Genos anything to start one.")
        ).toBeTruthy();
    });
});

describe("GenosSessionSidebar search", () => {
    it("reports each keystroke so the hook can refetch", async () => {
        const user = userEvent.setup();
        const props = renderSidebar();

        await user.type(screen.getByPlaceholderText("Search past asks"), "auth");

        // Controlled input: `search` never changes in this harness, so
        // every keystroke reports a single character.
        expect(props.onSearchChange).toHaveBeenCalledTimes(4);
        expect(props.onSearchChange).toHaveBeenLastCalledWith("h");
    });

    it("clears the term from the clear button", async () => {
        const user = userEvent.setup();
        const props = renderSidebar({ search: "auth" });

        await user.click(screen.getByRole("button", { name: "Clear search" }));

        expect(props.onSearchChange).toHaveBeenCalledWith("");
    });

    it("has no clear button until something is typed", () => {
        renderSidebar();
        expect(screen.queryByRole("button", { name: "Clear search" })).toBeNull();
    });

    it("says no matches — not empty history — when a search finds nothing", () => {
        renderSidebar({ sessions: [], search: "nothing here" });

        // The distinction matters: "ask Genos anything to start one"
        // under a search would read as if the history had been lost.
        expect(screen.getByText("No past asks match that search.")).toBeTruthy();
        expect(
            screen.queryByText("No conversations yet. Ask Genos anything to start one.")
        ).toBeNull();
    });
});

describe("GenosSessionSidebar pinning", () => {
    const PINNED: AgentSessionSummary[] = [{ ...SESSIONS[1], is_pinned: true }, SESSIONS[0]];

    it("groups pinned rows above the rest", () => {
        renderSidebar({ sessions: PINNED });

        expect(screen.getByText("Pinned")).toBeTruthy();
        expect(screen.getByText("Recent")).toBeTruthy();
        // Server order is authoritative (pinned first); the component
        // splits rather than sorts, so the pinned row must come first
        // in the DOM even though it's the older session.
        const rows = screen.getAllByRole("button", { name: /shipped|summarize/ });
        expect(rows[0].textContent).toContain("summarize the auth thread");
    });

    it("drops the Recent heading when every row is pinned", () => {
        renderSidebar({ sessions: PINNED.map((s) => ({ ...s, is_pinned: true })) });

        expect(screen.getByText("Pinned")).toBeTruthy();
        expect(screen.queryByText("Recent")).toBeNull();
    });

    it("has no group headings at all when nothing is pinned", () => {
        renderSidebar();

        expect(screen.queryByText("Pinned")).toBeNull();
        expect(screen.queryByText("Recent")).toBeNull();
    });

    it("toggles a pin without resuming the session", async () => {
        const user = userEvent.setup();
        const props = renderSidebar();

        await user.click(screen.getAllByRole("button", { name: "Pin this ask" })[0]);

        expect(props.onTogglePin).toHaveBeenCalledWith("sess-1");
        // The pin button is a SIBLING of the row button, not a child —
        // nested buttons are invalid HTML and the click would also
        // resume the conversation the user meant to bookmark.
        expect(props.onSelectSession).not.toHaveBeenCalled();
    });

    it("offers unpin on an already-pinned row", () => {
        renderSidebar({ sessions: PINNED });

        const unpin = screen.getByRole("button", { name: "Unpin" });
        expect(unpin.getAttribute("aria-pressed")).toBe("true");
    });

    it("surfaces a rolled-back pin on its own row", () => {
        renderSidebar({ pinError: "sess-2" });

        expect(screen.getByText("Couldn't change that pin.")).toBeTruthy();
    });
});

describe("useGenosSessions refresh model", () => {
    beforeEach(() => {
        vi.mocked(fetchAgentSessions).mockClear();
        vi.mocked(fetchAgentSessions).mockResolvedValue(SESSIONS);
        vi.mocked(setAgentSessionPin).mockClear();
        vi.mocked(setAgentSessionPin).mockResolvedValue(true);
    });

    it("fetches on mount and exposes the list", async () => {
        const { result } = renderHook(() =>
            useGenosSessions({ accessToken: "tok", teamId: "team-1", refreshKey: 0 })
        );
        await waitFor(() => {
            expect(result.current.sessions).toHaveLength(2);
        });
        expect(fetchAgentSessions).toHaveBeenCalledTimes(1);
    });

    it("refetches when refreshKey bumps (turn completed) and on team change", async () => {
        const { result, rerender } = renderHook(
            ({ teamId, refreshKey }: { teamId: string; refreshKey: number }) =>
                useGenosSessions({ accessToken: "tok", teamId, refreshKey }),
            { initialProps: { teamId: "team-1", refreshKey: 0 } }
        );
        await waitFor(() => expect(result.current.sessions).toHaveLength(2));

        rerender({ teamId: "team-1", refreshKey: 1 });
        await waitFor(() => expect(fetchAgentSessions).toHaveBeenCalledTimes(2));

        rerender({ teamId: "team-2", refreshKey: 1 });
        await waitFor(() => expect(fetchAgentSessions).toHaveBeenCalledTimes(3));
    });

    it("clears the list without auth/team", async () => {
        const { result } = renderHook(() =>
            useGenosSessions({ accessToken: null, teamId: "team-1", refreshKey: 0 })
        );
        expect(result.current.sessions).toEqual([]);
        expect(fetchAgentSessions).not.toHaveBeenCalled();
    });
});

describe("useGenosSessions search", () => {
    const mount = () =>
        renderHook(() =>
            useGenosSessions({ accessToken: "tok", teamId: "team-1", refreshKey: 0 })
        );

    beforeEach(() => {
        vi.mocked(fetchAgentSessions).mockClear();
        vi.mocked(fetchAgentSessions).mockResolvedValue(SESSIONS);
    });

    it("debounces keystrokes into one search request", async () => {
        vi.useFakeTimers();
        try {
            const { result } = mount();
            await vi.waitFor(() => expect(fetchAgentSessions).toHaveBeenCalledTimes(1));

            act(() => result.current.setSearch("a"));
            act(() => result.current.setSearch("au"));
            act(() => result.current.setSearch("auth"));

            // The box tracks every keystroke; the wire doesn't.
            expect(result.current.search).toBe("auth");
            expect(fetchAgentSessions).toHaveBeenCalledTimes(1);

            await act(async () => {
                vi.advanceTimersByTime(400);
            });

            expect(fetchAgentSessions).toHaveBeenCalledTimes(2);
            expect(vi.mocked(fetchAgentSessions).mock.calls[1][0]).toMatchObject({
                search: "auth",
                teamId: "team-1",
            });
        } finally {
            vi.useRealTimers();
        }
    });

    it("refetches the full list immediately when the box is cleared", async () => {
        vi.useFakeTimers();
        try {
            const { result } = mount();
            await vi.waitFor(() => expect(fetchAgentSessions).toHaveBeenCalledTimes(1));

            act(() => result.current.setSearch("auth"));
            await act(async () => {
                vi.advanceTimersByTime(400);
            });
            expect(fetchAgentSessions).toHaveBeenCalledTimes(2);

            // No debounce on the way back: the user wants their list.
            act(() => result.current.setSearch(""));
            await act(async () => {});

            expect(fetchAgentSessions).toHaveBeenCalledTimes(3);
            expect(vi.mocked(fetchAgentSessions).mock.calls[2][0]).toMatchObject({ search: "" });
        } finally {
            vi.useRealTimers();
        }
    });
});

describe("useGenosSessions pinning", () => {
    beforeEach(() => {
        vi.mocked(fetchAgentSessions).mockClear();
        vi.mocked(fetchAgentSessions).mockResolvedValue(SESSIONS);
        vi.mocked(setAgentSessionPin).mockClear();
        vi.mocked(setAgentSessionPin).mockResolvedValue(true);
    });

    it("flips the row immediately, then refetches for the server's order", async () => {
        const { result } = renderHook(() =>
            useGenosSessions({ accessToken: "tok", teamId: "team-1", refreshKey: 0 })
        );
        await waitFor(() => expect(result.current.sessions).toHaveLength(2));

        act(() => result.current.togglePin("sess-1"));

        // Optimistic: the icon can't wait for a round trip.
        expect(result.current.sessions[0].is_pinned).toBe(true);
        expect(setAgentSessionPin).toHaveBeenCalledWith({
            accessToken: "tok",
            pinned: true,
            sessionId: "sess-1",
        });
        // Ordering (pinned first, newest pin first) and which pins are
        // exempt from the recent cap are the server's call, so a
        // successful toggle re-reads rather than re-sorting locally.
        await waitFor(() => expect(fetchAgentSessions).toHaveBeenCalledTimes(2));
    });

    it("unpins a pinned row", async () => {
        vi.mocked(fetchAgentSessions).mockResolvedValue([{ ...SESSIONS[0], is_pinned: true }]);
        const { result } = renderHook(() =>
            useGenosSessions({ accessToken: "tok", teamId: "team-1", refreshKey: 0 })
        );
        await waitFor(() => expect(result.current.sessions).toHaveLength(1));

        act(() => result.current.togglePin("sess-1"));

        expect(result.current.sessions[0].is_pinned).toBe(false);
        expect(setAgentSessionPin).toHaveBeenCalledWith({
            accessToken: "tok",
            pinned: false,
            sessionId: "sess-1",
        });
    });

    it("rolls the flip back and names the row when the server refuses", async () => {
        vi.mocked(setAgentSessionPin).mockResolvedValue(false);
        const { result } = renderHook(() =>
            useGenosSessions({ accessToken: "tok", teamId: "team-1", refreshKey: 0 })
        );
        await waitFor(() => expect(result.current.sessions).toHaveLength(2));

        act(() => result.current.togglePin("sess-1"));

        await waitFor(() => expect(result.current.pinError).toBe("sess-1"));
        expect(result.current.sessions[0].is_pinned).toBe(false);
        // A failed pin must not trigger the success refetch, or the
        // rollback would be overwritten by a list that never changed.
        expect(fetchAgentSessions).toHaveBeenCalledTimes(1);
    });
});
