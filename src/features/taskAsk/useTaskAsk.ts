// useTaskAsk: state and behaviour for "Ask Genos about this task or milestone" (MIP-1057).
//
// A task or milestone keeps ITS OWN conversation, the way a thread and a note do, behind the server's
// `AGENT_PARITY_TOOLS` flag (genos-api #874; the flag is not visible to the client). A thin
// orchestrator over `useAgentQA` (turns, ask state, streaming, approval) plus what is the task's own:
//
//   1. **Restore on open.** `GET /agent/task-session/` returns the person's newest conversation about
//      the task (no model call, nothing written). It is applied with `reset`, but only when the
//      server has something to restore: an empty answer (never asked, or the flag is off) must not
//      wipe what the person typed or watched locally.
//   2. **The ask.** `buildAskExtras` puts `task_context: {task_id}` on every ask and the task's team
//      (the HOST team of a shared project) as the ask's `team_id`. The task is also sent as the `#`
//      mention it has always been, so with the flag off an ask is what it is today and with it on the
//      server writes no second bullet.
//   3. **Gone for good.** A 404 (on restore or on an ask) is one answer for a deleted task, lost
//      access and a task that was never there. The status becomes `gone`, nothing more is sent about
//      the task (`canAsk` is false, `onAsk` refuses), and nothing retries: no effect re-fires on the
//      status. The person's earlier conversation stays in their history.
//   4. **New conversation.** `clearConversation` of the shared hook: the local turns go and the next
//      ask carries `new_conversation: true`, so the server starts another session on the same task
//      instead of resuming the old one. The old one stays in their history.
//
// What this hook never does: touch the general (Cmd-K / Genos page) conversation. It owns its own
// `useAgentQA` instance; Spotlight's turns, session id and localStorage entry are not read or written
// here, and a `session_id` is only ever one this hook got from the task's own restore or ask.

import { useCallback, useEffect, useRef, useState } from "react";

import { fetchTaskSession, type AskAgentArgs } from "../../services/agentApi";
import {
    isRunBeingWatched,
    notifyAgentRunComplete,
} from "../../services/notifications/agentRunNotice";
import { useNotificationsContext } from "../../services/notifications/NotificationsContext";
import {
    deletionCoversSession,
    mentionKey,
    sessionTurnToCompleted,
    useAgentQA,
    useAgentSessionsDeleted,
    type AgentMentionRef,
    type AgentRunResult,
    type UseAgentQAReturn,
} from "../agentQA";
import { isUsableTaskAskTarget, taskAskMention, type TaskAskTarget } from "./taskAskTarget";

export interface UseTaskAskArgs {
    accessToken: string | null;
    /** The team the person is looking at. A task's own team (`target.teamId`) wins for its ask. */
    teamId: string | null | undefined;
}

/** Where the restore of the task's conversation is:
 *  - `idle`: nothing asked for yet (no target, or the window was closed mid-load),
 *  - `loading`: the restore is in flight (the input waits: a late answer must not replace an ask),
 *  - `ready`: restored, or there was nothing to restore,
 *  - `gone`: the server said 404: the task cannot be opened (deleted, access lost, never there),
 *  - `failed`: the restore could not be loaded (network, 5xx). The person may ask anyway (the server
 *    reuses the newest conversation about the task) and may retry the restore. */
export type TaskSessionStatus = "idle" | "loading" | "ready" | "gone" | "failed";

export interface UseTaskAskReturn {
    // ---- Open / close ----
    isOpen: boolean;
    open: (target: TaskAskTarget) => void;
    close: () => void;

    /** The task the window is bound to; null until it was opened. */
    target: TaskAskTarget | null;

    // ---- The restore ----
    status: TaskSessionStatus;
    /** Why the restore failed (`status === "failed"`). */
    loadError: string | null;
    /** Try the restore again (after `failed`). */
    reload: () => void;
    /** Whether a question can be sent about this task now (restored or failed-but-askable; not
     *  while loading, not once gone). */
    canAsk: boolean;

    /** Start another conversation about the same task. The old one stays in the person's history. */
    startNewConversation: () => void;

    // ---- Q&A (generic; delegated to useAgentQA) ----
    // `onAsk` adds the task's own `#` mention and refuses while `canAsk` is false; the rest is the
    // shared state machine.
    agentQA: UseAgentQAReturn;
}

