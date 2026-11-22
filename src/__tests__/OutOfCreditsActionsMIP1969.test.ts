import { afterEach, describe, expect, it, vi } from "vitest";

import { getMessages } from "../i18n";
import { askAgentStream, isOutOfCreditsError } from "../services/agentApi";

describe("MIP-1969: the AI credit gate ends the turn in our sentence with next steps", () => {
    afterEach(() => vi.unstubAllGlobals());

    it("maps a 429 ai_credits answer to the localized sentence the turn recognises", async () => {
        const body = JSON.stringify({
            error: "You've used your AI credits.",
            limit_reached: true,
            category: "ai_credits",
        });
        vi.stubGlobal(
            "fetch",
            vi.fn(async () => new Response(body, { status: 429 }))
        );
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
        expect(onError).toHaveBeenCalledWith(getMessages().services.agent.outOfCredits);
        expect(isOutOfCreditsError(onError.mock.calls[0][0])).toBe(true);
    });

    it("does not treat other errors as out of credits", () => {
        expect(isOutOfCreditsError("Server returned 500")).toBe(false);
        expect(isOutOfCreditsError(null)).toBe(false);
    });
});
