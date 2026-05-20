import axios from "axios";

import { authApi } from "../../../services/api";

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
            params: { state: opts.state || "open" },
        });
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
        const res = await api.get(`/github/pulls/${owner}/${repo}/${number}/`);
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
    taskId: number | string
): Promise<LinkedBranch[]> => {
    try {
        const api = authApi(accessToken);
        if (!api) return [];
        const res = await api.get<LinkedBranchesResponse>("/github/branches/for-task/", {
            params: { task_id: taskId },
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
    taskId: number | string
): Promise<LinkedPull[]> => {
    try {
        const api = authApi(accessToken);
        if (!api) return [];
        const res = await api.get<LinkedPullsResponse>("/github/pulls/for-task/", {
            params: { task_id: taskId },
        });
        return res.data.pulls ?? [];
    } catch {
        return [];
    }
};
