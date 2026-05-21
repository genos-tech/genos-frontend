import { useCallback, useEffect, useState } from "react";

import { useAuth } from "../../context/AuthContext";
import { authApi } from "../../services/api";

// Server-side preference. Unlike the localStorage-backed preferences in
// this folder (theme, message-layout, bubble-style), `auto_close_on_pr_merge`
// has to live on the backend because the GitHub PR-merge webhook
// consults it server-side. We mirror it into React state for the UI
// switch and write through on toggle.

interface State {
    enabled: boolean;
    /** True while the initial GET is in flight. The Settings UI shows
     *  the switch in a disabled state until this clears. */
    loading: boolean;
}

export const useAutoCloseOnPrMergePreference = () => {
    const { accessToken } = useAuth();
    const [state, setState] = useState<State>({ enabled: false, loading: true });

    // Initial fetch. If the user isn't authenticated yet (e.g. opening
    // SettingsModal on a logged-out splash), we just leave the
    // preference at its default and stop loading.
    useEffect(() => {
        let cancelled = false;
        const api = authApi(accessToken);
        if (!api) {
            setState({ enabled: false, loading: false });
            return;
        }
        (async () => {
            try {
                const res = await api.get<{ auto_close_on_pr_merge: boolean }>(
                    "/user/preferences/auto-close-on-pr-merge/"
                );
                if (cancelled) return;
                setState({ enabled: !!res.data.auto_close_on_pr_merge, loading: false });
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
            // Optimistic update so the Switch flips instantly. If the
            // PATCH fails we roll back to the old value.
            const previous = state.enabled;
            setState((s) => ({ ...s, enabled: value }));
            try {
                await api.patch("/user/preferences/auto-close-on-pr-merge/", {
                    auto_close_on_pr_merge: value,
                });
            } catch {
                setState((s) => ({ ...s, enabled: previous }));
            }
        },
        [accessToken, state.enabled]
    );

    return { enabled: state.enabled, loading: state.loading, setEnabled };
};
