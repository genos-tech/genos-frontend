import { useEffect, useRef } from "react";

import { useAuth } from "../../../context/AuthContext";
import { recordTaskOpen } from "../services/recentTasks";
import { emitTaskOpened } from "../services/taskEvents";

/**
 * Record that the user is looking at the task `taskId` (MIP-1063), so the
 * sidebar's Recents lists it first.
 *
 * Mounted where a task is SHOWN rather than where it is chosen: a task opens
 * from a table row, a chip in a chat, a deep link or a modal, and all of them
 * end in the same preview. Pass `null` while nothing real is shown (a milestone
 * the other preview owns, a task that has not loaded yet).
 *
 * Posts once per task shown: a re-render, a token refresh or the same id
 * arriving again does not post again. Fire and forget; it never blocks the open.
 */
export const useRecordTaskOpen = (taskId: number | null | undefined): void => {
    const { accessToken } = useAuth();
    const recordedRef = useRef<number | null>(null);

    useEffect(() => {
        if (taskId == null || !Number.isFinite(taskId) || taskId <= 0) {
            // Nothing shown: the next task, even the same one, is a new open.
            recordedRef.current = null;
            return;
        }
        if (!accessToken || recordedRef.current === taskId) return;
        recordedRef.current = taskId;
        void recordTaskOpen(taskId, accessToken).then((recorded) => {
            if (recorded) emitTaskOpened();
        });
    }, [taskId, accessToken]);
};
