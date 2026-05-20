// Matches the canonical GitHub PR URL: https://github.com/<owner>/<repo>/pull/<number>
// Used both for live validation in the task-edit form and for resolving
// the stored URL into API path segments at view time. Same shape as the
// backend regex in `TaskMasterSerializer.validate_linked_pr_url`.
const PR_URL_RE = /^https:\/\/github\.com\/([^/]+)\/([^/]+)\/pull\/(\d+)\/?$/;

export interface PrRef {
    owner: string;
    repo: string;
    number: number;
}

export const parsePrUrl = (url: string | null | undefined): PrRef | null => {
    if (!url) return null;
    const m = url.match(PR_URL_RE);
    if (!m) return null;
    return { owner: m[1], repo: m[2], number: Number(m[3]) };
};
