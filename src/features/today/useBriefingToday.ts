import { useCallback, useEffect, useRef, useState } from "react";
import axios from "axios";

import { useAuth } from "../../context/AuthContext";
import { BriefingToday, loadBriefingToday, markLooked, sinceForView } from "./briefingToday";

export type BriefingTodayStatus = "loading" | "ready" | "unavailable" | "error";

export type BriefingTodayView = {
    status: BriefingTodayStatus;
    data: BriefingToday | null;
    /** The time the "changed" list counts from, as an ISO string (the API's own answer). */
    since: string | null;
    refresh: () => void;
};

/**
 * The today briefing for the Tasks dashboard tab and the Genos page card (MIP-1005, MIP-1696).
 * One request per mount (and per refresh): the answer is computed from a dozen sources on the
 * server, so it is never polled. When the viewer leaves, "last looked" moves to now, so the next
 * visit lists what changed in between. Failures are a status, never an exception.
 */
export const useBriefingToday = (
    teamId: string | null | undefined,
    userId: string | null | undefined,
    enabled = true
): BriefingTodayView => {
    const { accessToken } = useAuth();
    const [status, setStatus] = useState<BriefingTodayStatus>("loading");
    const [data, setData] = useState<BriefingToday | null>(null);
    const [reload, setReload] = useState(0);
    // Fixed for the life of the view, so a refresh asks the same question.
    const sinceRef = useRef<string | null>(null);
    const viewKey = `${teamId ?? ""}|${userId ?? ""}`;

    useEffect(() => {
        if (!enabled || !teamId || !userId) return undefined;
        return () => markLooked(userId, teamId);
    }, [enabled, teamId, userId]);

    useEffect(() => {
        if (!enabled || !teamId || !userId) return undefined;
        const controller = new AbortController();
        setStatus((s) => (s === "ready" ? s : "loading"));
        (async () => {
            try {
                const since = reload === 0 ? sinceForView(userId, teamId) : sinceRef.current;
                sinceRef.current = since;
                const result = await loadBriefingToday(
                    accessToken,
                    teamId,
                    since,
                    controller.signal
                );
                if (controller.signal.aborted) return;
                if (result.status === "ok") {
                    setData(result.data);
                    setStatus("ready");
                } else {
                    setStatus(result.status);
                }
            } catch (error) {
                if (!axios.isCancel(error)) setStatus("error");
            }
        })();
        return () => controller.abort();
    }, [enabled, accessToken, viewKey, reload, teamId, userId]);

    const refresh = useCallback(() => setReload((n) => n + 1), []);
    return { status, data, since: data?.window.since ?? sinceRef.current, refresh };
};
