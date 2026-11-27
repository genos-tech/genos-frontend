/**
 * The "by Genos AI" hint and the effort hint say what THIS job's AI step does (MIP-2436): only
 * "What to do today" writes a sentence under a task; the others write a summary of the report,
 * and their cost estimate is for that.
 */
import { describe, expect, it } from "vitest";

import { effortHintKey, modeAiHintKey } from "../features/schedules/scheduleEffort";

describe("schedule AI hints by job", () => {
    it("keeps the sentence-under-a-task wording for What to do today", () => {
        expect(modeAiHintKey("what_to_do_today")).toBe("scheduleModeAiHint");
        expect(effortHintKey("what_to_do_today", true)).toBe("effortHint");
    });

    it.each([
        "ai_dashboard",
        "project_updates",
        "milestone_updates",
        "team_activity",
        "what_is_left",
    ])("describes a summary for %s", (job) => {
        expect(modeAiHintKey(job)).toBe("scheduleModeAiSummaryHint");
        expect(effortHintKey(job, true)).toBe("effortHintSummary");
    });

    it("claims no estimate where there is none", () => {
        expect(effortHintKey("run_skill", false)).toBe("effortHintNoEstimate");
        expect(effortHintKey("ai_dashboard", false)).toBe("effortHintNoEstimate");
    });
});
