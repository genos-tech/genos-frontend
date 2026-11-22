import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { UserProps } from "../../../types/admin";
import { SearchTeamTasksResponse } from "../../../types/tasks";
import { loadRecentTasks } from "../services/recentTasks";
import { searchTasks } from "../services/searchTasks";

// The task bar's data (MIP-1990). Nothing loads until the box is focused, and then only a
// handful of rows; typing runs a debounced, cancellable, paged server search.

export type TaskSearchSection = "recent" | "project" | "results";
export type TaskSearchOption = SearchTeamTasksResponse & { section: TaskSearchSection };

/** How long typing must pause before a query is sent. */
export const SEARCH_DEBOUNCE_MS = 200;
/** Rows per section on the starting list, and per page of results. */
export const START_LIST_SIZE = 5;
export const PAGE_SIZE = 20;
const OPEN_STATUSES = "open,wip,blocked,pending";

const tag = (rows: SearchTeamTasksResponse[], section: TaskSearchSection): TaskSearchOption[] =>
    rows.map((row) => ({ ...row, section }));

type Args = {
    myself: Pick<UserProps, "teamId"> | undefined;
    accessToken: string | null | undefined;
    /** The project in view: its open tasks are the second part of the starting list. */
    projectId: number | undefined;
};

export const useTaskSearchBar = ({ myself: person, accessToken, projectId }: Args) => {
    // Keyed on the team id alone: the person object changes identity on unrelated updates.
    const teamId = person?.teamId;
    const myself = useMemo(() => (teamId ? { teamId } : undefined), [teamId]);
    const [query, setQuery] = useState("");
    const [active, setActive] = useState(false);
    const [startList, setStartList] = useState<TaskSearchOption[]>([]);
    const [results, setResults] = useState<TaskSearchOption[]>([]);
    const [hasMore, setHasMore] = useState(false);
    const [loading, setLoading] = useState(false);
    const [loadingMore, setLoadingMore] = useState(false);
    const [error, setError] = useState(false);
    const [startError, setStartError] = useState(false);
    // Which query `results` answers; stale rows stay up while the next ones load.
    const [answered, setAnswered] = useState("");

    const trimmed = query.trim();
    const moreRef = useRef<AbortController | null>(null);
    const moreBusyRef = useRef(false);
    const resultsRef = useRef(results);
    resultsRef.current = results;

    // The starting list, fetched on focus and dropped when the box closes.
    useEffect(() => {
        if (!active || !myself) return undefined;
        const ctl = new AbortController();
        setStartError(false);
        setStartList([]);
        const recent = loadRecentTasks(myself as UserProps, accessToken ?? null).then((rows) =>
            (rows ?? []).slice(0, START_LIST_SIZE)
        );
        const inProject = searchTasks(
            myself,
            accessToken ?? null,
            { projectId, statuses: OPEN_STATUSES, limit: START_LIST_SIZE * 2 },
            ctl.signal
        ).then((page) => page.results);
        Promise.allSettled([recent, inProject]).then(([recentRes, projectRes]) => {
            if (ctl.signal.aborted) return;
            const recentRows = recentRes.status === "fulfilled" ? recentRes.value : [];
            const projectRows = projectRes.status === "fulfilled" ? projectRes.value : [];
            // One half failing keeps the other; only both failing is an error.
            setStartError(recentRes.status === "rejected" && projectRes.status === "rejected");
            const seen = new Set(recentRows.map((r) => r.taskId));
            setStartList([
                ...tag(recentRows, "recent"),
                ...tag(
                    projectRows.filter((r) => !seen.has(r.taskId)).slice(0, START_LIST_SIZE),
                    "project"
                ),
            ]);
        });
        return () => ctl.abort();
    }, [active, projectId, accessToken, myself]);

    // Typing: debounce, cancel what is in flight, ask for page one.
    useEffect(() => {
        moreRef.current?.abort();
        moreBusyRef.current = false;
        setLoadingMore(false);
        if (!active || !trimmed || !myself) {
            setLoading(false);
            if (!trimmed) {
                setResults([]);
                setHasMore(false);
                setAnswered("");
            }
            return undefined;
        }
        const ctl = new AbortController();
        setLoading(true);
        const timer = setTimeout(() => {
            searchTasks(myself, accessToken ?? null, { q: trimmed, limit: PAGE_SIZE }, ctl.signal)
                .then((page) => {
                    if (ctl.signal.aborted) return;
                    setResults(tag(page.results, "results"));
                    setHasMore(page.hasMore);
                    setAnswered(trimmed);
                    setError(false);
                    setLoading(false);
                })
                .catch(() => {
                    if (ctl.signal.aborted) return;
                    setError(true);
                    setLoading(false);
                });
        }, SEARCH_DEBOUNCE_MS);
        return () => {
            clearTimeout(timer);
            ctl.abort();
        };
    }, [active, trimmed, myself, accessToken]);

    const loadMore = useCallback(() => {
        if (
            !myself ||
            !hasMore ||
            loading ||
            moreBusyRef.current ||
            !trimmed ||
            answered !== trimmed
        ) {
            return;
        }
        const ctl = new AbortController();
        moreRef.current = ctl;
        moreBusyRef.current = true;
        setLoadingMore(true);
        searchTasks(
            myself,
            accessToken ?? null,
            { q: trimmed, limit: PAGE_SIZE, offset: resultsRef.current.length },
            ctl.signal
        )
            .then((page) => {
                if (ctl.signal.aborted) return;
                moreBusyRef.current = false;
                setResults((prev) => {
                    const seen = new Set(prev.map((r) => r.taskId));
                    return [
                        ...prev,
                        ...tag(page.results, "results").filter((r) => !seen.has(r.taskId)),
                    ];
                });
                setHasMore(page.hasMore);
                setLoadingMore(false);
            })
            .catch(() => {
                if (ctl.signal.aborted) return;
                moreBusyRef.current = false;
                setLoadingMore(false);
            });
    }, [myself, accessToken, hasMore, loading, trimmed, answered]);

    const options: TaskSearchOption[] = trimmed ? results : startList;

    return {
        query,
        setQuery,
        setActive,
        options,
        /** Text the shown rows answer, for highlighting (empty on the starting list). */
        highlight: trimmed ? answered : "",
        loading: trimmed ? loading : false,
        loadingMore,
        error: trimmed ? error : startError,
        loadMore,
        isSearching: trimmed.length > 0,
        /** The shown rows answer what is typed now (Enter must not open a stale row). */
        current: !trimmed || answered === trimmed,
    };
};
