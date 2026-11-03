/**
 * A Genos conversation deleted from Settings -> What Genos remembers must not
 * linger anywhere that could still show it.
 *
 * The delete runs in a panel that cannot reach the hooks holding the state, so
 * it announces `agentSessionsDeleted` (see `features/agentQA/sessionEvents`).
 * These tests pin each listener: the live Spotlight / Genos-page conversation,
 * the History panel, the page's session sidebar, and the thread and note
 * "Ask" modals. The dangerous failure is the quiet one — a transcript left on
 * screen whose server-side session is gone, so the next follow-up silently
 * starts a new session without its context.
 */

import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
    deletionCoversSession,
    emitAgentSessionsDeleted,
    type AgentSessionsDeletedDetail,
} from "../features/agentQA";
import { useGenosSessions } from "../features/genos/useGenosSessions";
import { useNoteAsk } from "../features/noteAsk/useNoteAsk";
import { useSpotlight } from "../features/spotlight/useSpotlight";
import { useThreadAsk } from "../features/threadAsk/useThreadAsk";
import {
    askAgentStream,
    fetchAgentSessionDetail,
    fetchAgentSessions,
    fetchNoteSummary,
    fetchThreadSummary,
    type AgentSessionSummary,
} from "../services/agentApi";

vi.mock("../services/agentApi", async (importOriginal) => {
    const actual = await importOriginal<typeof import("../services/agentApi")>();
    return {
        ...actual,
        askAgentStream: vi.fn(),
        decideAgent: vi.fn(),
        fetchAgentSessionDetail: vi.fn(async () => null),
        fetchAgentSessions: vi.fn(async () => []),
        fetchThreadSummary: vi.fn(),
        fetchNoteSummary: vi.fn(),
        setAgentSessionPin: vi.fn(async () => true),
        submitAgentFeedback: vi.fn(async () => true),
    };
});
vi.mock("../services/searchApi", () => ({
    searchSpotlight: vi.fn(async () => ({ results: [] })),
}));
vi.mock("../hooks/common/useSpotlightPreferences", () => ({
    useSpotlightPreferences: () => ({ aiAnswers: true, webSearch: true }),
}));

const turn = (n: number) => ({
    run_id: `run-${n}`,
    query: `question ${n}`,
    answer: `answer ${n}`,
    status: "done",
    error: null,
    started_at: "2026-08-01T10:00:00Z",
    sources: [],
});

const detail = (sessionId: string) => ({
    session_id: sessionId,
    created_at: "2026-08-01T10:00:00Z",
    last_active_at: "2026-08-01T10:30:00Z",
    turns: [turn(1), turn(2)],
});

const row = (sessionId: string, firstQuery: string): AgentSessionSummary => ({
    session_id: sessionId,
    created_at: "2026-08-01T09:00:00Z",
    last_active_at: "2026-08-01T10:00:00Z",
    first_query: firstQuery,
    turn_count: 2,
    is_pinned: false,
});

const emit = (detail: AgentSessionsDeletedDetail) => act(() => emitAgentSessionsDeleted(detail));

beforeEach(() => {
    localStorage.clear();
    vi.mocked(askAgentStream).mockReset();
    vi.mocked(fetchAgentSessionDetail).mockReset().mockResolvedValue(null);
    vi.mocked(fetchAgentSessions).mockReset().mockResolvedValue([]);
});

describe("deletionCoversSession", () => {
    it("matches by id for a by-id deletion, in any team", () => {
        const d: AgentSessionsDeletedDetail = { teamId: "t1", sessionIds: ["a", "b"] };
        expect(deletionCoversSession(d, "a", "t1")).toBe(true);
        expect(deletionCoversSession(d, "a", "other")).toBe(true);
        expect(deletionCoversSession(d, "c", "t1")).toBe(false);
    });

    it("matches a delete-all only for the team the UI is showing", () => {
        const d: AgentSessionsDeletedDetail = { teamId: "t1", all: true };
        expect(deletionCoversSession(d, "anything", "t1")).toBe(true);
        expect(deletionCoversSession(d, "anything", "t2")).toBe(false);
        expect(deletionCoversSession(d, "anything", undefined)).toBe(false);
    });

    it("never covers a conversation that has no session yet", () => {
        expect(deletionCoversSession({ teamId: "t1", all: true }, null, "t1")).toBe(false);
        expect(deletionCoversSession({ teamId: "t1", sessionIds: ["a"] }, undefined, "t1")).toBe(
            false
        );
    });
});

