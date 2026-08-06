import axios from "axios";

import { authApi } from "../../../services/api";
import { createRequestCache } from "../../../services/requestCache";

export interface GithubPullSummary {
    title: string;
    number: number;
    html_url: string;
    state: "open" | "closed" | string;
    draft: boolean;
    repository_url: string;
    updated_at: string;
    created_at: string;
    repo: string; // "owner/name" parsed by backend
}

export interface GithubPullsResponse {
    pulls: GithubPullSummary[];
    total_count: number;
}

/**
 * Every request in this module owns its own failure: the panels render a
 * message inline through `surfaceError`, and the task-linked lookups
 * degrade to an empty list on purpose. The shared toast from the api.ts
 * interceptor either doubles up on that or contradicts it outright.
 *
 * It also mis-attributes the most common failure here. These endpoints
 * proxy GitHub, so when GitHub refuses the call — a token whose scopes
 * don't cover the repo, an org that hasn't granted the app access — the
 * backend surfaces it as a 502. That's a GitHub permission problem, not
 * Genos being down, and "Server error. Please try again shortly." is the
 * wrong thing to tell someone about it (retrying will never help).
 */
const noSharedToast = { suppressErrorToast: true } as const;

const surfaceError = (
    error: unknown,
    setErrorMessage?: (value: string) => void
): "github_not_connected" | "other" => {
    if (axios.isAxiosError(error)) {
        const detail = (error.response?.data as { detail?: string } | undefined)?.detail;
        if (detail === "github_not_connected") {
            setErrorMessage?.("GitHub account is not connected.");
            return "github_not_connected";
        }
        setErrorMessage?.(detail || "GitHub request failed.");
    } else {
        setErrorMessage?.("GitHub request failed.");
    }
    return "other";
};

export const listMyPulls = async (
    accessToken: string,
    opts: { state?: "open" | "closed" | "all" } = {},
    setErrorMessage?: (value: string) => void
): Promise<GithubPullsResponse | "github_not_connected" | null> => {
    try {
        const api = authApi(accessToken);
        if (!api) return null;
        const res = await api.get<GithubPullsResponse>("/github/pulls/", {
            ...noSharedToast,
            params: { state: opts.state || "open" },
        });
        return res.data;
    } catch (error) {
        return surfaceError(error, setErrorMessage) === "github_not_connected"
            ? "github_not_connected"
            : null;
    }
};

export interface GithubRepoSummary {
    full_name: string;
    name: string;
    owner: string;
    private: boolean;
    html_url: string;
    updated_at: string;
}

export interface GithubRepoOwner {
    login: string;
    /** "User" (personal account) or "Organization". */
    type: string;
    repo_count: number;
}

export interface GithubAccessibleReposResponse {
    repos: GithubRepoSummary[];
    owners: GithubRepoOwner[];
    /** True when the repo list hit the server's one-page cap. */
    truncated: boolean;
    /** GitHub's per-application settings page — where ORGANIZATION access
     *  is granted. Null when no OAuth client id is configured. */
    manage_url: string | null;
}

/**
 * What Genos can currently reach on GitHub, grouped by owner.
 *
 * Backs the "Repository access" panel. There is no per-repo selection to
 * fetch — the integration is an OAuth App with the account-wide `repo`
 * scope — so the useful question is which OWNERS are visible: a personal
 * repo appears the moment it's created, while an organization only shows
 * up once it has granted the app access.
 */
export const listAccessibleRepos = async (
    accessToken: string,
    setErrorMessage?: (value: string) => void
): Promise<GithubAccessibleReposResponse | "github_not_connected" | null> => {
    try {
        const api = authApi(accessToken);
        if (!api) return null;
        const res = await api.get<GithubAccessibleReposResponse>(
            "/github/accessible-repos/",
            noSharedToast
        );
        return res.data;
    } catch (error) {
        return surfaceError(error, setErrorMessage) === "github_not_connected"
            ? "github_not_connected"
            : null;
    }
};

export const getPullDetail = async (
    accessToken: string,
    owner: string,
    repo: string,
    number: number,
    setErrorMessage?: (value: string) => void
): Promise<unknown | "github_not_connected" | null> => {
    try {
        const api = authApi(accessToken);
        if (!api) return null;
        const res = await api.get(`/github/pulls/${owner}/${repo}/${number}/`, noSharedToast);
        return res.data;
    } catch (error) {
        return surfaceError(error, setErrorMessage) === "github_not_connected"
            ? "github_not_connected"
            : null;
    }
};

export interface LinkedBranch {
    owner: string;
    repo: string;
    name: string;
    url: string;
    commit_sha?: string | null;
}

export interface LinkedBranchesResponse {
    branches: LinkedBranch[];
}

// PR auto-linked to a task via branch naming convention (head ref
// contains the task's display ID). The backend dedupes by html_url.
export interface LinkedPull {
    owner: string;
    repo: string;
    branch: string;
    number: number;
    html_url: string;
    title: string;
    state: "open" | "closed";
    draft: boolean;
    merged_at: string | null;
}

