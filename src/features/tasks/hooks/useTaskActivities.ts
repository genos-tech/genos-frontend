import { useEffect, useState } from "react";

import { useAuth } from "../../../context/AuthContext";
import { UserProps } from "../../../types/admin";
import { TaskActivityProps } from "../../../types/tasks";
import { loadTaskActivities } from "../services/loadTaskActivities";
import { onTaskTouched } from "../services/taskEvents";

/**
 * Load one task's structured audit log, kept fresh while it's on screen.
 *
 * Refetch triggers:
 *   - `taskId` changes (a different task is being shown)
 *   - a `genos:task-touched` event lands for THIS task — scoped to the
 *     open task rather than the global `isTaskUpdated` flags, which flip
 *     for any task in the team and caused the `/task/activity/` request
 *     storm (see taskEvents.ts). A posted comment also writes a
 *     `comment_added` row, so "comment" refreshes the feed too.
 *
 * Owning the fetch outside the feed component matters: JoyUI `TabPanel`
 * unmounts hidden children, so loading inside `TaskActivityFeed` made
 * every visit to an Activity tab refetch and flash.
 *
 * `TaskPreview` still carries its own two inline copies of this logic —
 * they're entangled with its comment-refresh nonce in a shared
 * subscription, so folding them in is a separate change.
 */
export const useTaskActivities = (
    myself: UserProps,
    taskId: number | null | undefined
): { activities: TaskActivityProps[]; isLoading: boolean } => {
    const { accessToken } = useAuth();
    const [activities, setActivities] = useState<TaskActivityProps[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [refreshNonce, setRefreshNonce] = useState(0);

    const numericId = Number(taskId);
    const resolvedId = Number.isFinite(numericId) && numericId > 0 ? numericId : null;

    useEffect(() => {
        if (resolvedId == null) return;
        return onTaskTouched(({ taskId: touchedId, kind }) => {
            if (touchedId !== resolvedId) return;
            if (kind === "comment" || kind === "update") {
                setRefreshNonce((n) => n + 1);
            }
        });
    }, [resolvedId]);

    useEffect(() => {
        if (resolvedId == null) {
            setActivities([]);
            return;
        }
        // Cancelled-flag guard: a stale load must not clobber the
        // freshly-selected task's rows when clicks outrun fetches.
        let cancelled = false;
        (async () => {
            setIsLoading(true);
            const rows = await loadTaskActivities(myself, resolvedId, accessToken);
            if (cancelled) return;
            setActivities(rows);
            setIsLoading(false);
        })();
        return () => {
            cancelled = true;
        };
        // `myself` is a fresh object most renders; the loader only reads
        // `teamId` off it, so keying on that avoids a refetch loop.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [resolvedId, refreshNonce, accessToken, myself.teamId]);

    return { activities, isLoading };
};