describe("the live Spotlight / Genos page conversation", () => {
    const openConversation = async (sessionId = "sess-42") => {
        vi.mocked(fetchAgentSessionDetail).mockResolvedValue(detail(sessionId) as never);
        const hook = renderHook(() =>
            useSpotlight({ accessToken: "tok", teamId: "team-1", isPageActive: true })
        );
        act(() => hook.result.current.resumeSession(sessionId));
        await waitFor(() => expect(hook.result.current.turns).toHaveLength(2));
        expect(hook.result.current.ask.sessionId).toBe(sessionId);
        return hook;
    };

    it("is reset exactly like 'New conversation' when its session is deleted", async () => {
        const { result } = await openConversation();
        // The persistence effect snapshots the open conversation (debounced).
        await waitFor(
            () => {
                const raw = localStorage.getItem("spotlight:session:v1:team-1");
                expect(JSON.parse(raw as string).sessionId).toBe("sess-42");
            },
            { timeout: 2000 }
        );

        emit({ teamId: "team-1", sessionIds: ["sess-42"] });

        expect(result.current.turns).toEqual([]);
        expect(result.current.ask.sessionId).toBeNull();
        expect(result.current.ask.turnId).toBe(0);
        expect(result.current.historyMode).toBe("closed");

        // No ghost: what gets persisted afterwards is an empty conversation,
        // so a reload cannot bring the deleted session back.
        await waitFor(
            () => {
                const raw = localStorage.getItem("spotlight:session:v1:team-1");
                if (raw === null) return;
                const stored = JSON.parse(raw);
                expect(stored.sessionId).toBeNull();
                expect(stored.turns).toEqual([]);
            },
            { timeout: 2000 }
        );

        // And the next ask starts a brand-new conversation: no session id to
        // reuse, no `resume` flag claiming a transcript is on screen.
        act(() => result.current.onAsk("fresh start"));
        await waitFor(() => expect(askAgentStream).toHaveBeenCalledTimes(1));
        const args = vi.mocked(askAgentStream).mock.calls[0][0];
        expect(args.sessionId).toBeFalsy();
        expect(args).not.toHaveProperty("resume");
    });

    it("is left alone when a DIFFERENT conversation is deleted", async () => {
        const { result } = await openConversation();
        emit({ teamId: "team-1", sessionIds: ["some-other-session"] });
        expect(result.current.turns).toHaveLength(2);
        expect(result.current.ask.sessionId).toBe("sess-42");
    });

    it("is reset by a delete-all in this team", async () => {
        const { result } = await openConversation();
        emit({ teamId: "team-1", all: true });
        expect(result.current.turns).toEqual([]);
        expect(result.current.ask.sessionId).toBeNull();
    });

    it("is NOT reset by a delete-all in another team", async () => {
        const { result } = await openConversation();
        emit({ teamId: "team-2", all: true });
        expect(result.current.turns).toHaveLength(2);
        expect(result.current.ask.sessionId).toBe("sess-42");
    });
});

