import { useEffect, useRef, useState } from "react";

import { useAuth } from "../../../context/AuthContext";
import { ChatManagementState } from "../../../hooks/chats/useChatManagement";
import { TaskManagementState } from "../../../hooks/tasks/useTaskManagement";
import { UserProps } from "../../../types/admin";
import { TaskProps } from "../../../types/tasks";
import { loadSpecificTask } from "../../tasks/services/loadSpecificTask";
import { loadSpecificTaskByThreadId } from "../../tasks/services/loadSpecificTaskByThreadId";

type UseThreadTaskMetaArgs = {
    myself: UserProps;
    /** The pane-level chat state — pass the possibly-overridden `useCM`
     *  prop (the UrlLinkModal mounts ThreadPane against modal-local
     *  chat state), never the raw hook. */
    useCM: ChatManagementState;
    useTM: TaskManagementState;
    /** ChatContext's thread-task id slot (modal-safe: the modal provides
     *  its own). Written when the server lookup finds a task the thread
     *  messages didn't reveal. */
    currentThreadTaskId: number;
    setCurrentThreadTaskId: (id: number) => void;
};

/**
 * Resolve the full task (or milestone backing task) behind the open
 * thread, for the thread header's task-info breadcrumb.
 *
 * Two lookups, in order:
 *
 * 1. **By id** — when the thread already knows its task (PM threads
 *    always do; DM/GM/MDM threads do once the task-created card reply
 *    is in the thread). Needs a project id; taken from the thread, the
 *    host channel, or the loaded project task list.
 * 2. **By thread** — DM/GM/MDM threads whose messages carry no task
 *    marker. This is the server-side truth (`TaskMaster.thread_id`),
 *    so it also *verifies* the one-task-per-thread rule for threads
 *    whose card reply was lost, was posted by another member, or has
 *    not synced — on a hit the context id is updated, which is what
 *    hides the header's "Create task" action.
 *
 * Returns null while unresolved; the header falls back to its legacy
 * pill (open-by-id) when it knows a task id but no meta could load.
 */
export const useThreadTaskMeta = ({
    myself,
    useCM,
    useTM,
    currentThreadTaskId,
    setCurrentThreadTaskId,
}: UseThreadTaskMetaArgs): TaskProps | null => {
    const { accessToken } = useAuth();
    const [meta, setMeta] = useState<TaskProps | null>(null);
    // Mirror for the effect below: when the by-thread lookup resolves a
    // task and writes the context id, `knownTaskId` changes and re-runs
    // the effect — without this guard it would clear + refetch the meta
    // it just loaded (a visible crumb flicker and a wasted request).
    const metaRef = useRef<TaskProps | null>(null);
    metaRef.current = meta;

    const thread = useCM.currentThreadChat;
    const threadKey = thread?.threadId != null ? String(thread.threadId) : null;
    const chatType = thread?.chatType;
    const chatId = thread?.chatId != null ? String(thread.chatId) : null;
    // Thread-declared task (root/card metadata), else the context slot
    // (set by an earlier verification pass or by an in-thread create).
    const knownTaskId =
        thread?.taskId != null && thread.taskId > 0
            ? thread.taskId
            : currentThreadTaskId > 0
              ? currentThreadTaskId
              : null;

    useEffect(() => {
        let cancelled = false;
        if (
            metaRef.current &&
            knownTaskId != null &&
            Number(metaRef.current.id) === Number(knownTaskId) &&
            metaRef.current.threadId != null &&
            String(metaRef.current.threadId) === threadKey
        ) {
            return;
        }
        setMeta(null);
        if (!accessToken || !threadKey || chatType === undefined || chatId === null) {
            return;
        }

        const resolveProjectId = (): number | null => {
            if (thread?.project?.projectId) return thread.project.projectId;
            // PM threads live in the project's channel; the host chat
            // carries the project (both on the page and in the modal).
            if (useCM.currentMainChat?.project?.projectId) {
                return useCM.currentMainChat.project.projectId;
            }
            const row = useTM.allTasks.find((t) => String(t.id) === String(knownTaskId));
            return row?.projectId ?? null;
        };

        void (async () => {
            if (knownTaskId != null) {
                const projectId = resolveProjectId();
                if (projectId != null) {
                    const loaded: TaskProps[] | undefined = await loadSpecificTask(
                        myself,
                        projectId,
                        knownTaskId,
                        accessToken
                    );
                    if (cancelled) return;
                    if (loaded && loaded[0]) {
                        setMeta(loaded[0]);
                        return;
                    }
                }
                // No project to load through (e.g. a DM thread whose task
                // lives in a project this session hasn't loaded) — the
                // by-thread endpoint needs none.
            }
            if (chatType === 3) {
                // PM tasks are not created FROM threads, so their rows
                // carry no thread linkage for the by-thread lookup.
                return;
            }
            const byThread = await loadSpecificTaskByThreadId(
                myself,
                chatType,
                chatId,
                threadKey,
                accessToken
            );
            if (cancelled) return;
            if (byThread[0]) {
                setMeta(byThread[0]);
                const taskIdNum = Number(byThread[0].id);
                if (Number.isFinite(taskIdNum) && taskIdNum > 0) {
                    setCurrentThreadTaskId(taskIdNum);
                }
            }
        })();

        return () => {
            cancelled = true;
        };
        // `thread` / `useCM` / `useTM.allTasks` are read inside but the
        // lookup should re-run only when the thread identity or its
        // known task changes — not on every chat-state render.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [threadKey, knownTaskId, chatType, chatId, accessToken]);

    return meta;
};
