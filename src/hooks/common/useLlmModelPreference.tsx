import { useCallback, useEffect, useState } from "react";

import { useAuth } from "../../context/AuthContext";
import { AgentModels, fetchAgentModels } from "../../services/agentApi";
import { authApi } from "../../services/api";

// Server-synced LLM provider/model preference for the Spotlight agent.
// Modelled after `useAutoCloseOnPrMergePreference`:
//   - GET /api/v2/agent/models/ on mount → catalog + current selection
//     + today's per-model usage.
//   - PATCH /api/v2/user/preferences/llm-model/ on change, with
//     optimistic update + rollback on failure.
//
// We expose `refresh()` so the Settings UI can re-pull "used today"
// counts after the user runs a Spotlight query without remounting.

export interface UseLlmModelPreference {
    data: AgentModels | null;
    loading: boolean;
    setChoice: (provider: string, model: string) => Promise<void>;
    // Effort-levels sibling of setChoice: PATCHes {provider, effort}
    // WITHOUT a model key — the backend treats key presence as intent,
    // so the saved legacy model (the rollback substrate) is untouched.
    setEffort: (provider: string, effort: string) => Promise<void>;
    refresh: () => Promise<void>;
}

export const useLlmModelPreference = (): UseLlmModelPreference => {
    const { accessToken } = useAuth();
    const [data, setData] = useState<AgentModels | null>(null);
    const [loading, setLoading] = useState(true);

    const load = useCallback(async () => {
        if (!accessToken) {
            setData(null);
            setLoading(false);
            return;
        }
        const res = await fetchAgentModels(accessToken);
        setData(res);
        setLoading(false);
    }, [accessToken]);

    useEffect(() => {
        let cancelled = false;
        setLoading(true);
        (async () => {
            if (!accessToken) {
                if (!cancelled) {
                    setData(null);
                    setLoading(false);
                }
                return;
            }
            const res = await fetchAgentModels(accessToken);
            if (!cancelled) {
                setData(res);
                setLoading(false);
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [accessToken]);

    const setChoice = useCallback(
        async (provider: string, model: string) => {
            const api = authApi(accessToken);
            if (!api) return;
            const previous = data;
            // Optimistic: flip `current` immediately so the dropdowns
            // settle without a server round-trip. Roll back on failure.
            setData((d) => (d ? { ...d, current: { provider, model } } : d));
            try {
                await api.patch("/user/preferences/llm-model/", {
                    provider,
                    model,
                });
            } catch {
                setData(previous);
            }
        },
        [accessToken, data]
    );

    const setEffort = useCallback(
        async (provider: string, effort: string) => {
            const api = authApi(accessToken);
            if (!api || !data) return;
            const previous = data;
            // Optimistic: settle `current` (incl. the mapped model, so
            // any model-derived UI stays coherent) before the round-trip.
            const mapped = data.efforts?.find(
                (e) => e.provider === provider && e.effort === effort
            );
            setData((d) =>
                d
                    ? {
                          ...d,
                          current: {
                              provider,
                              model: mapped?.model ?? d.current.model,
                              effort,
                          },
                      }
                    : d
            );
            try {
                await api.patch("/user/preferences/llm-model/", { provider, effort });
            } catch {
                setData(previous);
            }
        },
        [accessToken, data]
    );

    return { data, loading, setChoice, setEffort, refresh: load };
};
