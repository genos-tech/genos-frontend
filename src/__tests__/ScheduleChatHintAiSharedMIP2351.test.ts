/**
 * The hint under the chat picker (MIP-2351): an AI report may now be posted in a chat other
 * people read, so it must neither say "no AI" nor say the cost is in the message. The cost is
 * shown only to the owner. A skill run stays limited to a chat the member is in alone.
 */
import { describe, expect, it } from "vitest";

import { chatHintKey } from "../features/schedules/scheduleEffort";
import { settings as enSettings } from "../i18n/locales/en/settings";
import type { ScheduleJob } from "../services/schedules";

const job = (over: Partial<ScheduleJob>): ScheduleJob =>
    ({ job: "x", title: "X", description: "", params: {}, ...over }) as ScheduleJob;

const projectUpdates = job({
    job: "project_updates",
    usesAi: true,
    params: { project_id: { type: "integer" }, ai_sentences: { type: "boolean" } },
});

describe("chatHintKey", () => {
    it("keeps the plain sentence for a report with no AI, or with its AI step off", () => {
        expect(chatHintKey(job({ job: "what_you_did" }), {})).toBe("deliverChatHint");
        expect(chatHintKey(projectUpdates, { ai_sentences: "false" })).toBe("deliverChatHint");
        expect(chatHintKey(projectUpdates, {})).toBe("deliverChatHint");
    });

    it("says the cost stays private for a report with its AI step on", () => {
        expect(chatHintKey(projectUpdates, { ai_sentences: "true" })).toBe(
            "deliverChatHintAiShared"
        );
    });

    it("keeps the only-you sentence for a skill run", () => {
        const skill = job({ job: "run_skill", usesAi: true });
        expect(chatHintKey(skill, {})).toBe("deliverChatHintAi");
    });

    it("never says no AI or that the cost is in the message, in either AI sentence", () => {
        for (const text of [
            enSettings.schedules.deliverChatHintAi,
            enSettings.schedules.deliverChatHintAiShared,
        ]) {
            expect(text).not.toMatch(/no AI/i);
            expect(text).not.toMatch(/in the message/i);
            expect(text).toMatch(/only to you/);
        }
    });
});
