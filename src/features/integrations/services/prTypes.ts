// Shape of the response from GET /api/v2/github/pulls/<owner>/<repo>/<number>/
// (see GithubPullDetailView in the Django backend). The "pull" object is
// GitHub's raw API response trimmed to the fields the UI actually reads.

export interface GithubPullDetail {
    title: string;
    number: number;
    html_url: string;
    state: "open" | "closed";
    draft: boolean;
    merged: boolean;
    created_at: string;
    updated_at: string;
    head: { sha: string };
    base: { repo: { full_name: string } };
}

export interface CombinedStatus {
    state: "pending" | "success" | "failure" | "error" | null;
    total_count: number;
}

export interface CheckRun {
    status: "queued" | "in_progress" | "completed";
    conclusion:
        | "success"
        | "failure"
        | "neutral"
        | "cancelled"
        | "skipped"
        | "timed_out"
        | "action_required"
        | "stale"
        | null;
}

export interface CheckRunsResponse {
    total_count: number;
    check_runs: CheckRun[];
}

export interface PrDetailResponse {
    pull: GithubPullDetail;
    combined_status: CombinedStatus | null;
    check_runs: CheckRunsResponse | null;
}
