/**
 * `useTaskAsk` (MIP-1057): a task or milestone keeps its own Ask conversation.
 *
 * The transport is mocked; the shared ask machine (`useAgentQA`), the real `isTaskId` and the real
 * Spotlight hook are not. What is pinned here is what a member would feel if it broke: reopening shows
 * the conversation, a task of a shared project is asked in the HOST team, a deleted task ends the
 * conversation calmly and never loops, "New conversation" really starts another one, and the general
 * (Cmd-K / Genos page) conversation is never touched.
 */

import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { emitAgentSessionsDeleted, type AgentMentionRef } from "../features/agentQA";
import { useSpotlight } from "../features/spotlight/useSpotlight";
import {
    isUsableTaskAskTarget,
    resolveTaskTeamId,
    taskAskMention,
    type TaskAskTarget,
} from "../features/taskAsk";
import { useTaskAsk, withTaskMention } from "../features/taskAsk/useTaskAsk";
import {
    askAgentStream,
    fetchAgentSessionDetail,
    fetchTaskSession,
    type TaskSessionResult,
} from "../services/agentApi";
import { NotificationManager } from "../services/notifications/notificationManager";
import { NotificationsProvider } from "../services/notifications/NotificationsContext";

vi.mock("../services/agentApi", async (importOriginal) => {
    const actual = await importOriginal<typeof import("../services/agentApi")>();
    return {
        ...actual,
        askAgentStream: vi.fn(),
        decideAgent: vi.fn(),
        fetchAgentSessionDetail: vi.fn(async () => null),
        fetchAgentSessions: vi.fn(async () => []),
        fetchTaskSession: vi.fn(),
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

const TARGET: TaskAskTarget = {
    taskId: 2039,
    teamId: "team-1",
    displayId: "MIP-1057",
    title: "Per-object Ask sessions",
    isMilestone: false,
};
const OTHER: TaskAskTarget = {
    taskId: 2040,
    teamId: "team-1",
    displayId: "MIP-1058",
    title: "Ask about a message",
    isMilestone: false,
};

const turn = (n: number) => ({
    run_id: `run-${n}`,
    query: `question ${n}`,
    answer: `answer ${n}`,
    status: "done",
    error: null,
    started_at: "2026-11-14T10:00:00Z",
    sources: [],
});

const restored = (sessionId: string | null, n = 2): TaskSessionResult => ({
    kind: "ok",
    agentSessionId: sessionId,
    turns: sessionId ? Array.from({ length: n }, (_, i) => turn(i + 1)) : [],
});

type AskArgs = Parameters<typeof askAgentStream>[0];
const lastAsk = (): AskArgs => {
    const calls = vi.mocked(askAgentStream).mock.calls;
    return calls[calls.length - 1][0];
};

const mount = (teamId = "team-1") =>
    renderHook(
        (props: { teamId: string }) => useTaskAsk({ accessToken: "tok", teamId: props.teamId }),
        {
            initialProps: { teamId },
        }
    );

/** Open the window on `target` and wait for the restore to settle. */
const openAndSettle = async (
    hook: ReturnType<typeof mount>,
    target: TaskAskTarget = TARGET,
    status: string = "ready"
) => {
    act(() => hook.result.current.open(target));
    await waitFor(() => expect(hook.result.current.status).toBe(status));
};

beforeEach(() => {
    localStorage.clear();
    vi.mocked(askAgentStream).mockReset();
    vi.mocked(fetchTaskSession).mockReset().mockResolvedValue(restored(null));
    vi.mocked(fetchAgentSessionDetail).mockReset().mockResolvedValue(null);
});

// --- the pure pieces ---------------------------------------------------------------------------

describe("which team a task is asked in", () => {
    const projects = [
        { projectId: 1, isExternal: undefined, hostTeamId: undefined },
        { projectId: 2, isExternal: true, hostTeamId: "host-7" },
    ];

    it("the host team for a task of a project another team shared", () => {
        expect(resolveTaskTeamId(2, projects, "team-1")).toBe("host-7");
    });

    it("the current team for an ordinary project, an unknown one, or none", () => {
        expect(resolveTaskTeamId(1, projects, "team-1")).toBe("team-1");
        expect(resolveTaskTeamId(99, projects, "team-1")).toBe("team-1");
        expect(resolveTaskTeamId(null, projects, "team-1")).toBe("team-1");
        expect(resolveTaskTeamId(undefined, [], "team-1")).toBe("team-1");
    });

    it("is null when there is no team to ask in", () => {
        expect(resolveTaskTeamId(1, projects, null)).toBeNull();
        expect(resolveTaskTeamId(1, projects, "")).toBeNull();
    });

    it("an external project with no host id is not a reason to guess", () => {
        expect(resolveTaskTeamId(3, [{ projectId: 3, isExternal: true }], "team-1")).toBe(
            "team-1"
        );
    });
});

describe("the target and its mention", () => {
    it("a usable target has a positive integer id and a team", () => {
        expect(isUsableTaskAskTarget(TARGET)).toBe(true);
        expect(isUsableTaskAskTarget({ ...TARGET, taskId: 0 })).toBe(false);
        expect(isUsableTaskAskTarget({ ...TARGET, taskId: 1.5 })).toBe(false);
        expect(isUsableTaskAskTarget({ ...TARGET, teamId: "" })).toBe(false);
        expect(isUsableTaskAskTarget(null)).toBe(false);
    });

    it("the mention is the task's own id, labelled by its display id; a milestone is a task", () => {
        expect(taskAskMention(TARGET)).toEqual({
            kind: "task",
            taskId: 2039,
            label: "MIP-1057",
        });
        expect(taskAskMention({ ...TARGET, isMilestone: true })).toMatchObject({
            kind: "task",
            taskId: 2039,
            isMilestone: true,
        });
        // No display id: the title names it. Nothing to call it by: no mention.
        expect(taskAskMention({ ...TARGET, displayId: null })?.label).toBe(TARGET.title);
        expect(taskAskMention({ ...TARGET, displayId: null, title: " " })).toBeNull();
    });

    it("withTaskMention puts the task first, keeps what was picked, and never lists it twice", () => {
        const picked: AgentMentionRef = { kind: "user", userId: "u1", label: "Alice" };
        const task = taskAskMention(TARGET)!;
        expect(withTaskMention([picked], task)).toEqual([task, picked]);
        expect(withTaskMention(undefined, task)).toEqual([task]);
        expect(withTaskMention([task, picked], task)).toEqual([task, picked]);
        // The same task picked from the # menu under another label is still the task.
        const pickedTask: AgentMentionRef = { kind: "task", taskId: 2039, label: "something" };
        expect(withTaskMention([pickedTask], task)).toEqual([pickedTask]);
        expect(withTaskMention([picked], null)).toEqual([picked]);
        expect(withTaskMention(undefined, null)).toBeUndefined();
    });
});

// --- restore on open ---------------------------------------------------------------------------

describe("opening the window restores the task's conversation", () => {
    it("asks the server for THIS task in THIS team, then shows the turns and keeps the session", async () => {
        vi.mocked(fetchTaskSession).mockResolvedValue(restored("sess-task"));
        const hook = mount();
        act(() => hook.result.current.open(TARGET));
        expect(hook.result.current.status).toBe("loading");
        await waitFor(() => expect(hook.result.current.status).toBe("ready"));

        expect(fetchTaskSession).toHaveBeenCalledTimes(1);
        expect(vi.mocked(fetchTaskSession).mock.calls[0][0]).toMatchObject({
            accessToken: "tok",
            teamId: "team-1",
            taskId: 2039,
        });
        expect(hook.result.current.agentQA.turns.map((t) => t.askedQuery)).toEqual([
            "question 1",
            "question 2",
        ]);
        expect(hook.result.current.agentQA.sessionId).toBe("sess-task");
        expect(hook.result.current.target).toEqual(TARGET);
        expect(hook.result.current.isOpen).toBe(true);
    });

    it("the restore of a task of a shared project goes to the HOST team, whatever team the person is in", async () => {
        const hook = mount("team-1");
        await openAndSettle(hook, { ...TARGET, teamId: "host-7" });
        expect(vi.mocked(fetchTaskSession).mock.calls[0][0].teamId).toBe("host-7");
    });

    it("an empty answer (never asked, or the flag is off) leaves the window empty and ready", async () => {
        const hook = mount();
        await openAndSettle(hook);
        expect(hook.result.current.agentQA.turns).toEqual([]);
        expect(hook.result.current.agentQA.sessionId).toBeNull();
        expect(hook.result.current.canAsk).toBe(true);
    });

    it("is not asked again when the same task is reopened: the window keeps what it holds", async () => {
        vi.mocked(fetchTaskSession).mockResolvedValue(restored("sess-task"));
        const hook = mount();
        await openAndSettle(hook);
        act(() => hook.result.current.close());
        act(() => hook.result.current.open(TARGET));
        expect(fetchTaskSession).toHaveBeenCalledTimes(1);
        expect(hook.result.current.isOpen).toBe(true);
        expect(hook.result.current.agentQA.turns).toHaveLength(2);
    });

    it("another task wipes the first one's conversation and restores its own", async () => {
        vi.mocked(fetchTaskSession).mockImplementation(async ({ taskId }) =>
            taskId === 2039 ? restored("sess-a") : restored("sess-b", 1)
        );
        const hook = mount();
        await openAndSettle(hook);
        expect(hook.result.current.agentQA.sessionId).toBe("sess-a");

        act(() => hook.result.current.open(OTHER));
        // Wiped at once, not after the answer: a question about A is never shown under B.
        expect(hook.result.current.agentQA.turns).toEqual([]);
        expect(hook.result.current.agentQA.sessionId).toBeNull();
        await waitFor(() => expect(hook.result.current.agentQA.sessionId).toBe("sess-b"));
        expect(hook.result.current.agentQA.turns).toHaveLength(1);
        expect(hook.result.current.target?.taskId).toBe(2040);
    });

    it("a slow restore of the task the person has since left does not land under the new one", async () => {
        let releaseA: (r: TaskSessionResult) => void = () => {};
        vi.mocked(fetchTaskSession).mockImplementation(({ taskId }) =>
            taskId === 2039
                ? new Promise<TaskSessionResult>((resolve) => {
                      releaseA = resolve;
                  })
                : Promise.resolve(restored("sess-b", 1))
        );
        const hook = mount();
        act(() => hook.result.current.open(TARGET));
        act(() => hook.result.current.open(OTHER));
        await waitFor(() => expect(hook.result.current.agentQA.sessionId).toBe("sess-b"));
        // The first answer arrives late (its request was aborted, but a stub does not care).
        await act(async () => releaseA(restored("sess-a")));
        expect(hook.result.current.agentQA.sessionId).toBe("sess-b");
        expect(hook.result.current.agentQA.turns).toHaveLength(1);
    });

    it("closing mid-load, then reopening the same task, asks again (a cut-short restore is no result)", async () => {
        let release: (r: TaskSessionResult) => void = () => {};
        vi.mocked(fetchTaskSession).mockImplementationOnce(
            () =>
                new Promise<TaskSessionResult>((resolve) => {
                    release = resolve;
                })
        );
        const hook = mount();
        act(() => hook.result.current.open(TARGET));
        act(() => hook.result.current.close());
        expect(hook.result.current.status).toBe("idle");
        await act(async () => release(restored("late")));
        expect(hook.result.current.agentQA.sessionId).toBeNull();

        vi.mocked(fetchTaskSession).mockResolvedValue(restored("sess-task"));
        act(() => hook.result.current.open(TARGET));
        await waitFor(() => expect(hook.result.current.agentQA.sessionId).toBe("sess-task"));
        expect(fetchTaskSession).toHaveBeenCalledTimes(2);
    });

    it("an unusable target is ignored: no window, no request", () => {
        const hook = mount();
        act(() => hook.result.current.open({ ...TARGET, taskId: 0 }));
        act(() => hook.result.current.open({ ...TARGET, teamId: "" }));
        expect(hook.result.current.isOpen).toBe(false);
        expect(fetchTaskSession).not.toHaveBeenCalled();
    });
});

// --- the ask -----------------------------------------------------------------------------------

describe("asking about the task", () => {
    it("sends task_context for THIS task, the restored session, the task's own team and the # mention", async () => {
        vi.mocked(fetchTaskSession).mockResolvedValue(restored("sess-task"));
        const hook = mount("team-1");
        await openAndSettle(hook, { ...TARGET, teamId: "host-7" });

        act(() => {
            hook.result.current.agentQA.onAsk("what is left?");
        });
        const sent = lastAsk();
        expect(sent.taskContext).toEqual({ taskId: 2039 });
        expect(sent.sessionId).toBe("sess-task");
        expect(sent.teamId).toBe("host-7");
        expect(sent.mentions).toEqual([{ type: "task", task_id: 2039, label: "MIP-1057" }]);
        // One scope per ask: the server answers a pair with a 400.
        expect(sent.threadContext).toBeUndefined();
        expect(sent.noteContext).toBeUndefined();
        expect(sent.newConversation).toBeUndefined();
    });

    it("a milestone is asked about by its backing task's id", async () => {
        const hook = mount();
        await openAndSettle(hook, { ...TARGET, taskId: 555, isMilestone: true });
        act(() => {
            hook.result.current.agentQA.onAsk("how far along?");
        });
        expect(lastAsk().taskContext).toEqual({ taskId: 555 });
        expect(lastAsk().mentions).toEqual([{ type: "task", task_id: 555, label: "MIP-1057" }]);
    });

    it("keeps what the member picked, with the task first, and Ask again re-sends both once", async () => {
        const hook = mount();
        await openAndSettle(hook);
        const alice: AgentMentionRef = { kind: "user", userId: "u1", label: "Alice" };
        act(() => {
            hook.result.current.agentQA.onAsk("is Alice on it?", [alice]);
        });
        expect(lastAsk().mentions).toEqual([
            { type: "task", task_id: 2039, label: "MIP-1057" },
            { type: "user", user_id: "u1", label: "Alice" },
        ]);
        act(() => {
            lastAsk().onDelta("yes");
            lastAsk().onDone("sess-1", "run-1");
        });
        const finished = hook.result.current.agentQA.turns[0];
        expect(finished.mentions).toHaveLength(2);
        // The conversation's "Ask again" hands the turn's own mentions back to `state.onAsk`.
        act(() => {
            hook.result.current.agentQA.onAsk(finished.askedQuery, finished.mentions);
        });
        expect(lastAsk().mentions).toEqual([
            { type: "task", task_id: 2039, label: "MIP-1057" },
            { type: "user", user_id: "u1", label: "Alice" },
        ]);
    });

    it("the session the server answers with is the one the next ask continues", async () => {
        const hook = mount();
        await openAndSettle(hook);
        act(() => {
            hook.result.current.agentQA.onAsk("first");
        });
        expect(lastAsk().sessionId).toBeUndefined();
        act(() => {
            lastAsk().onDelta("a");
            lastAsk().onDone("sess-new", "run-1");
        });
        act(() => {
            hook.result.current.agentQA.onAsk("second");
        });
        expect(lastAsk().sessionId).toBe("sess-new");
        expect(lastAsk().taskContext).toEqual({ taskId: 2039 });
    });

    it("sends nothing while the restore is out: a late answer must not replace a question", async () => {
        vi.mocked(fetchTaskSession).mockImplementation(() => new Promise(() => {}));
        const hook = mount();
        act(() => hook.result.current.open(TARGET));
        expect(hook.result.current.canAsk).toBe(false);
        let sent = true;
        act(() => {
            sent = hook.result.current.agentQA.onAsk("too early");
        });
        expect(sent).toBe(false);
        expect(askAgentStream).not.toHaveBeenCalled();
    });
});

describe("a run that finishes after the window was closed", () => {
    const withManager = () => {
        const manager = new NotificationManager({ currentUserId: "me" });
        const notify = vi.spyOn(manager, "notify");
        const hook = renderHook(() => useTaskAsk({ accessToken: "tok", teamId: "team-1" }), {
            wrapper: ({ children }) => (
                <NotificationsProvider value={{ manager } as never}>
                    {children}
                </NotificationsProvider>
            ),
        });
        return { hook, notify };
    };

    it("is announced as an answer about the task, and the notice reopens the window", async () => {
        const { hook, notify } = withManager();
        await openAndSettle(hook as never);
        act(() => {
            hook.result.current.agentQA.onAsk("what is left?");
        });
        act(() => hook.result.current.close());
        act(() => {
            lastAsk().onDelta("two things");
            lastAsk().onDone("sess-1", "run-1");
        });
        expect(notify).toHaveBeenCalledTimes(1);
        const intent = notify.mock.calls[0][0];
        expect(intent.id).toBe("agent_run_done:run-1");
        expect(intent.title).toContain("Ask about this task");
        act(() => intent.onOpen?.());
        expect(hook.result.current.isOpen).toBe(true);
    });

    it("is not announced to someone who is looking at the answer arrive", async () => {
        const { hook, notify } = withManager();
        await openAndSettle(hook as never);
        act(() => {
            hook.result.current.agentQA.onAsk("what is left?");
        });
        act(() => {
            lastAsk().onDelta("two things");
            lastAsk().onDone("sess-1", "run-1");
        });
        expect(notify).not.toHaveBeenCalled();
    });
});

// --- gone --------------------------------------------------------------------------------------

describe("a task that cannot be opened (deleted, access lost, never there)", () => {
    it("a 404 on restore: gone; nothing can be asked; nothing is retried", async () => {
        vi.mocked(fetchTaskSession).mockResolvedValue({ kind: "gone" });
        const hook = mount();
        await openAndSettle(hook, TARGET, "gone");
        expect(hook.result.current.canAsk).toBe(false);

        let sent = true;
        act(() => {
            sent = hook.result.current.agentQA.onAsk("anyone there?");
        });
        expect(sent).toBe(false);
        expect(askAgentStream).not.toHaveBeenCalled();

        // Nothing re-fires on its own, and reopening the gone task does not ask again.
        await new Promise((r) => setTimeout(r, 50));
        act(() => hook.result.current.close());
        act(() => hook.result.current.open(TARGET));
        expect(fetchTaskSession).toHaveBeenCalledTimes(1);
        expect(hook.result.current.status).toBe("gone");
    });

    it("a 404 on an ask (deleted while the window was open): gone; the question ends as an error turn; no second ask", async () => {
        const hook = mount();
        await openAndSettle(hook);
        act(() => {
            hook.result.current.agentQA.onAsk("still there?");
        });
        // The transport tells the host first, then ends the turn in its own sentence.
        act(() => {
            lastAsk().onTaskNotFound?.();
            lastAsk().onError("This task or milestone can't be opened any more.");
        });
        expect(hook.result.current.status).toBe("gone");
        expect(hook.result.current.canAsk).toBe(false);
        expect(hook.result.current.agentQA.turns[0].askError).toMatch(/can't be opened/);

        let sent = true;
        act(() => {
            sent = hook.result.current.agentQA.onAsk("again?");
        });
        expect(sent).toBe(false);
        expect(askAgentStream).toHaveBeenCalledTimes(1);
        expect(fetchTaskSession).toHaveBeenCalledTimes(1);
    });

    it("a 404 for a task the person has since left does not mark the one they are looking at", async () => {
        const hook = mount();
        await openAndSettle(hook);
        act(() => {
            hook.result.current.agentQA.onAsk("question about A");
        });
        const staleNotFound = lastAsk().onTaskNotFound!;
        act(() => hook.result.current.open(OTHER));
        await waitFor(() => expect(hook.result.current.status).toBe("ready"));
        act(() => staleNotFound());
        expect(hook.result.current.status).toBe("ready");
        expect(hook.result.current.canAsk).toBe(true);
    });

    it("a non-404 failure to restore leaves the person able to ask anyway, and to retry", async () => {
        vi.mocked(fetchTaskSession).mockResolvedValueOnce({
            kind: "failed",
            message: "Server returned 502",
        });
        const hook = mount();
        await openAndSettle(hook, TARGET, "failed");
        expect(hook.result.current.loadError).toBe("Server returned 502");
        expect(hook.result.current.canAsk).toBe(true);

        // They ask anyway (the server reuses the newest conversation about the task).
        act(() => {
            hook.result.current.agentQA.onAsk("ask anyway");
        });
        expect(lastAsk().taskContext).toEqual({ taskId: 2039 });
        expect(lastAsk().sessionId).toBeUndefined();

        // The retry lands after they asked: it must not abort the answer under way.
        vi.mocked(fetchTaskSession).mockResolvedValue(restored("sess-task"));
        act(() => hook.result.current.reload());
        await waitFor(() => expect(hook.result.current.status).toBe("ready"));
        expect(hook.result.current.agentQA.ask.isStreaming).toBe(true);
        expect(hook.result.current.agentQA.sessionId).toBeNull();
    });

    it("a retry with nothing asked yet does restore", async () => {
        vi.mocked(fetchTaskSession).mockResolvedValueOnce({ kind: "failed", message: "x" });
        const hook = mount();
        await openAndSettle(hook, TARGET, "failed");
        vi.mocked(fetchTaskSession).mockResolvedValue(restored("sess-task"));
        act(() => hook.result.current.reload());
        await waitFor(() => expect(hook.result.current.agentQA.sessionId).toBe("sess-task"));
        expect(hook.result.current.loadError).toBeNull();
    });
});

// --- new conversation --------------------------------------------------------------------------

describe("New conversation", () => {
    it("empties the window and the next ask is new_conversation: true with no session id; the one after is plain", async () => {
        vi.mocked(fetchTaskSession).mockResolvedValue(restored("sess-old"));
        const hook = mount();
        await openAndSettle(hook);
        expect(hook.result.current.agentQA.turns).toHaveLength(2);

        act(() => hook.result.current.startNewConversation());
        expect(hook.result.current.agentQA.turns).toEqual([]);
        expect(hook.result.current.agentQA.sessionId).toBeNull();

        act(() => {
            hook.result.current.agentQA.onAsk("a fresh start");
        });
        expect(lastAsk().newConversation).toBe(true);
        expect(lastAsk().sessionId).toBeUndefined();
        // Still about the same task.
        expect(lastAsk().taskContext).toEqual({ taskId: 2039 });
        act(() => {
            lastAsk().onDelta("ok");
            lastAsk().onDone("sess-new", "run-9");
        });

        act(() => {
            hook.result.current.agentQA.onAsk("and then");
        });
        expect(lastAsk().newConversation).toBeUndefined();
        expect(lastAsk().sessionId).toBe("sess-new");
    });

    it("is still the same task's window afterwards: reopening does not bring the old turns back", async () => {
        vi.mocked(fetchTaskSession).mockResolvedValue(restored("sess-old"));
        const hook = mount();
        await openAndSettle(hook);
        act(() => hook.result.current.startNewConversation());
        act(() => hook.result.current.close());
        act(() => hook.result.current.open(TARGET));
        expect(fetchTaskSession).toHaveBeenCalledTimes(1);
        expect(hook.result.current.agentQA.turns).toEqual([]);
    });
});

// --- other windows' business -------------------------------------------------------------------

describe("what is not this window's business", () => {
    it("a conversation deleted from Settings empties the window, like the thread and note ones", async () => {
        vi.mocked(fetchTaskSession).mockResolvedValue(restored("sess-task"));
        const hook = mount();
        await openAndSettle(hook);
        act(() => emitAgentSessionsDeleted({ teamId: "team-1", sessionIds: ["unrelated"] }));
        expect(hook.result.current.agentQA.turns).toHaveLength(2);
        act(() => emitAgentSessionsDeleted({ teamId: "team-1", sessionIds: ["sess-task"] }));
        expect(hook.result.current.agentQA.turns).toEqual([]);
        expect(hook.result.current.agentQA.sessionId).toBeNull();
    });

    it("a delete-all in a team the task does not belong to leaves it; in its own team it empties it", async () => {
        vi.mocked(fetchTaskSession).mockResolvedValue(restored("sess-task"));
        const hook = mount("team-1");
        await openAndSettle(hook, { ...TARGET, teamId: "host-7" });
        act(() => emitAgentSessionsDeleted({ teamId: "team-1", all: true }));
        expect(hook.result.current.agentQA.turns).toHaveLength(2);
        act(() => emitAgentSessionsDeleted({ teamId: "host-7", all: true }));
        expect(hook.result.current.agentQA.turns).toEqual([]);
    });

    it("switching to another team closes the window and drops the task and its conversation", async () => {
        vi.mocked(fetchTaskSession).mockResolvedValue(restored("sess-task"));
        const hook = mount("team-1");
        await openAndSettle(hook);
        hook.rerender({ teamId: "team-2" });
        expect(hook.result.current.isOpen).toBe(false);
        expect(hook.result.current.target).toBeNull();
        expect(hook.result.current.status).toBe("idle");
        expect(hook.result.current.agentQA.turns).toEqual([]);
        expect(hook.result.current.canAsk).toBe(false);
    });
});

describe("the general (Cmd-K / Genos page) conversation is never touched", () => {
    const spotlightDetail = {
        session_id: "sess-general",
        created_at: "2026-11-14T09:00:00Z",
        last_active_at: "2026-11-14T09:30:00Z",
        turns: [turn(7), turn(8)],
    };

    const mountBoth = () =>
        renderHook(() => ({
            spotlight: useSpotlight({ accessToken: "tok", teamId: "team-1", isPageActive: true }),
            task: useTaskAsk({ accessToken: "tok", teamId: "team-1" }),
        }));

    it("a task ask leaves Spotlight's turns, session and stored copy as they were, and never borrows its session id", async () => {
        vi.mocked(fetchAgentSessionDetail).mockResolvedValue(spotlightDetail as never);
        vi.mocked(fetchTaskSession).mockResolvedValue(restored("sess-task", 1));
        const hook = mountBoth();
        act(() => hook.result.current.spotlight.resumeSession("sess-general"));
        await waitFor(() => expect(hook.result.current.spotlight.turns).toHaveLength(2));
        await waitFor(
            () => {
                const raw = localStorage.getItem("spotlight:session:v1:team-1");
                expect(JSON.parse(raw as string).sessionId).toBe("sess-general");
            },
            { timeout: 2000 }
        );
        const storedBefore = localStorage.getItem("spotlight:session:v1:team-1");

        act(() => hook.result.current.task.open(TARGET));
        await waitFor(() => expect(hook.result.current.task.status).toBe("ready"));
        act(() => {
            hook.result.current.task.agentQA.onAsk("what is left on this task?");
        });
        act(() => {
            lastAsk().onDelta("two things");
            lastAsk().onDone("sess-task", "run-1");
        });

        // The ask is about the task, in the task's session, not the general one.
        expect(askAgentStream).toHaveBeenCalledTimes(1);
        expect(lastAsk().taskContext).toEqual({ taskId: 2039 });
        expect(lastAsk().sessionId).toBe("sess-task");
        expect(lastAsk().sessionId).not.toBe("sess-general");

        // Spotlight is exactly what it was.
        expect(hook.result.current.spotlight.ask.sessionId).toBe("sess-general");
        expect(hook.result.current.spotlight.turns.map((t) => t.askedQuery)).toEqual([
            "question 7",
            "question 8",
        ]);
        await new Promise((r) => setTimeout(r, 600));
        expect(localStorage.getItem("spotlight:session:v1:team-1")).toBe(storedBefore);
    });

    it("and the next general ask carries no task_context and continues its own session", async () => {
        vi.mocked(fetchAgentSessionDetail).mockResolvedValue(spotlightDetail as never);
        const hook = mountBoth();
        act(() => hook.result.current.spotlight.resumeSession("sess-general"));
        await waitFor(() => expect(hook.result.current.spotlight.turns).toHaveLength(2));

        act(() => hook.result.current.task.open(TARGET));
        await waitFor(() => expect(hook.result.current.task.status).toBe("ready"));
        act(() => {
            hook.result.current.task.agentQA.onAsk("about the task");
        });
        act(() => {
            lastAsk().onDone("sess-task", "run-1");
        });

        act(() => hook.result.current.spotlight.onAsk("a general question"));
        await waitFor(() => expect(askAgentStream).toHaveBeenCalledTimes(2));
        const general = lastAsk();
        expect(general.taskContext).toBeUndefined();
        expect(general.sessionId).toBe("sess-general");
        expect(general.query).toBe("a general question");
    });

    it("never writes the browser's storage on its own", async () => {
        const setItem = vi.spyOn(Storage.prototype, "setItem");
        const hook = mount();
        await openAndSettle(hook);
        act(() => {
            hook.result.current.agentQA.onAsk("q");
        });
        act(() => {
            lastAsk().onDelta("a");
            lastAsk().onDone("s", "r");
        });
        expect(setItem).not.toHaveBeenCalled();
        setItem.mockRestore();
    });
});
