import { useEffect, useMemo, useState } from "react";

import { useAuth } from "../../../context/authState";
import { fetchEffortLevels, type EffortLevelRow, type SkillEffort } from "./skillsApi";

/**
 * What each effort level costs next to the others, for the choice in the skill editor (MIP-2198).
 *
 * `undefined` = nothing to show: not asked yet, the request failed, or the server's agent is not on
 * effort levels (a skill's level changes nothing there). The field then looks exactly as it did
 * before: the choice still works, it just has no cost beside it. Asked once per mount.
 */
export const useEffortLevels = (): Partial<Record<SkillEffort, EffortLevelRow>> | undefined => {
    const { accessToken } = useAuth();
    const [rows, setRows] = useState<EffortLevelRow[] | undefined>(undefined);

    useEffect(() => {
        if (!accessToken) return;
        let live = true;
        void fetchEffortLevels(accessToken).then((res) => {
            if (live) setRows(res.ok && res.data.length > 0 ? res.data : undefined);
        });
        return () => {
            live = false;
        };
    }, [accessToken]);

    return useMemo(
        () => (rows ? Object.fromEntries(rows.map((row) => [row.level, row])) : undefined),
        [rows]
    );
};
