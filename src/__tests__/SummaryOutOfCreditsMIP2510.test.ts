/**
 * MIP-2510: at zero AI credits the thread and note summaries showed the server's English sentence in
 * every UI language. They now show the app's own, as the ask does.
 */
import { afterEach, describe, expect, it, vi } from "vitest";

import { getMessages } from "../i18n";
import { en } from "../i18n/locales/en";
import { ja } from "../i18n/locales/ja";
import { fetchNoteSummary, fetchThreadSummary } from "../services/agentApi";

const SERVER_WORDS = "You've used your 30 AI credits for this month (server words).";

const answer = (status: number, category: string) =>
    vi.stubGlobal(
        "fetch",
        vi.fn(
            async () => new Response(JSON.stringify({ error: SERVER_WORDS, category }), { status })
        )
    );

const summaries = {
    thread: () =>
        fetchThreadSummary({
            accessToken: "tok",
            teamId: "t",
            threadContext: { chatType: 2, chatId: "c", threadId: "m" },
        } as never),
    note: () =>
        fetchNoteSummary({
            accessToken: "tok",
            teamId: "t",
            noteContext: { noteType: "personal", noteId: 1 },
        } as never),
};

describe.each(Object.entries(summaries))("%s summary with no AI credits (MIP-2510)", (_, call) => {
    afterEach(() => vi.unstubAllGlobals());

    it("says it in our words", async () => {
        answer(429, "ai_credits");
        await expect(call()).rejects.toThrow(getMessages().services.agent.outOfCredits);
    });

    it("keeps the server's words for any other refusal", async () => {
        answer(429, "something_else");
        await expect(call()).rejects.toThrow(SERVER_WORDS);
        answer(403, "ai_credits");
        await expect(call()).rejects.toThrow(SERVER_WORDS);
    });
});

describe("the out-of-credits sentence", () => {
    it("is translated", () => {
        expect(ja.services?.agent?.outOfCredits).not.toBe(en.services.agent.outOfCredits);
    });
});
