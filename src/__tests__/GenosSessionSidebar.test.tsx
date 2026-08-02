/**
 * Genos page "Ask history" sidebar tests.
 *
 * The sidebar is the page's history surface — unlike the overlay's
 * read-only archive, clicking a row RESUMES the session. These tests
 * pin the component contract (render, active highlight, callbacks) and
 * the `useGenosSessions` refresh model (fetch on mount/team change/
 * refreshKey bump).
 */

import { CssVarsProvider } from "@mui/joy/styles";
import { render, renderHook, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { GenosSessionSidebar } from "../features/genos/GenosSessionSidebar";
import { useGenosSessions } from "../features/genos/useGenosSessions";
import { fetchAgentSessions, type AgentSessionSummary } from "../services/agentApi";

vi.mock("../services/agentApi", async (importOriginal) => {
    const actual = await importOriginal<typeof import("../services/agentApi")>();
    return {
        ...actual,
        fetchAgentSessions: vi.fn(async () => []),
    };
});

const SESSIONS: AgentSessionSummary[] = [
    {
        session_id: "sess-1",
        created_at: "2026-08-01T09:00:00Z",
        last_active_at: "2026-08-01T10:00:00Z",
        first_query: "what shipped last week?",
        turn_count: 3,
    },
    {
        session_id: "sess-2",
        created_at: "2026-08-01T08:00:00Z",
        last_active_at: "2026-08-01T08:30:00Z",
        first_query: "summarize the auth thread",
        turn_count: 1,
    },
];

const renderSidebar = (over: Partial<React.ComponentProps<typeof GenosSessionSidebar>> = {}) => {
    const props = {
        sessions: SESSIONS,
        isLoading: false,
        activeSessionId: null as string | null,
        resumeError: null as string | null,
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

describe("useGenosSessions refresh model", () => {
    beforeEach(() => {
        vi.mocked(fetchAgentSessions).mockClear();
        vi.mocked(fetchAgentSessions).mockResolvedValue(SESSIONS);
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
