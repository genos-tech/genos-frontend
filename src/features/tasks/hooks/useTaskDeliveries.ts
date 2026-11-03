import { useEffect, useRef, useState } from "react";

import { useAuth } from "../../../context/AuthContext";
import { UserProps } from "../../../types/admin";
import { TaskDeliveryProps } from "../../../types/tasks";
import { loadTaskDeliveries } from "../services/loadTaskDeliveries";
import { passThroughTicket } from "../services/taskOpenLanding";
import { joinOpenLanding, useTaskOpenLanding } from "./TaskOpenLandingContext";

/**
 * Load one task's delivery links (branch / PR / state), kept fresh while
 * it's on screen.
 *
 * Refetch triggers:
 *   - `taskId` changes (a different task is being shown)
 *   - the window regains focus, bypassing the cache — a PR's state moves
 *     on GitHub (merge, close), which no local event can signal, and
 *     "merge it, alt-tab back" is exactly when the row must be current.
 *     Only the load a focus causes skips the cache: the nonce only grows, so
 *     keying on `focusNonce > 0` made every later load (every task switch,
 *     for the rest of the page's life) skip it as well.
 *
 * Inside a task preview the first answer of an open lands together with the
 * preview's other loaders (see taskOpenLanding.ts); a focus refresh never
 * waits for them.
 */
export const useTaskDeliveries = (
    myself: UserProps,
    taskId: number | null | undefined
): TaskDeliveryProps[] => {
    const { accessToken } = useAuth();
    const [deliveries, setDeliveries] = useState<TaskDeliveryProps[]>([]);
    const [focusNonce, setFocusNonce] = useState(0);
    const landing = useTaskOpenLanding();
    const handledFocusNonce = useRef(0);

    const numericId = Number(taskId);
    const resolvedId = Number.isFinite(numericId) && numericId > 0 ? numericId : null;

    useEffect(() => {
        const onFocus = () => setFocusNonce((n) => n + 1);
        window.addEventListener("focus", onFocus);
        return () => window.removeEventListener("focus", onFocus);
    }, []);

    useEffect(() => {
        if (resolvedId == null) {
            setDeliveries([]);
            return;
        }
        // Cancelled-flag guard: a stale load must not clobber the
        // freshly-selected task's rows when clicks outrun fetches.
        let cancelled = false;
        const causedByFocus = focusNonce !== handledFocusNonce.current;
        handledFocusNonce.current = focusNonce;
        const ticket = causedByFocus
            ? passThroughTicket
            : joinOpenLanding(landing, resolvedId, "deliveries");
        (async () => {
            const rows = await loadTaskDeliveries(myself, resolvedId, accessToken, {
                forceRefresh: causedByFocus,
            });
            ticket.land(() => {
                if (!cancelled) setDeliveries(rows);
            });
        })();
        return () => {
            cancelled = true;
            ticket.cancel();
        };
        // `myself` is deliberately keyed by its team only: the object is
        // rebuilt on unrelated profile updates.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [resolvedId, myself.teamId, accessToken, focusNonce]);

    return deliveries;
};
