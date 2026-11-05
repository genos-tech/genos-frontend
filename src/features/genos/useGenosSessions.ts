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
//
// The server caps the browsable list at 20 unpinned sessions (no
// pagination yet), which is why this hook owns the other two ways to
// reach past that: `search`, which filters server-side across every
// question in a session, and `togglePin`, which keeps a session at the
// top regardless of age.
//
// A request that FAILS is not an empty answer (MIP-973). The list on screen is
// kept, so a dropped connection or a deploy rolling over the API cannot wipe
// it, and `loadFailed` lets a surface that has nothing to show say "couldn't
// load" with a retry instead of "no conversations". The one exception is a
// failed load for a DIFFERENT list than the one held — another team, another
// search term: that old list is the wrong thing to leave up, so it goes and
// the failure shows. It is keyed on team + term, never on the token, so a
// token refresh that fails does not wipe the list.
//
// Deletes happen elsewhere (Settings -> What Genos remembers) and arrive as
// an `agentSessionsDeleted` event. Every instance of this hook — the page's
// sidebar and the settings panel's own list — drops the deleted rows on it,
// so neither needs to know the other exists and neither has to refetch.

import { useCallback, useEffect, useRef, useState } from "react";

import {
    fetchAgentSessions,
    setAgentSessionPin,
    type AgentSessionSummary,
} from "../../services/agentApi";
import { deletionCoversSession, useAgentSessionsDeleted } from "../agentQA";

// Long enough that a typed word is one request rather than five, short
// enough that the list feels like it's tracking the box.
const SEARCH_DEBOUNCE_MS = 250;

export interface UseGenosSessionsArgs {
    accessToken: string | null;
    teamId: string | null | undefined;
    refreshKey: number;
}

export interface UseGenosSessionsReturn {
    sessions: AgentSessionSummary[];
    isLoading: boolean;
    /**
     * The latest load failed. `sessions` is then either the list that was
     * already on screen (kept) or empty (nothing to keep) — callers show the
     * error only in the empty case, and never the "no conversations" message.
     */
    loadFailed: boolean;
    /** Fetch again now, e.g. from a "Retry" button after `loadFailed`. */
    reload: () => void;
    /** What's in the box right now — updates on every keystroke. */
    search: string;
    setSearch: (next: string) => void;
    /** Non-null after a pin toggle failed and was rolled back. */
    pinError: string | null;
    togglePin: (sessionId: string) => void;
}

export const useGenosSessions = ({
    accessToken,
    teamId,
    refreshKey,
}: UseGenosSessionsArgs): UseGenosSessionsReturn => {
    const [sessions, setSessions] = useState<AgentSessionSummary[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [loadFailed, setLoadFailed] = useState(false);
    const [search, setSearch] = useState("");
    // The term the list was actually fetched with. Split from `search` so
    // the input can stay instant while requests lag behind it.
    const [committedSearch, setCommittedSearch] = useState("");
    const [pinError, setPinError] = useState<string | null>(null);
    // Bumped after a pin toggle lands, to re-fetch. The server decides
    // the order (pinned first, newest pin first) and which pinned rows
    // are exempt from the recent cap; reproducing that here would be a
    // second implementation of it, free to drift.
    const [pinRefreshKey, setPinRefreshKey] = useState(0);
    // Bumped by `reload` to refetch without anything else changing.
    const [reloadKey, setReloadKey] = useState(0);
    // Which list `sessions` holds: the team and search term it was loaded for.
    // Null when it holds nothing worth keeping.
    const loadedForRef = useRef<string | null>(null);

    useEffect(() => {
        const term = search.trim();
        if (term === committedSearch) return;
        // Clearing is instant: the user wants the full list back, and
        // there's nothing to coalesce.
        if (!term) {
            setCommittedSearch("");
            return;
        }
        const timer = window.setTimeout(() => setCommittedSearch(term), SEARCH_DEBOUNCE_MS);
        return () => window.clearTimeout(timer);
    }, [search, committedSearch]);

    useEffect(() => {
        if (!accessToken || !teamId) {
            setSessions([]);
            setLoadFailed(false);
            loadedForRef.current = null;
            return;
        }
        const listKey = `${teamId}\n${committedSearch}`;
        let cancelled = false;
        // Only the very first load shows a spinner; refreshes swap the
        // list in place so a completing turn doesn't flash the sidebar.
        setIsLoading((prev) => prev || sessions.length === 0);
        fetchAgentSessions({ accessToken, search: committedSearch, teamId })
            .then((next) => {
                if (cancelled) return;
                if (next === null) {
                    setLoadFailed(true);
                    if (loadedForRef.current !== listKey) {
                        setSessions([]);
                        loadedForRef.current = null;
                    }
                    return;
                }
                loadedForRef.current = listKey;
                setLoadFailed(false);
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
    }, [accessToken, teamId, refreshKey, committedSearch, pinRefreshKey, reloadKey]);

    const reload = useCallback(() => setReloadKey((k) => k + 1), []);

    useAgentSessionsDeleted((detail) => {
        setSessions((prev) =>
            prev.filter((s) => !deletionCoversSession(detail, s.session_id, teamId))
        );
    });

    const togglePin = useCallback(
        (sessionId: string) => {
            const target = sessions.find((s) => s.session_id === sessionId);
            if (!target || !accessToken) return;
            const pinned = !target.is_pinned;

            // Flip the icon now and re-order on the refetch below. Moving
            // the row here too would mean guessing the server's ordering.
            setPinError(null);
            setSessions((prev) =>
                prev.map((s) => (s.session_id === sessionId ? { ...s, is_pinned: pinned } : s))
            );

            void setAgentSessionPin({ accessToken, pinned, sessionId }).then((ok) => {
                if (ok) {
                    setPinRefreshKey((k) => k + 1);
                    return;
                }
                // Put the icon back rather than leave it lying: a pin the
                // server rejected would silently vanish on the next
                // refresh anyway, and the user would never know why.
                setPinError(sessionId);
                setSessions((prev) =>
                    prev.map((s) =>
                        s.session_id === sessionId ? { ...s, is_pinned: !pinned } : s
                    )
                );
            });
        },
        [accessToken, sessions]
    );

    return { isLoading, loadFailed, pinError, reload, search, sessions, setSearch, togglePin };
};
