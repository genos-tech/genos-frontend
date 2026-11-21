import { useCallback, useEffect, useRef, useState } from "react";
import axios from "axios";

import { useAuth } from "../../../context/AuthContext";
import {
    AgentWorkGroup,
    AgentWorkPage,
    AgentWorkQuery,
    loadAgentWork,
} from "../services/loadAgentWork";

export type AgentWorkStatus = "loading" | "ready" | "unavailable" | "error";

export type AgentWorkView = {
    status: AgentWorkStatus;
    /** The first page, with any "Load more" pages folded into its groups. */
    page: AgentWorkPage | null;
    hasMore: boolean;
    loadingMore: boolean;
    /** A "Load more" request failed; the rows already shown stay on screen. */
    loadMoreFailed: boolean;
    loadMore: () => void;
    retry: () => void;
};

/**
 * Fold a later page into the first: its items are appended to the same project group
 * (or the group is added), and the cursor moves on. Totals, decisions and connections
 * describe the whole window and come from the first page only.
 */
export const mergeAgentWorkPages = (first: AgentWorkPage, next: AgentWorkPage): AgentWorkPage => {
    const byProject = new Map<number, AgentWorkGroup>();
    const groups: AgentWorkGroup[] = [];
    for (const group of first.groups) {
        const copy = { ...group, items: [...group.items] };
        byProject.set(group.project.id, copy);
        groups.push(copy);
    }
    for (const group of next.groups) {
        const hit = byProject.get(group.project.id);
        if (hit) {
            hit.items.push(...group.items);
        } else {
            const copy = { ...group, items: [...group.items] };
            byProject.set(group.project.id, copy);
            groups.push(copy);
        }
    }
    return { ...first, groups, next_cursor: next.next_cursor };
};

/**
 * Data for the Agent Activity tab. Loads the first page for `query` when `enabled`,
 * reloads when the query changes (a stale response is dropped), and exposes "Load more"
 * on the server's cursor. Failures become a status, never an exception.
 */
export const useAgentWork = (query: AgentWorkQuery, enabled: boolean): AgentWorkView => {
    const { accessToken } = useAuth();
    const [status, setStatus] = useState<AgentWorkStatus>("loading");
    const [page, setPage] = useState<AgentWorkPage | null>(null);
    const [loadingMore, setLoadingMore] = useState(false);
    const [loadMoreFailed, setLoadMoreFailed] = useState(false);
    const [reloadToken, setReloadToken] = useState(0);
    // Bumped whenever the query changes, so a late "Load more" answer for old filters
    // is thrown away rather than merged into the new view.
    const generation = useRef(0);

    const queryKey = [
        query.days,
        query.projectId ?? "",
        query.agent ?? "",
        query.userId ?? "",
        query.kind ?? "",
    ].join("|");

    useEffect(() => {
        if (!enabled) return undefined;
        generation.current += 1;
        const controller = new AbortController();
        setStatus("loading");
        setPage(null);
        setLoadMoreFailed(false);
        setLoadingMore(false);
        (async () => {
            try {
                const result = await loadAgentWork(accessToken, query, {
                    signal: controller.signal,
                });
                if (controller.signal.aborted) return;
                if (result.status === "ok") {
                    setPage(result.page);
                    setStatus("ready");
                } else {
                    setStatus(result.status);
                }
            } catch (error) {
                if (!axios.isCancel(error)) setStatus("error");
            }
        })();
        return () => controller.abort();
        // `query` is represented by `queryKey`; the object itself is rebuilt each render.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [enabled, accessToken, queryKey, reloadToken]);

    const loadMore = useCallback(() => {
        if (!page?.next_cursor || loadingMore) return;
        const requestGeneration = generation.current;
        const cursor = page.next_cursor;
        setLoadingMore(true);
        setLoadMoreFailed(false);
        loadAgentWork(accessToken, query, { cursor })
            .then((result) => {
                if (requestGeneration !== generation.current) return;
                if (result.status === "ok") {
                    setPage((current) =>
                        current ? mergeAgentWorkPages(current, result.page) : current
                    );
                } else {
                    setLoadMoreFailed(true);
                }
            })
            .catch(() => {
                if (requestGeneration === generation.current) setLoadMoreFailed(true);
            })
            .finally(() => {
                if (requestGeneration === generation.current) setLoadingMore(false);
            });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [page, loadingMore, accessToken, queryKey]);

    const retry = useCallback(() => setReloadToken((n) => n + 1), []);

    return {
        status,
        page,
        hasMore: Boolean(page?.next_cursor),
        loadingMore,
        loadMoreFailed,
        loadMore,
        retry,
    };
};
