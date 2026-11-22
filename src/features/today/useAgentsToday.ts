import { useEffect, useState } from "react";
import axios from "axios";

import { AgentsToday, loadAgentsToday } from "./agentsToday";

/**
 * The data of the "Your agents today" card (MIP-2004): one request per mount, never polled, and
 * `null` for every case that means "show nothing" (loading, failure, no activity).
 */
export const useAgentsToday = (
    accessToken: string | null,
    teamId: string | null | undefined
): AgentsToday | null => {
    const [data, setData] = useState<AgentsToday | null>(null);

    useEffect(() => {
        if (!teamId) return undefined;
        const controller = new AbortController();
        setData(null);
        (async () => {
            try {
                const result = await loadAgentsToday(accessToken, teamId, controller.signal);
                if (controller.signal.aborted) return;
                setData(result.status === "ok" ? result.data : null);
            } catch (error) {
                if (!axios.isCancel(error)) setData(null);
            }
        })();
        return () => controller.abort();
    }, [accessToken, teamId]);

    return data;
};
