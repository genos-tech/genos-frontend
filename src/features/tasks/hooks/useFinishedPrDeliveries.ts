import { useEffect, useState } from "react";

import { UserProps } from "../../../types/admin";
import { TaskDeliveryProps } from "../../../types/tasks";
import { parsePrUrl } from "../../integrations/utils/parsePrUrl";
import { loadTaskDeliveries } from "../services/loadTaskDeliveries";

/** `owner/repo#number`, lower-cased: the same PR however its URL is spelled. */
export const prKey = (url: string | null | undefined): string | null => {
    const ref = parsePrUrl(url);
    return ref ? `${ref.owner}/${ref.repo}#${ref.number}`.toLowerCase() : null;
};

export type FinishedPrs = Map<string, TaskDeliveryProps>;

const NONE: FinishedPrs = new Map();

/**
 * The task's merged or closed PRs, from its deliveries (MIP-998).
 *
 * The preview used to draw a full `LinkedPrCard` per PR link, and each card
 * fetched the PR detail (three GitHub calls on the server) the moment it
 * mounted: a task with a dozen merged PRs sent a dozen at once. The deliveries
 * already say which PRs are finished and are loaded on every open, so those
 * can be drawn as one-line rows that fetch the detail on hover.
 *
 * Read-only on purpose: it awaits the same cached request as
 * `useTaskDeliveries` (same cache key) but does NOT join the preview's
 * open-landing coordination, so it cannot disturb how the open's loaders land.
 *
 * Returns `null` while the deliveries are loading (the caller draws nothing
 * yet: drawing full cards first would send the very requests this avoids), and
 * an empty map when there is nothing to look up or the lookup failed
 * (`loadTaskDeliveries` resolves to `[]` on failure), which keeps today's full
 * cards.
 */
export const useFinishedPrDeliveries = (
    myself: UserProps,
    accessToken: string | null,
    taskId: number | null | undefined,
    enabled: boolean
): FinishedPrs | null => {
    const numeric = Number(taskId);
    const id = enabled && Number.isFinite(numeric) && numeric > 0 ? numeric : null;
    const [loaded, setLoaded] = useState<{ id: number; prs: FinishedPrs } | null>(null);

    useEffect(() => {
        if (id === null) return;
        let cancelled = false;
        void (async () => {
            const rows = await loadTaskDeliveries(myself, id, accessToken);
            if (cancelled) return;
            const prs: FinishedPrs = new Map();
            for (const row of rows) {
                if (row.state !== "merged" && row.state !== "closed") continue;
                const key = prKey(row.pr_url);
                if (key) prs.set(key, row);
            }
            setLoaded({ id, prs });
        })();
        return () => {
            cancelled = true;
        };
        // `myself` is keyed by its team only, as in `useTaskDeliveries`.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [id, myself.teamId, accessToken]);

    if (id === null) return NONE;
    // A previous task's answer must never be shown for this one.
    return loaded !== null && loaded.id === id ? loaded.prs : null;
};
