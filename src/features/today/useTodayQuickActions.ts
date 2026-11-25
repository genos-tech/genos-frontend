import { useCallback, useMemo, useRef } from "react";

import { useAuth } from "../../context/authState";
import { runUndoable, useUndoHidden } from "../../hooks/common/useUndoableAction";
import type { TaskManagementState } from "../../hooks/tasks/useTaskManagement";
import { fmt, useTranslation } from "../../i18n";
import { UserProps } from "../../types/admin";
import { TaskTableProps } from "../../types/tasks";
import { parseCalendarDate } from "../../utils/calendarDate";
import { patchTaskFields } from "../tasks/diagram/services/patchTaskFields";
import { STATUS_CLOSED } from "../tasks/meta/taskStatuses";
import { afterTaskDeleted, syncDeletedTaskCard } from "../tasks/services/deleteTaskCommit";
import { statuses } from "../tasks/utils/taskMeta";
import type { BriefingTask, BriefingToday } from "./briefingToday";
import { applyTodayAction, nextWorkingDay, TodayAction } from "./todayActions";
import type { BriefingTodayView } from "./useBriefingToday";

/**
 * "Mark done" and "Move to tomorrow" on a Today row (MIP-1992).
 *
 * Same contract as deleting a task (MIP-1303, `useDeleteTask`): the row leaves Today at once, a
 * toast offers Undo, and only when the toast is gone does ONE write go out. Undo sends nothing,
 * because nothing was written: a status change also adds history, un-blocks the tasks that
 * waited on it and rewrites the PM card, and no reverse write takes those back.
 *
 * The write is a partial PUT (`{task_id, status, status_code}` or `{task_id, due_date}`), never
 * the whole task: whatever was edited during the window stays as it was saved. When the write is
 * done, the caches, the PM card and the open table / board / preview are told, the way every
 * other status change tells them (`afterTaskDeleted` is the shared "a status was written" step).
 * A refused or failed write puts the row back and says so (`runUndoable`).
 *
 * The briefing answer itself is never edited: Today shows `withQuickActions(data, pending)`, so
 * a refresh in the window cannot bring the row back and the counts, the tiles and the progress
 * bar are always derived from the same truth.
 */

const KEY = "today:";
const keyOf = (taskId: number) => `${KEY}${taskId}`;

/** What each pending (or committed) key stands for; module level, like the undo state it pairs with. */
const actions = new Map<
    string,
    {
        action: TodayAction;
        due: string | null;
        /** Written. It then applies only to the briefing it was written against: a newer answer is the server's word. */
        committed?: boolean;
        base?: BriefingToday | null;
    }
>();

export const DONE_STATUS = STATUS_CLOSED;

const doneCode = statuses.find((s) => s.status === DONE_STATUS)?.code ?? 0;

const putDone = async (taskId: number, token: string | null) => {
    const res = await patchTaskFields(
        taskId,
        { status: DONE_STATUS, status_code: doneCode },
        token
    );
    if (!res.ok) throw new Error(res.error ?? "task update failed");
};

const putDue = async (taskId: number, due: string, token: string | null) => {
    const res = await patchTaskFields(taskId, { due_date: due }, token);
    if (!res.ok) throw new Error(res.error ?? "task update failed");
};

/** The same PUT for a page that is going away: a `fetch` with `keepalive` outlives the page. */
const putOnExit = (token: string | null, body: Record<string, unknown>): void => {
    if (!token || typeof fetch !== "function") return;
    try {
        void fetch(`${import.meta.env.VITE_API_BASE_URL}/task/`, {
            method: "PUT",
            keepalive: true,
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
            body: JSON.stringify(body),
        }).catch(() => undefined);
    } catch {
        // Never let this break a page transition.
    }
};

/** The briefing with every pending / committed quick action applied. Same object when none apply. */
export const withQuickActions = (
    data: BriefingToday | null,
    hidden: ReadonlySet<string>
): BriefingToday | null => {
    if (!data) return data;
    let out = data;
    for (const [key, a] of actions) {
        const applies = hidden.has(key) || (a.committed === true && a.base === data);
        if (!applies) continue;
        out = applyTodayAction(out, Number(key.slice(KEY.length)), a.action, a.due);
    }
    return out;
};

/** The view Today draws: the loaded one with the quick actions applied, and which ids are pending. */
export const useQuickActionView = (
    view: BriefingTodayView
): { view: BriefingTodayView; pending: ReadonlySet<string> } => {
    const hidden = useUndoHidden();
    const data = useMemo(() => withQuickActions(view.data, hidden), [view.data, hidden]);
    const shown = useMemo(() => (data === view.data ? view : { ...view, data }), [view, data]);
    return { view: shown, pending: hidden };
};

