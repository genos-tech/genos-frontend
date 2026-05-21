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

interface UseAutoSyncCalendarPreference {
    enabled: boolean;
    loading: boolean;
    setEnabled: (value: boolean) => Promise<void>;
    /** POSTs the one-shot backfill. Resolves to the number of tasks
     *  synced on success, or `null` on failure (caller surfaces an
     *  error toast). Pre-conditions enforced server-side: preference
     *  must be ON and Google must be connected. */
    backfill: () => Promise<number | null>;
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

    const backfill = useCallback(async (): Promise<number | null> => {
        const api = authApi(accessToken);
        if (!api) return null;
        setBackfillRunning(true);
        try {
            const res = await api.post<{ synced: number }>("/user/calendar-sync/backfill/");
            return typeof res.data.synced === "number" ? res.data.synced : null;
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