describe("the History panel", () => {
    it("drops deleted rows from the list", async () => {
        vi.mocked(fetchAgentSessions).mockResolvedValue([
            row("a", "first"),
            row("b", "second"),
            row("c", "third"),
        ]);
        const { result } = renderHook(() =>
            useSpotlight({ accessToken: "tok", teamId: "team-1" })
        );
        act(() => result.current.openHistory());
        await waitFor(() => expect(result.current.historySessions).toHaveLength(3));

        emit({ teamId: "team-1", sessionIds: ["b"] });
        expect(result.current.historySessions.map((s) => s.session_id)).toEqual(["a", "c"]);

        emit({ teamId: "team-1", all: true });
        expect(result.current.historySessions).toEqual([]);
    });

    it("keeps another team's delete-all out of this team's list", async () => {
        vi.mocked(fetchAgentSessions).mockResolvedValue([row("a", "first")]);
        const { result } = renderHook(() =>
            useSpotlight({ accessToken: "tok", teamId: "team-1" })
        );
        act(() => result.current.openHistory());
        await waitFor(() => expect(result.current.historySessions).toHaveLength(1));
        emit({ teamId: "team-2", all: true });
        expect(result.current.historySessions).toHaveLength(1);
    });

    it("closes a read-only view of a deleted session back to the list", async () => {
        vi.mocked(fetchAgentSessions).mockResolvedValue([row("a", "first"), row("b", "second")]);
        vi.mocked(fetchAgentSessionDetail).mockResolvedValue(detail("a") as never);
        const { result } = renderHook(() =>
            useSpotlight({ accessToken: "tok", teamId: "team-1" })
        );
        act(() => result.current.openHistory());
        await waitFor(() => expect(result.current.historySessions).toHaveLength(2));
        act(() => result.current.viewHistorySession("a"));
        await waitFor(() => expect(result.current.historyDetail?.session_id).toBe("a"));
        expect(result.current.historyMode).toBe("detail");

        emit({ teamId: "team-1", sessionIds: ["a"] });

        expect(result.current.historyDetail).toBeNull();
        expect(result.current.historyMode).toBe("list");
        expect(result.current.historySessions.map((s) => s.session_id)).toEqual(["b"]);
    });
});

describe("the Genos page session sidebar", () => {
    it("drops deleted rows, in every mounted instance", async () => {
        vi.mocked(fetchAgentSessions).mockResolvedValue([row("a", "first"), row("b", "second")]);
        const args = { accessToken: "tok", teamId: "team-1", refreshKey: 0 };
        // The page's sidebar and the settings panel each own one.
        const sidebar = renderHook(() => useGenosSessions(args));
        const settings = renderHook(() => useGenosSessions(args));
        await waitFor(() => expect(sidebar.result.current.sessions).toHaveLength(2));
        await waitFor(() => expect(settings.result.current.sessions).toHaveLength(2));

        emit({ teamId: "team-1", sessionIds: ["a"] });

        expect(sidebar.result.current.sessions.map((s) => s.session_id)).toEqual(["b"]);
        expect(settings.result.current.sessions.map((s) => s.session_id)).toEqual(["b"]);

        emit({ teamId: "team-1", all: true });
        expect(sidebar.result.current.sessions).toEqual([]);
        expect(settings.result.current.sessions).toEqual([]);
    });
});

describe("the thread and note Ask modals", () => {
    it("clears a thread conversation whose session was deleted, and only that one", async () => {
        vi.mocked(fetchThreadSummary).mockResolvedValue({
            summary: "s",
            generated: false,
            last_updated_iso: "2026-08-01T10:00:00Z",
            fingerprint: "f",
            message_count: 3,
            agent_session_id: "thread-sess",
            turns: [turn(1)],
        } as never);
        const { result } = renderHook(() =>
            useThreadAsk({ accessToken: "tok", teamId: "team-1" })
        );
        act(() => result.current.open({ chatType: 2, chatId: "c1", threadId: "m1" } as never));
        await waitFor(() => expect(result.current.agentQA.turns).toHaveLength(1));
        expect(result.current.agentQA.sessionId).toBe("thread-sess");

        emit({ teamId: "team-1", sessionIds: ["unrelated"] });
        expect(result.current.agentQA.turns).toHaveLength(1);

        emit({ teamId: "team-1", sessionIds: ["thread-sess"] });
        expect(result.current.agentQA.turns).toEqual([]);
        expect(result.current.agentQA.sessionId).toBeNull();
    });

    it("clears a note conversation on a delete-all in its team", async () => {
        vi.mocked(fetchNoteSummary).mockResolvedValue({
            summary: "s",
            generated: false,
            last_updated_iso: "2026-08-01T10:00:00Z",
            fingerprint: "f",
            agent_session_id: "note-sess",
            turns: [turn(1)],
        } as never);
        const { result } = renderHook(() => useNoteAsk({ accessToken: "tok", teamId: "team-1" }));
        act(() => result.current.open({ noteType: 1, noteId: "n1" } as never));
        await waitFor(() => expect(result.current.agentQA.turns).toHaveLength(1));

        emit({ teamId: "team-2", all: true });
        expect(result.current.agentQA.turns).toHaveLength(1);

        emit({ teamId: "team-1", all: true });
        expect(result.current.agentQA.turns).toEqual([]);
        expect(result.current.agentQA.sessionId).toBeNull();
    });
});
