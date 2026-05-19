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
): Promise<unknown | null> => {
    try {
        const api = authApi(accessToken);
        if (!api) return null;
        const res = await api.get(`/github/pulls/${owner}/${repo}/${number}/`);
        return res.data;
    } catch (error) {
        surfaceError(error, setErrorMessage);
        return null;
    }
};