/** `mentions` plus the task's own, first, unless one of them already is the task. */
export const withTaskMention = (
    mentions: AgentMentionRef[] | undefined,
    taskRef: AgentMentionRef | null
): AgentMentionRef[] | undefined => {
    if (!taskRef) return mentions;
    const key = mentionKey(taskRef);
    if (mentions?.some((m) => mentionKey(m) === key)) return mentions;
    return [taskRef, ...(mentions ?? [])];
};

export const useTaskAsk = ({ accessToken, teamId }: UseTaskAskArgs): UseTaskAskReturn => {
    const [isOpen, setIsOpen] = useState(false);
    const [target, setTarget] = useState<TaskAskTarget | null>(null);
    const [status, setStatus] = useState<TaskSessionStatus>("idle");
    const [loadError, setLoadError] = useState<string | null>(null);

    // The latest values for callbacks that outlive a render (stream handlers, the restore's await).
    const targetRef = useRef<TaskAskTarget | null>(target);
    useEffect(() => {
        targetRef.current = target;
    }, [target]);
    const restoreAbortRef = useRef<AbortController | null>(null);
    // The person chose "New conversation" in this window: a restore that lands after that (a Retry
    // of a failed one) must not bring the old conversation back over the empty one they asked for.
    const startedFreshRef = useRef(false);

    const canAsk = target !== null && (status === "ready" || status === "failed");
    // Read by `onAsk` and `startNewConversation` at the moment of the click: written in render, like
    // `liveRef` below, so it never lags a commit behind what the person sees.
    const canAskRef = useRef(canAsk);
    canAskRef.current = canAsk;

    // A run that finishes after the window was closed announces itself, like the thread and note Ask.
    const notifications = useNotificationsContext();
    const isOpenRef = useRef(isOpen);
    useEffect(() => {
        isOpenRef.current = isOpen;
    }, [isOpen]);

    // The task is gone: only for the task the ask was about (a late 404 of a task the person has
    // since left must not mark the one they are looking at).
    const markGone = useCallback((taskId: number) => {
        if (targetRef.current?.taskId !== taskId) return;
        setStatus("gone");
        setLoadError(null);
    }, []);

    const agentQA = useAgentQA({
        accessToken,
        // The task's own team: the host team for a project shared from another team.
        teamId: target?.teamId ?? teamId,
        buildAskExtras: useCallback((): Partial<AskAgentArgs> => {
            const current = targetRef.current;
            if (!current) return {};
            return {
                taskContext: { taskId: current.taskId },
                onTaskNotFound: () => markGone(current.taskId),
            };
        }, [markGone]),
        onRunComplete: useCallback(
            (result: AgentRunResult) => {
                if (isRunBeingWatched(isOpenRef.current)) return; // watched it finish
                notifyAgentRunComplete(notifications?.manager, {
                    surface: "task",
                    askedQuery: result.askedQuery,
                    runId: result.runId,
                    turnId: result.turnId,
                    error: result.error,
                    onOpen: () => setIsOpen(true),
                });
            },
            [notifications]
        ),
    });

    // What the restore must not trample: read at the moment its answer lands.
    const liveRef = useRef({ turns: 0, busy: false });
    liveRef.current = {
        turns: agentQA.turns.length,
        busy:
            agentQA.ask.isStreaming ||
            agentQA.ask.pendingApproval !== null ||
            agentQA.ask.askedQuery !== "",
    };
    const agentQARef = useRef(agentQA);
    agentQARef.current = agentQA;

    // ---- This conversation was permanently deleted (Settings -> What Genos remembers). ----
    // Same as the thread and note windows: the transcript outlives `close()`, so without this a
    // reopened window would show a conversation whose session is gone and the next follow-up would
    // start another without its context.
    useAgentSessionsDeleted((detail) => {
        if (deletionCoversSession(detail, agentQA.sessionId, target?.teamId ?? teamId)) {
            agentQA.reset({ sessionId: null, turns: [] });
        }
    });

    // ---- Restore the conversation. ----
    const load = useCallback(
        (next: TaskAskTarget) => {
            restoreAbortRef.current?.abort();
            const controller = new AbortController();
            restoreAbortRef.current = controller;
            setStatus("loading");
            setLoadError(null);
            void (async () => {
                const result = await fetchTaskSession({
                    accessToken,
                    teamId: next.teamId,
                    taskId: next.taskId,
                    signal: controller.signal,
                });
                if (controller.signal.aborted) return;
                if (result.kind === "gone") {
                    setStatus("gone");
                    return;
                }
                if (result.kind === "failed") {
                    setLoadError(result.message || null);
                    setStatus("failed");
                    return;
                }
                // Restore only what the server has, and only into an empty window: an empty answer
                // (never asked here, or the flag is off) keeps what the person has locally, and a
                // retry that lands after they asked anyway must not abort their answer.
                const restored = result.turns.map(sessionTurnToCompleted);
                const live = liveRef.current;
                if (
                    (restored.length > 0 || result.agentSessionId) &&
                    live.turns === 0 &&
                    !live.busy &&
                    !startedFreshRef.current
                ) {
                    agentQARef.current.reset({
                        sessionId: result.agentSessionId,
                        turns: restored,
                    });
                }
                setStatus("ready");
            })();
        },
        [accessToken]
    );

    const open = useCallback(
        (next: TaskAskTarget) => {
            if (!isUsableTaskAskTarget(next)) return;
            setIsOpen(true);
            const current = targetRef.current;
            const sameTask =
                current !== null &&
                current.taskId === next.taskId &&
                current.teamId === next.teamId;
            if (!sameTask) {
                // Another task: a conversation about task A makes no sense for task B. Full wipe, then
                // the restore populates it from the server.
                targetRef.current = next;
                startedFreshRef.current = false;
                setTarget(next);
                agentQARef.current.reset({ sessionId: null, turns: [] });
                agentQARef.current.setQuery("");
                load(next);
                return;
            }
            // The same task again: the window keeps what it holds. A restore that never landed
            // (closed mid-load), one that failed and one that said "gone" are asked again (the person
            // opening it again IS the retry: a task whose access came back, or a 404 that was a
            // deploy window, must not stay gone until they switch tasks; one cheap read, nothing else
            // re-fires on its own); a `ready` one is left alone. The name and title may have changed.
            setTarget(next);
            if (status !== "ready" && status !== "loading") load(next);
        },
        [load, status]
    );

    const close = useCallback(() => {
        setIsOpen(false);
        // Abort a restore in flight (the shared hook keeps its own ask stream running, so a partial
        // answer is there when the window reopens). A restore cut short is no result: reopening
        // asks again.
        restoreAbortRef.current?.abort();
        restoreAbortRef.current = null;
        setStatus((s) => (s === "loading" ? "idle" : s));
    }, []);

    const reload = useCallback(() => {
        if (targetRef.current) load(targetRef.current);
    }, [load]);

    const startNewConversation = useCallback(() => {
        // Nothing to start over from while the restore is out (it would land on top of the empty
        // window and undo it) or once the task is gone.
        if (!canAskRef.current) return;
        startedFreshRef.current = true;
        agentQARef.current.clearConversation();
    }, []);

    // ---- The team the person is looking at changed: nothing here belongs to it any more. ----
    const previousTeamRef = useRef(teamId);
    useEffect(() => {
        if (previousTeamRef.current === teamId) return;
        previousTeamRef.current = teamId;
        restoreAbortRef.current?.abort();
        restoreAbortRef.current = null;
        targetRef.current = null;
        startedFreshRef.current = false;
        setTarget(null);
        setStatus("idle");
        setLoadError(null);
        setIsOpen(false);
        agentQARef.current.reset({ sessionId: null, turns: [] });
        agentQARef.current.setQuery("");
    }, [teamId]);

    // ---- Tear-down on unmount. ----
    useEffect(
        () => () => {
            restoreAbortRef.current?.abort();
        },
        []
    );

    // The shared machine, with the task's own mention added to every ask (and every retry: the
    // conversation's "Ask again" goes through `state.onAsk`) and no ask at all once the task is gone
    // or while the restore is out.
    const onAsk: UseAgentQAReturn["onAsk"] = (overrideQuery, mentions, meta, selection) => {
        if (!canAskRef.current) return false;
        const current = targetRef.current;
        return agentQA.onAsk(
            overrideQuery,
            withTaskMention(mentions, current ? taskAskMention(current) : null),
            meta,
            selection
        );
    };

    return {
        isOpen,
        open,
        close,
        target,
        status,
        loadError,
        reload,
        canAsk,
        startNewConversation,
        agentQA: { ...agentQA, onAsk },
    };
};