export interface LinkedPullsResponse {
    pulls: LinkedPull[];
}

// Fetch branches whose names match the task's display ID (e.g. branches
// containing "GEN-42"). Returns an empty list silently on any failure —
// the calling UI hides the section when there's nothing to show, so a
// dropped request is indistinguishable from no matches by design.
export const loadLinkedBranches = async (
    accessToken: string | null,
    taskId: number | string,
    options?: { bypassCache?: boolean }
): Promise<LinkedBranch[]> => {
    try {
        const api = authApi(accessToken);
        if (!api) return [];
        const params: Record<string, string | number> = { task_id: taskId };
        if (options?.bypassCache) params.fresh = "1";
        const res = await api.get<LinkedBranchesResponse>("/github/branches/for-task/", {
            ...noSharedToast,
            params,
        });
        return res.data.branches ?? [];
    } catch {
        return [];
    }
};

// PRs whose head branch matches the task's display ID. Drives the
// task table's PR column. Server-side cached for 60s.
export const loadLinkedPulls = async (
    accessToken: string | null,
    taskId: number | string,
    options?: { bypassCache?: boolean }
): Promise<LinkedPull[]> => {
    try {
        const api = authApi(accessToken);
        if (!api) return [];
        const params: Record<string, string | number> = { task_id: taskId };
        if (options?.bypassCache) params.fresh = "1";
        const res = await api.get<LinkedPullsResponse>("/github/pulls/for-task/", {
            ...noSharedToast,
            params,
        });
        return res.data.pulls ?? [];
    } catch {
        return [];
    }
};

// ── Batched pulls-for-task collector ──────────────────────────────
//
// `PrStatusCell` renders once per table row, so per-row
// `loadLinkedPulls` meant N requests per table paint. Calls arriving
// within one flush window coalesce into a single
// `GET /github/pulls/for-tasks/?task_ids=…` and the response fans
// back out per task. The 50ms window comfortably collects one grid
// paint of rows (they mount within a frame or two) while staying
// invisible next to the network round-trip; a microtask-only window
// would miss virtualised late mounts.
//
// A 60s TTL memo per task (mirroring the server's Redis TTL) rides
// on `createRequestCache`, which also dedups concurrent calls for the
// same task into one waiter. On any batch failure — including a 404
// from a backend that doesn't have the endpoint yet — each waiter
// falls back to the per-task endpoint, so deploy order is safe.

interface LinkedPullsBatchResponse {
    pulls_by_task: Record<string, LinkedPull[]>;
}

const BATCH_WINDOW_MS = 50;
const BATCH_MAX_IDS = 200; // mirrors the backend cap

type PullsBatchWaiter = {
    taskId: string;
    accessToken: string | null;
    resolve: (pulls: LinkedPull[]) => void;
};

const pullsBatchCache = createRequestCache<LinkedPull[]>({ ttlMs: 60_000 });
let pendingPullsWaiters: PullsBatchWaiter[] = [];
let pullsFlushTimer: ReturnType<typeof setTimeout> | null = null;

const flushPullsBatch = async (): Promise<void> => {
    const waiters = pendingPullsWaiters;
    pendingPullsWaiters = [];
    pullsFlushTimer = null;
    if (waiters.length === 0) return;

    const fallback = (chunk: PullsBatchWaiter[]) => {
        for (const w of chunk) {
            void loadLinkedPulls(w.accessToken, w.taskId).then(w.resolve);
        }
    };

    for (let i = 0; i < waiters.length; i += BATCH_MAX_IDS) {
        const chunk = waiters.slice(i, i + BATCH_MAX_IDS);
        const api = authApi(chunk[0].accessToken);
        if (!api) {
            for (const w of chunk) w.resolve([]);
            continue;
        }
        try {
            const ids = [...new Set(chunk.map((w) => w.taskId))];
            const res = await api.get<LinkedPullsBatchResponse>("/github/pulls/for-tasks/", {
                ...noSharedToast,
                params: { task_ids: ids.join(",") },
            });
            const byTask = res.data.pulls_by_task ?? {};
            for (const w of chunk) w.resolve(byTask[w.taskId] ?? []);
        } catch {
            fallback(chunk);
        }
    }
};

export const loadLinkedPullsBatched = (
    accessToken: string | null,
    taskId: number | string
): Promise<LinkedPull[]> =>
    pullsBatchCache.get(`ghpulls:${taskId}`, () => {
        return new Promise<LinkedPull[]>((resolve) => {
            pendingPullsWaiters.push({ taskId: String(taskId), accessToken, resolve });
            if (pullsFlushTimer == null) {
                pullsFlushTimer = setTimeout(() => void flushPullsBatch(), BATCH_WINDOW_MS);
            }
        });
    });

// Test affordance: reset the memo + any pending flush state so one
// test's batch can't leak into the next.
export const _resetLinkedPullsBatchingForTests = (): void => {
    pullsBatchCache.clear();
    pendingPullsWaiters = [];
    if (pullsFlushTimer != null) {
        clearTimeout(pullsFlushTimer);
        pullsFlushTimer = null;
    }
};
