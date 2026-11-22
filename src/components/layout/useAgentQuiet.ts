import { useEffect, useState } from "react";

import { fetchAgentQuiet, type AgentQuiet } from "../../services/mcpConnections";

/**
 * The no-activity check (MIP-2022), read once when `enabled` turns true. `null` until it
 * answers, when it could not be read, or while `enabled` is false: every one of those shows
 * nothing (a missing answer is never a warning).
 */
export const useAgentQuiet = (accessToken: string | null, enabled: boolean): AgentQuiet | null => {
    const [state, setState] = useState<AgentQuiet | null>(null);
    useEffect(() => {
        if (!enabled || !accessToken) return;
        let cancelled = false;
        void fetchAgentQuiet(accessToken).then((res) => {
            if (!cancelled) setState(res);
        });
        return () => {
            cancelled = true;
        };
    }, [accessToken, enabled]);
    return enabled ? state : null;
};
