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
    user?: { login: string; avatar_url?: string };
    head: { sha: string; ref?: string };
    base: { ref?: string; repo: { full_name: string } };
    // Stats are present on the GET /pulls/{n} response (not on the
    // list endpoint). Optional so we don't crash on partial fixtures.
    additions?: number;
    deletions?: number;
    changed_files?: number;
    comments?: number;
    review_comments?: number;
    commits?: number;
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
