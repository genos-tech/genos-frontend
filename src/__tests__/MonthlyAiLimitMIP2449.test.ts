/**
 * MIP-2449: a reached monthly AI limit answered with the server's English sentence in every UI
 * language. The app now shows its own, for the ask and for the two summaries.
 */
import { afterEach, describe, expect, it, vi } from "vitest";

import { costText } from "../features/inbox/components/aiUsageFooterHelpers";
import { GENOS_REPORT_ITEM_TYPE } from "../features/inbox/utils/genosReport";
import { readAiUsage } from "../features/inbox/utils/inboxAi";
import { getMessages } from "../i18n";
import { en } from "../i18n/locales/en";
import { ja } from "../i18n/locales/ja";
import {
    askAgentStream,
    fetchNoteSummary,
    fetchThreadSummary,
    isOutOfCreditsError,
} from "../services/agentApi";

const answer = () =>
    vi.stubGlobal(
        "fetch",
        vi.fn(
            async () =>
                new Response(
                    JSON.stringify({
                        error: "Genos AI has reached its monthly limit (server words).",
                        limit_reached: true,
                        category: "ai_monthly_limit",
                    }),
                    { status: 429 }
                )
        )
    );

describe("a reached monthly AI limit (MIP-2449)", () => {
    afterEach(() => vi.unstubAllGlobals());

    it("ends an ask in our sentence, with nothing to buy", async () => {
        answer();
        const onError = vi.fn();
        await askAgentStream({
            query: "q",
            teamId: "team-1",
            accessToken: "tok",
            onError,
            onDone: vi.fn(),
            onDelta: vi.fn(),
            onToolStart: vi.fn(),
            onToolResult: vi.fn(),
            onSources: vi.fn(),
        } as never);

        expect(onError).toHaveBeenCalledWith(getMessages().services.agent.monthlyLimit);
        // The buy / upgrade buttons hang off the out-of-credits sentence only.
        expect(isOutOfCreditsError(onError.mock.calls[0][0])).toBe(false);
    });

    it("says it for a thread summary and a note summary too", async () => {
        const ours = getMessages().services.agent.monthlyLimit;
        answer();
        await expect(
            fetchThreadSummary({
                accessToken: "tok",
                teamId: "t",
                threadContext: { chatType: 2, chatId: "c", threadId: "m" },
            } as never)
        ).rejects.toThrow(ours);
        answer();
        await expect(
            fetchNoteSummary({
                accessToken: "tok",
                teamId: "t",
                noteContext: { noteType: "personal", noteId: 1 },
            } as never)
        ).rejects.toThrow(ours);
    });

    it("has the sentence in the UI language", () => {
        expect(ja.services?.agent?.monthlyLimit).not.toBe(en.services.agent.monthlyLimit);
    });

    it("is what an Inbox report card says when its AI part was skipped for it", () => {
        const usage = readAiUsage({
            itemType: GENOS_REPORT_ITEM_TYPE,
            itemOptionals: {},
            aiSource: {
                kind: "schedule",
                enabled: true,
                schedule_id: "s",
                label: "Morning",
                used_ai: false,
                ai_skipped: "monthly_limit",
            },
        } as never);
        const copy = en.inbox.aiUsage;
        expect(usage?.source?.monthlyLimit).toBe(true);
        expect(usage?.source?.noCredits).toBe(false);
        expect(costText(null, copy, false, true)).toBe(copy.noAiMonthlyLimit);
        expect(costText(null, copy, true)).toBe(copy.noAiNoCredits);
    });
});
