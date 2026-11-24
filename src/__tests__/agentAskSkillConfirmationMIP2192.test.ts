/**
 * The ask's 409 `skill_needs_confirmation` (MIP-2192): not an error, a question. It is handed to
 * `onSkillNeedsConfirmation` and the turn ends quietly; every other status behaves exactly as it
 * did. Streamed through the real `askAgentStream` / `runNdjsonStream` path.
 */

import { afterEach, describe, expect, it, vi } from "vitest";

import { askAgentStream } from "../services/agentApi";

const handlers = () => ({
    onSources: vi.fn(),
    onDelta: vi.fn(),
    onDone: vi.fn(),
    onError: vi.fn(),
    onSkillNeedsConfirmation: vi.fn(),
});

const answer = (status: number, body: unknown): Response =>
    ({
        ok: false,
        status,
        json: async () => body,
        text: async () => JSON.stringify(body),
    }) as unknown as Response;

const ask = async (res: Response, h = handlers()) => {
    vi.stubGlobal(
        "fetch",
        vi.fn(async () => res)
    );
    await askAgentStream({ query: "/weekly", teamId: "team-1", accessToken: "tok", ...h });
    return h;
};

const NEEDS = {
    error: "Confirm this skill before you run it.",
    code: "skill_needs_confirmation",
    skillId: "s1",
    versionNo: 4,
    outside: true,
    harmful: false,
};

afterEach(() => vi.unstubAllGlobals());

describe("409 skill_needs_confirmation", () => {
    it("goes to the handler with the skill and why, and is not an error", async () => {
        const h = await ask(answer(409, NEEDS));
        expect(h.onSkillNeedsConfirmation).toHaveBeenCalledTimes(1);
        expect(h.onSkillNeedsConfirmation).toHaveBeenCalledWith({
            skillId: "s1",
            versionNo: 4,
            outside: true,
            harmful: false,
            message: "Confirm this skill before you run it.",
        });
        expect(h.onError).not.toHaveBeenCalled();
        expect(h.onDone).not.toHaveBeenCalled();
    });

    it("reads harmful from a copy of a removed skill", async () => {
        const h = await ask(answer(409, { ...NEEDS, outside: false, harmful: true }));
        expect(h.onSkillNeedsConfirmation).toHaveBeenCalledWith(
            expect.objectContaining({ outside: false, harmful: true })
        );
    });

    it("is an ordinary error when nobody handles it", async () => {
        const h = handlers();
        vi.stubGlobal(
            "fetch",
            vi.fn(async () => answer(409, NEEDS))
        );
        await askAgentStream({
            query: "q",
            teamId: "team-1",
            accessToken: "tok",
            onSources: h.onSources,
            onDelta: h.onDelta,
            onDone: h.onDone,
            onError: h.onError,
        });
        expect(h.onError).toHaveBeenCalledWith("Confirm this skill before you run it.");
    });

    it("is an error when the body cannot name a skill version", async () => {
        for (const bad of [
            { ...NEEDS, skillId: "" },
            { ...NEEDS, skillId: 7 },
            { ...NEEDS, versionNo: "4" },
            { ...NEEDS, versionNo: -1 },
        ]) {
            const h = await ask(answer(409, bad));
            expect(h.onSkillNeedsConfirmation).not.toHaveBeenCalled();
            expect(h.onError).toHaveBeenCalledTimes(1);
        }
    });
});

describe("every other refusal is unchanged", () => {
    it("a 409 with another code is an error with the server's sentence", async () => {
        const h = await ask(
            answer(409, { error: "A conversation is still answering.", code: "run_in_flight" })
        );
        expect(h.onSkillNeedsConfirmation).not.toHaveBeenCalled();
        expect(h.onError).toHaveBeenCalledWith("A conversation is still answering.");
    });

    it("the same body on another status is an error too", async () => {
        for (const status of [400, 403, 404, 429, 500]) {
            const h = await ask(answer(status, NEEDS));
            expect(h.onSkillNeedsConfirmation).not.toHaveBeenCalled();
            expect(h.onError).toHaveBeenCalledTimes(1);
        }
    });

    it("a 500 with no JSON keeps its own message path", async () => {
        const res = {
            ok: false,
            status: 500,
            json: async () => {
                throw new Error("not json");
            },
            text: async () => "boom",
        } as unknown as Response;
        const h = await ask(res);
        expect(h.onError).toHaveBeenCalledWith("boom");
        expect(h.onSkillNeedsConfirmation).not.toHaveBeenCalled();
    });
});
