// Session list for the Genos page's "Ask history" sidebar.
//
// Deliberately NOT the overlay's `historyMode` state machine — that
// flips SpotlightContent's conversation panel into a read-only archive
// and hides the input row, while the page keeps its sidebar and the
// live conversation on screen at the same time. This hook only owns
// the list; clicking a row goes through `useSpotlight.resumeSession`.
//
// Refresh model: fetch on mount and team change, plus whenever
// `refreshKey` changes — the page bumps it when a turn completes so a
// just-finished first ask shows up as a session without a reload.
// The server caps the list at 20 sessions (no pagination yet).

import { useEffect, useState } from "react";

import { fetchAgentSessions, type AgentSessionSummary } from "../../services/agentApi";

export interface UseGenosSessionsArgs {
    accessToken: string | null;
    teamId: string | null | undefined;
    refreshKey: number;
}

export interface UseGenosSessionsReturn {
    sessions: AgentSessionSummary[];
    isLoading: boolean;
}

export const useGenosSessions = ({
    accessToken,
    teamId,
    refreshKey,
}: UseGenosSessionsArgs): UseGenosSessionsReturn => {
    const [sessions, setSessions] = useState<AgentSessionSummary[]>([]);
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        if (!accessToken || !teamId) {
            setSessions([]);
            return;
        }
        let cancelled = false;
        // Only the very first load shows a spinner; refreshes swap the
        // list in place so a completing turn doesn't flash the sidebar.
        setIsLoading((prev) => prev || sessions.length === 0);
        fetchAgentSessions({ accessToken, teamId })
            .then((next) => {
                if (cancelled) return;
                setSessions(next);
            })
            .finally(() => {
                if (!cancelled) setIsLoading(false);
            });
        return () => {
            cancelled = true;
        };
        // `sessions.length` is deliberately NOT a dep — it only shapes
        // the spinner decision for the fetch the other deps triggered.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [accessToken, teamId, refreshKey]);

    return { sessions, isLoading };
};