const dayWords = (iso: string | null, locale: string): string => {
    const d = parseCalendarDate(iso);
    if (!d) return iso ?? "";
    return d.toLocaleDateString(locale, { weekday: "short", month: "short", day: "numeric" });
};

type Deps = {
    useTM: TaskManagementState;
    myself: UserProps;
    /** The member's today, for "tomorrow". */
    localDate: string | undefined;
    /** The loaded briefing (not the one with actions applied): what a committed action is tied to. */
    data: BriefingToday | null;
};

export const useTodayQuickActions = ({ useTM, myself, localDate, data }: Deps) => {
    const { accessToken } = useAuth();
    const { t, locale } = useTranslation();
    const latest = useRef({ useTM, myself, accessToken, t, locale, localDate, data });
    latest.current = { useTM, myself, accessToken, t, locale, localDate, data };

    return useCallback((task: BriefingTask, action: TodayAction) => {
        const { t, locale, localDate } = latest.current;
        if (task.isMilestone || task.projectId == null) return;
        const copy = t.tasks.dashboard.today.actions;
        const due = action === "tomorrow" ? nextWorkingDay(localDate) : null;
        if (action === "tomorrow" && !due) return;
        // Never pull a deadline earlier: "tomorrow" is for what is due today or already late.
        if (action === "tomorrow" && (task.daysUntilDue == null || task.daysUntilDue > 0)) return;
        const id = task.taskId;
        const projectId = task.projectId;
        const key = keyOf(id);
        const label = `${task.displayId} ${task.title}`;
        // One action per task (a double click, or "done" then "tomorrow" on its second row):
        // `runUndoable` would ignore the second one, and this map must not remember it.
        const prior = actions.get(key);
        if (prior && !prior.committed) return;
        actions.set(key, { action, due });
        runUndoable({
            key,
            message:
                action === "done"
                    ? fmt(copy.doneToast, { task: label })
                    : fmt(copy.tomorrowToast, { task: label, date: dayWords(due, locale) }),
            errorMessage: fmt(copy.failed, { task: label }),
            keepOnNavigate: true,
            // The row is hidden by the briefing derivation (`committed` + `base`), not by the
            // undo store, so a later answer, a reopened task or a second action is not blocked.
            releaseOnCommit: true,
            onCommitted: () => {
                const entry = actions.get(key);
                if (entry) {
                    entry.committed = true;
                    entry.base = latest.current.data;
                }
            },
            commit: async () => {
                // Read now, not at the click: the token can be refreshed in the window.
                const { useTM, myself, accessToken } = latest.current;
                if (action === "done") await putDone(id, accessToken);
                else await putDue(id, due as string, accessToken);
                // The row the table reads, the cache it reloads from, every open view.
                const isIt = (row: TaskTableProps) => String(row.id) === String(id);
                const source = useTM.allTasks.find(isIt);
                const patch = action === "done" ? { status: DONE_STATUS } : { dueDate: due ?? "" };
                useTM.setAllTasks((prev) =>
                    prev.map((row) => (isIt(row) ? { ...row, ...patch } : row))
                );
                const preview = useTM.currentPreviewTask;
                if (preview && preview.id === id) {
                    useTM.setCurrentPreviewTask({
                        ...preview,
                        ...(action === "done"
                            ? {
                                  status:
                                      statuses.find((s) => s.status === DONE_STATUS) ??
                                      preview.status,
                              }
                            : { dueDate: due ?? "" }),
                    });
                }
                afterTaskDeleted(id, source ? { ...source, ...patch } : null);
                void syncDeletedTaskCard(myself, projectId, id, accessToken);
            },
            onExit: () => {
                const { accessToken } = latest.current;
                putOnExit(
                    accessToken,
                    action === "done"
                        ? { task_id: id, status: DONE_STATUS, status_code: doneCode }
                        : { task_id: id, due_date: due }
                );
            },
            // A failed write or an Undo: the row comes back, so forget what it stood for.
            onRestore: () => actions.delete(key),
        });
    }, []);
};

export const isQuickActionPending = (hidden: ReadonlySet<string>, taskId: number): boolean =>
    hidden.has(keyOf(taskId));

/** Test helper: forget every quick action without committing it. */
export const __resetQuickActions = () => actions.clear();
