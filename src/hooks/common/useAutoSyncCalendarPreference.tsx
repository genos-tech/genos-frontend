import { useCallback, useEffect, useState } from "react";

import { useAuth } from "../../context/AuthContext";
import { authApi } from "../../services/api";

// Server-side preference. Mirrors `useAutoCloseOnPrMergePreference`
// since the signal that runs the actual sync also lives server-side
// (post_save on TaskMaster). The UI just exposes the toggle and an
// optional one-shot backfill action.

interface State {
    enabled: boolean;
    /** True while the initial GET is in flight. The Settings UI shows
     *  the switch in a disabled state until this clears. */
    loading: boolean;
}

export interface BackfillResult {
    /** Tasks that did NOT have a linked event before this run and
     *  got a brand-new event created on Google. */
    created: number;
    /** Tasks that already had a linked event and got re-pushed
     *  (idempotent on Google's side; counts non-zero on every
     *  click after the first since linked events get PATCHed). */
    patched: number;
    /** Tasks whose linked event was missing on Google (hard-deleted
     *  via 404 or soft-deleted via `status="cancelled"`). The link
     *  columns are cleared in DB but per the never-re-create rule
     *  no new event is posted. Surfaced so the toast doesn't lie
     *  about how many real events were touched. */
    cleared: number;
    /** `created + patched`. Excludes `cleared` and failures. */
    synced: number;
}

interface UseAutoSyncCalendarPreference {
    enabled: boolean;
    loading: boolean;
    setEnabled: (value: boolean) => Promise<void>;
    /** POSTs the one-shot backfill. Resolves to the per-outcome
     *  counts on success, or `null` on failure (caller surfaces an
     *  error toast). Pre-conditions enforced server-side: preference
     *  must be ON and Google must be connected. */
    backfill: () => Promise<BackfillResult | null>;
    /** Tracks an in-flight backfill so the UI can disable the button
     *  without duplicating state in every consumer. */
    backfillRunning: boolean;
}

export const useAutoSyncCalendarPreference = (): UseAutoSyncCalendarPreference => {
    const { accessToken } = useAuth();
    const [state, setState] = useState<State>({ enabled: false, loading: true });
    const [backfillRunning, setBackfillRunning] = useState(false);

    useEffect(() => {
        let cancelled = false;
        const api = authApi(accessToken);
        if (!api) {
            setState({ enabled: false, loading: false });
            return;
        }
        (async () => {
            try {
                const res = await api.get<{ auto_sync_tasks_to_calendar: boolean }>(
                    "/user/preferences/auto-sync-tasks-to-calendar/"
                );
                if (cancelled) return;
                setState({
                    enabled: !!res.data.auto_sync_tasks_to_calendar,
                    loading: false,
                });
            } catch {
                // Endpoint missing / network error — fall back to OFF
                // so the UI renders something sensible instead of
                // hanging on the spinner.
                if (!cancelled) setState({ enabled: false, loading: false });
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [accessToken]);

    const setEnabled = useCallback(
        async (value: boolean) => {
            const api = authApi(accessToken);
            if (!api) return;
            const previous = state.enabled;
            setState((s) => ({ ...s, enabled: value }));
            try {
                await api.patch("/user/preferences/auto-sync-tasks-to-calendar/", {
                    auto_sync_tasks_to_calendar: value,
                });
            } catch {
                setState((s) => ({ ...s, enabled: previous }));
            }
        },
        [accessToken, state.enabled]
    );

    const backfill = useCallback(async (): Promise<BackfillResult | null> => {
        const api = authApi(accessToken);
        if (!api) return null;
        setBackfillRunning(true);
        try {
            const res = await api.post<Partial<BackfillResult>>("/user/calendar-sync/backfill/");
            const created = Number(res.data.created ?? 0);
            const patched = Number(res.data.patched ?? 0);
            const cleared = Number(res.data.cleared ?? 0);
            // Defensive: only trust the response if the server gave
            // us numbers. Bail to null on garbage so the UI surfaces
            // a clean error rather than rendering "Synced NaN".
            if (
                !Number.isFinite(created) ||
                !Number.isFinite(patched) ||
                !Number.isFinite(cleared)
            ) {
                return null;
            }
            return { created, patched, cleared, synced: created + patched };
        } catch {
            return null;
        } finally {
            setBackfillRunning(false);
        }
    }, [accessToken]);

    return {
        enabled: state.enabled,
        loading: state.loading,
        setEnabled,
        backfill,
        backfillRunning,
    };
};
