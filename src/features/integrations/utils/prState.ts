// Shared PR / CI state derivation used by LinkedPrCard (full unfurl
// card in the task metadata panel) and the table's "PR" column. Kept
// separate from the React components so the table cell can fetch its
// own state via `prStatusCache` without pulling the whole card module.

import type { CheckRunsResponse, CombinedStatus, PrDetailResponse } from "../services/prTypes";

export type CiState = "passing" | "failing" | "pending" | "none";
export type PrState = "merged" | "draft" | "open" | "closed";

/**
 * Combine GitHub's two independent CI reporting systems into one badge.
 *
 *   - **Check runs** (`/commits/{sha}/check-runs`) — what GitHub Actions
 *     and modern GitHub Apps report through.
 *   - **Commit statuses** (`/commits/{sha}/status`) — the legacy API,
 *     used by external CI that posts statuses (older CircleCI/Jenkins
 *     setups, coverage bots).
 *
 * A repo typically uses one or the other, and the empty side must not
 * outvote the side that actually ran.
 *
 * THE TRAP: the combined-status endpoint reports `state: "pending"` when
 * a commit has **no statuses at all** — that's documented behaviour
 * ("pending if there are no statuses, or a context is pending"), not an
 * in-progress signal. So for any Actions-only repo the legacy state is
 * permanently "pending", and treating it as pending pinned the badge to
 * yellow forever no matter how green the checks were.
 *
 * Hence every read of the combined state is gated on `total_count > 0` —
 * i.e. only trust it when statuses actually exist.
 */
export const deriveCiState = (
    cs: CombinedStatus | null,
    cr: CheckRunsResponse | null
): CiState => {
    const checks = cr?.check_runs ?? [];
    const csState = cs?.state ?? null;
    // Zero statuses makes `csState` meaningless (see above), so the
    // count is what decides whether the legacy side gets a vote at all.
    const hasStatuses = (cs?.total_count ?? 0) > 0;

    const hasFailure = checks.some(
        (c) =>
            c.conclusion === "failure" ||
            c.conclusion === "action_required" ||
            // A timed-out run is a failed run — GitHub shows it red too.
            // `cancelled` / `neutral` / `skipped` / `stale` deliberately
            // don't fail the badge, matching github.com.
            c.conclusion === "timed_out"
    );
    const hasPending =
        checks.some((c) => c.status !== "completed") || (hasStatuses && csState === "pending");

    if (hasFailure || (hasStatuses && (csState === "failure" || csState === "error"))) {
        return "failing";
    }
    if (hasPending) return "pending";
    // Nothing reported from either system → no CI configured for this
    // commit, which is a grey dash rather than a green tick.
    if (checks.length === 0 && !hasStatuses) return "none";
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
