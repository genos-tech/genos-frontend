import { describe, expect, it } from "vitest";

import type {
    CheckRun,
    CheckRunsResponse,
    CombinedStatus,
} from "../features/integrations/services/prTypes";
import { deriveCiState, derivePrState } from "../features/integrations/utils/prState";

const status = (state: CombinedStatus["state"], total_count: number): CombinedStatus => ({
    state,
    total_count,
});

const runs = (...check_runs: CheckRun[]): CheckRunsResponse => ({
    check_runs,
    total_count: check_runs.length,
});

const passed: CheckRun = { status: "completed", conclusion: "success" };
const failed: CheckRun = { status: "completed", conclusion: "failure" };
const running: CheckRun = { status: "in_progress", conclusion: null };

describe("deriveCiState — GitHub Actions repos", () => {
    // THE REPORTED BUG. GitHub's combined-status endpoint returns
    // `state: "pending"` when a commit has NO statuses at all — that's
    // documented behaviour, not an in-progress signal. An Actions-only
    // repo never posts legacy statuses, so the old code read that
    // permanent "pending" and pinned the badge to yellow no matter how
    // green the check runs were.
    it("reports passing when checks pass and there are zero legacy statuses", () => {
        expect(deriveCiState(status("pending", 0), runs(passed, passed))).toBe("passing");
    });

    it("reports failing when a check fails, ignoring the empty legacy status", () => {
        expect(deriveCiState(status("pending", 0), runs(passed, failed))).toBe("failing");
    });

    it("reports pending while a check is still running", () => {
        expect(deriveCiState(status("pending", 0), runs(passed, running))).toBe("pending");
    });

    it("treats a timed-out run as failing", () => {
        expect(
            deriveCiState(
                status("pending", 0),
                runs({ status: "completed", conclusion: "timed_out" })
            )
        ).toBe("failing");
    });

    it("does not fail the badge for skipped / neutral / cancelled runs", () => {
        // github.com doesn't turn the PR red for these, so neither do we.
        expect(
            deriveCiState(
                status("pending", 0),
                runs(
                    passed,
                    { status: "completed", conclusion: "skipped" },
                    { status: "completed", conclusion: "neutral" },
                    { status: "completed", conclusion: "cancelled" }
                )
            )
        ).toBe("passing");
    });
});

describe("deriveCiState — legacy commit-status repos", () => {
    it("trusts the combined state when statuses actually exist", () => {
        expect(deriveCiState(status("success", 3), runs())).toBe("passing");
        expect(deriveCiState(status("failure", 3), runs())).toBe("failing");
        expect(deriveCiState(status("error", 1), runs())).toBe("failing");
        expect(deriveCiState(status("pending", 2), runs())).toBe("pending");
    });

    it("lets a real pending status hold the badge even when checks passed", () => {
        // Both systems in play: the still-running legacy context wins.
        expect(deriveCiState(status("pending", 1), runs(passed))).toBe("pending");
    });

    it("lets a failing status win over passing checks", () => {
        expect(deriveCiState(status("failure", 1), runs(passed))).toBe("failing");
    });
});

describe("deriveCiState — nothing reported", () => {
    it("is 'none' when neither system has anything", () => {
        expect(deriveCiState(status("pending", 0), runs())).toBe("none");
        expect(deriveCiState(null, null)).toBe("none");
        expect(deriveCiState(status(null, 0), runs())).toBe("none");
    });

    it("is not 'none' as soon as one check exists", () => {
        expect(deriveCiState(null, runs(passed))).toBe("passing");
    });
});

describe("derivePrState", () => {
    const base = { merged: false, draft: false, state: "open" as const };
    it("ranks merged above draft and open", () => {
        expect(derivePrState({ ...base, merged: true, draft: true } as never)).toBe("merged");
    });
    it("reports draft, open and closed", () => {
        expect(derivePrState({ ...base, draft: true } as never)).toBe("draft");
        expect(derivePrState({ ...base } as never)).toBe("open");
        expect(derivePrState({ ...base, state: "closed" } as never)).toBe("closed");
    });
});
