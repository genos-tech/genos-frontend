// Shared PR / CI state derivation used by LinkedPrCard (full unfurl
// card in the task metadata panel) and the table's "PR" column. Kept
// separate from the React components so the table cell can fetch its
// own state via `prStatusCache` without pulling the whole card module.

import type { CheckRunsResponse, CombinedStatus, PrDetailResponse } from "../services/prTypes";

export type CiState = "passing" | "failing" | "pending" | "none";
export type PrState = "merged" | "draft" | "open" | "closed";

export const deriveCiState = (
    cs: CombinedStatus | null,
    cr: CheckRunsResponse | null
): CiState => {
    const checks = cr?.check_runs ?? [];
    const csState = cs?.state ?? null;
    const hasFailure = checks.some(
        (c) => c.conclusion === "failure" || c.conclusion === "action_required"
    );
    const hasPending = checks.some((c) => c.status !== "completed") || csState === "pending";
    if (hasFailure || csState === "failure" || csState === "error") return "failing";
    if (hasPending) return "pending";
    if (checks.length === 0 && (csState === null || csState === undefined)) return "none";
    return "passing";
};

export const derivePrState = (pull: PrDetailResponse["pull"]): PrState => {
    if (pull.merged) return "merged";
    if (pull.draft) return "draft";
    if (pull.state === "open") return "open";
    return "closed";
};

// GitHub's canonical colors for PR state badges. Matches what
// github.com renders.
export const prStateColor = (state: PrState): string => {
    switch (state) {
        case "open":
            return "#1f883d";
        case "merged":
            return "#8250df";
        case "closed":
            return "#cf222e";
        case "draft":
        default:
            return "#6e7781";
    }
};

// Canonical CI badge colors — green/red/yellow/grey matching the PR
// state palette above.
export const ciStateColor = (state: CiState): string => {
    switch (state) {
        case "passing":
            return "#1f883d";
        case "failing":
            return "#cf222e";
        case "pending":
            return "#bf8700";
        case "none":
        default:
            return "#6e7781";
    }
};
