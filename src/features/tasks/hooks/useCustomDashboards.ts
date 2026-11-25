import { useCallback, useEffect, useRef, useState } from "react";

import { useAuth } from "../../../context/authState";
import { CustomDashboards, loadCustomDashboards } from "../services/loadCustomDashboards";

export type CustomDashboardsStatus = "loading" | "ready" | "unavailable" | "error";

export type CustomDashboardsView = {
    status: CustomDashboardsStatus;
    data: CustomDashboards | null;
    /** Reads the lists again without blanking them (after "Run now"). */
    refresh: () => void;
    retry: () => void;
};

/**
 * The lists of the "Custom dashboards by AI" tab (MIP-2356). Loads when `enabled` (the tab is
 * open and the Tasks route is on screen) and again when the team changes; a stale answer is
 * dropped. A failure is a status, never an exception.
 */
export const useCustomDashboards = (teamId: string, enabled: boolean): CustomDashboardsView => {
    const { accessToken } = useAuth();
    const [status, setStatus] = useState<CustomDashboardsStatus>("loading");
    const [data, setData] = useState<CustomDashboards | null>(null);
    const [reloadToken, setReloadToken] = useState(0);
    // The team the shown lists belong to. A load for the same team keeps them on screen (coming
    // back to the tab, "Run now", a refreshed token): the frame is not torn down and no skeleton
    // flashes. A different team, or Retry, starts from the skeleton.
    const shownTeam = useRef<string | null>(null);

    useEffect(() => {
        if (!enabled) return undefined;
        const controller = new AbortController();
        const keep = shownTeam.current === teamId;
        if (!keep) {
            setStatus("loading");
            setData(null);
        }
        loadCustomDashboards(accessToken, teamId, controller.signal).then((result) => {
            if (controller.signal.aborted) return;
            if (result.status === "ready") {
                shownTeam.current = teamId;
                setData(result.data);
                setStatus("ready");
            } else if (!keep) {
                setStatus(result.status);
            }
        });
        return () => controller.abort();
    }, [enabled, accessToken, teamId, reloadToken]);

    const refresh = useCallback(() => setReloadToken((n) => n + 1), []);
    const retry = useCallback(() => {
        shownTeam.current = null;
        setReloadToken((n) => n + 1);
    }, []);
    return { status, data, refresh, retry };
};
