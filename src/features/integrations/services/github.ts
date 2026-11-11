import axios from "axios";

import { getMessages } from "../../../i18n";
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
    const messages = getMessages().integrations.errors;
    if (axios.isAxiosError(error)) {
        const detail = (error.response?.data as { detail?: string } | undefined)?.detail;
        if (detail === "github_not_connected") {
            setErrorMessage?.(messages.githubNotConnected);
            return "github_not_connected";
        }
        setErrorMessage?.(detail || messages.githubRequestFailed);
    } else {
        setErrorMessage?.(messages.githubRequestFailed);
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

/** A repo that sends Genos webhook events but is not registered (MIP-755). */
export interface UnregisteredRepo {
    owner: string;
    repo: string;
    event_count: number;
    last_event: string;
    last_seen_at: string;
    can_admin: boolean;
}

/**
 * Repos that have sent events Genos could not use, limited by the server to
 * the ones this user's own GitHub token can read. `null` on any failure: the
 * list is a hint, never worth an error banner.
 */
export const listUnregisteredRepos = async (
    accessToken: string
): Promise<{ repos: UnregisteredRepo[]; connected: boolean } | null> => {
    try {
        const api = authApi(accessToken);
        if (!api) return null;
        const res = await api.get<{ repos: UnregisteredRepo[]; connected: boolean }>(
            "/github/unregistered-repos/",
            noSharedToast
        );
        return res.data;
    } catch {
        return null;
    }
};

export type RegisterRepoResult = { ok: true; reason: string } | { ok: false; reason: string };

/**
 * Register Genos's webhook on `owner/repo` with the signed-in user's GitHub
 * connection, or adopt a hook someone added by hand. The server answers a
 * specific reason when it cannot (`no_admin`, `repo_not_found`, ...), which the
 * page turns into something to do about it.
 */
export const registerGithubRepo = async (
    accessToken: string,
    owner: string,
    repo: string
): Promise<RegisterRepoResult> => {
    try {
        const api = authApi(accessToken);
        if (!api) return { ok: false, reason: "request_failed" };
        const res = await api.post<{ reason: string }>(
            "/github/register-repo/",
            { owner, repo },
            noSharedToast
        );
        return { ok: true, reason: res.data?.reason ?? "created" };
    } catch (error) {
        const detail = axios.isAxiosError(error)
            ? (error.response?.data as { detail?: string } | undefined)?.detail
            : undefined;
        return { ok: false, reason: detail || "request_failed" };
    }
};

/**
 * "owner/repo", or a GitHub URL for a repo or one of its pages, to
 * `[owner, repo]`. Mirrors the server's name rules so an obvious typo is
 * caught before a round trip; the server still decides.
 */
export const parseRepoInput = (input: string): [string, string] | null => {
    const cleaned = input
        .trim()
        .replace(/^https?:\/\/(www\.)?github\.com\//i, "")
        .replace(/\.git$/i, "");
    const [owner, repo] = cleaned.split("/");
    if (!owner || !repo) return null;
    if (!/^[A-Za-z0-9_-]{1,39}$/.test(owner)) return null;
    if (!/^[A-Za-z0-9_.-]{1,100}$/.test(repo) || repo === "." || repo === "..") return null;
    return [owner, repo];
};

/**
 * GitHub refused THIS account the pull: it does not exist or the repo is
 * private to someone else, so asking again changes nothing. The backend
 * relays GitHub's refusal as a 502 carrying `upstream_status` (404, or a 403
 * that is not a rate limit), and a bare 404/403 is read the same way. A
 * dropped connection, a 5xx or a rate limit is NOT this: those can pass.
 */
const isPullRefusal = (error: unknown): boolean => {
    if (!axios.isAxiosError(error) || !error.response) return false;
    const upstream = (error.response.data as { upstream_status?: number } | undefined)
        ?.upstream_status;
    const code = typeof upstream === "number" ? upstream : error.response.status;
    return code === 404 || code === 403;
};

export const getPullDetail = async (
    accessToken: string,
    owner: string,
    repo: string,
    number: number,
    setErrorMessage?: (value: string) => void
): Promise<unknown | "github_not_connected" | "unavailable" | null> => {
    try {
        const api = authApi(accessToken);
        if (!api) return null;
        const res = await api.get(`/github/pulls/${owner}/${repo}/${number}/`, noSharedToast);
        return res.data;
    } catch (error) {
        if (surfaceError(error, setErrorMessage) === "github_not_connected") {
            return "github_not_connected";
        }
        return isPullRefusal(error) ? "unavailable" : null;
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

// The two task-linked lookups below ask the server, which asks GitHub, so
// they are slow (about a second) and the answer rarely changes between a task
// open and the next window focus. They share a short client memo (MIP-967):
// opening a task again, or coming back to the window, within the TTL sends
// nothing. On top of the server's own 60 s cache that bounds how stale a new
// branch or PR can look to about three minutes; the refresh icon passes
// `bypassCache` for an immediate answer.
//
// Keyed by the access token as well as the task, so a different sign-in in
// the same tab never reads another user's answer (GitHub visibility is per
// user). A failed request is never memoized (`createRequestCache` drops
// rejections), so the next call retries.
const LINKED_MEMO_TTL_MS = 120_000;
const linkedBranchesMemo = createRequestCache<LinkedBranch[]>({ ttlMs: LINKED_MEMO_TTL_MS });
const linkedPullsMemo = createRequestCache<LinkedPull[]>({ ttlMs: LINKED_MEMO_TTL_MS });

// Fetch branches whose names match the task's display ID (e.g. branches
// containing "GEN-42"). Resolves to `null` when the lookup failed, which is
// different from `[]` ("looked, found none"): a caller that already shows
// branches keeps them on a failure instead of blanking them.
export const tryLoadLinkedBranches = async (
    accessToken: string | null,
    taskId: number | string,
    options?: { bypassCache?: boolean }
): Promise<LinkedBranch[] | null> => {
    const api = authApi(accessToken);
    if (!api) return null;
    try {
        return await linkedBranchesMemo.get(
            `branches:${accessToken}:${taskId}`,
            async () => {
                const params: Record<string, string | number> = { task_id: taskId };
                if (options?.bypassCache) params.fresh = "1";
                const res = await api.get<LinkedBranchesResponse>("/github/branches/for-task/", {
                    ...noSharedToast,
                    params,
                });
                return res.data.branches ?? [];
            },
            { forceRefresh: options?.bypassCache }
        );
    } catch {
        return null;
    }
};

// Same lookup, returning an empty list silently on any failure — the calling
// UI hides the section when there's nothing to show, so a dropped request is
// indistinguishable from no matches by design.
export const loadLinkedBranches = async (
    accessToken: string | null,
    taskId: number | string,
    options?: { bypassCache?: boolean }
): Promise<LinkedBranch[]> => (await tryLoadLinkedBranches(accessToken, taskId, options)) ?? [];

// PRs whose head branch matches the task's display ID. Drives the task
// table's PR column and the task's Links section. `null` on failure, as above.
export const tryLoadLinkedPulls = async (
    accessToken: string | null,
    taskId: number | string,
    options?: { bypassCache?: boolean }
): Promise<LinkedPull[] | null> => {
    const api = authApi(accessToken);
    if (!api) return null;
    try {
        return await linkedPullsMemo.get(
            `pulls:${accessToken}:${taskId}`,
            async () => {
                const params: Record<string, string | number> = { task_id: taskId };
                if (options?.bypassCache) params.fresh = "1";
                const res = await api.get<LinkedPullsResponse>("/github/pulls/for-task/", {
                    ...noSharedToast,
                    params,
                });
                return res.data.pulls ?? [];
            },
            { forceRefresh: options?.bypassCache }
        );
    } catch {
        return null;
    }
};

export const loadLinkedPulls = async (
    accessToken: string | null,
    taskId: number | string,
    options?: { bypassCache?: boolean }
): Promise<LinkedPull[]> => (await tryLoadLinkedPulls(accessToken, taskId, options)) ?? [];

// Test seam: drop the memo so each test starts cold.
export const resetLinkedGithubMemo = (): void => {
    linkedBranchesMemo.clear();
    linkedPullsMemo.clear();
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
    /**
     * A re-sync of a row that is already drawn (MIP-1409), not a first load. It never falls
     * back to the per-task endpoint (a failing batch must not turn into one request per row)
     * and resolves `null` on failure, so the caller keeps what it shows.
     */
    refresh?: boolean;
    /** Ask the server to skip its own cache too (`fresh=1`). */
    fresh?: boolean;
    resolve: (pulls: LinkedPull[] | null) => void;
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
            if (w.refresh) w.resolve(null);
            else void loadLinkedPulls(w.accessToken, w.taskId).then(w.resolve);
        }
    };

    for (let i = 0; i < waiters.length; i += BATCH_MAX_IDS) {
        const chunk = waiters.slice(i, i + BATCH_MAX_IDS);
        const api = authApi(chunk[0].accessToken);
        if (!api) {
            for (const w of chunk) w.resolve(w.refresh ? null : []);
            continue;
        }
        try {
            const ids = [...new Set(chunk.map((w) => w.taskId))];
            const params: Record<string, string> = { task_ids: ids.join(",") };
            // One row asking for a fresh answer makes the whole request one: it is a single
            // GET, and the rows that did not ask only get a newer answer than they wanted.
            if (chunk.some((w) => w.fresh)) params.fresh = "1";
            const res = await api.get<LinkedPullsBatchResponse>("/github/pulls/for-tasks/", {
                ...noSharedToast,
                params,
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
            pendingPullsWaiters.push({
                taskId: String(taskId),
                accessToken,
                resolve: (pulls) => resolve(pulls ?? []),
            });
            if (pullsFlushTimer == null) {
                pullsFlushTimer = setTimeout(() => void flushPullsBatch(), BATCH_WINDOW_MS);
            }
        });
    });

/**
 * Ask again for a row's PRs, past the client memo (MIP-1409): the PR column's "Refresh tasks"
 * click and its once-a-minute poll. Rows asking in the same window still share ONE request.
 *
 * Resolves `null` when the request failed, which is not `[]` ("looked, found none"): the
 * caller keeps what it already shows. A failure is not stored (the memo drops a rejection),
 * and a success is, so a row that mounts right after reads the new answer.
 * `fresh` also skips the server's cache: the click wants the authoritative answer, the poll
 * does not (every skipped lookup is a GitHub call per matching branch).
 */
export const refreshLinkedPullsBatched = async (
    accessToken: string | null,
    taskId: number | string,
    options?: { fresh?: boolean }
): Promise<LinkedPull[] | null> => {
    try {
        return await pullsBatchCache.get(
            `ghpulls:${taskId}`,
            () =>
                new Promise<LinkedPull[]>((resolve, reject) => {
                    pendingPullsWaiters.push({
                        taskId: String(taskId),
                        accessToken,
                        refresh: true,
                        fresh: options?.fresh,
                        resolve: (pulls) =>
                            pulls ? resolve(pulls) : reject(new Error("PR list refresh failed")),
                    });
                    if (pullsFlushTimer == null) {
                        pullsFlushTimer = setTimeout(
                            () => void flushPullsBatch(),
                            BATCH_WINDOW_MS
                        );
                    }
                }),
            { forceRefresh: true }
        );
    } catch {
        return null;
    }
};

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
