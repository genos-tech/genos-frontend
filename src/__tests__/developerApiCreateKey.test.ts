/**
 * What `createApiKey` puts on the wire (MIP-723). The server takes
 * `allow_destructive` as a JSON bool on a write key only, and an
 * omitted field is the safe default — so the client sends it when asked
 * for, and otherwise not at all.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

import { authApi } from "../services/api";
import { createApiKey, createWebhook } from "../services/developerApi";

vi.mock("../services/api", () => ({
    authApi: vi.fn(),
    nonAuthApi: vi.fn(),
}));

const post = vi.fn();

beforeEach(() => {
    post.mockReset().mockResolvedValue({
        data: { key: "gnos_X", id: "k1", allowDestructive: true },
    });
    (authApi as ReturnType<typeof vi.fn>).mockReturnValue({ post });
});

describe("createApiKey", () => {
    it("leaves the opt-in off the wire unless asked for", async () => {
        await createApiKey("tok", { name: "CI", scope: "write", expiresInDays: 90 });
        await createApiKey("tok", { name: "CI", scope: "write", allowDestructive: false });
        for (const [, body] of post.mock.calls) {
            expect(body).not.toHaveProperty("allow_destructive");
        }
    });

    it("sends it as a JSON true when asked for", async () => {
        const res = await createApiKey("tok", {
            name: "Ops",
            scope: "write",
            allowDestructive: true,
        });
        expect(post).toHaveBeenCalledWith(
            "/api-keys/",
            { name: "Ops", scope: "write", allow_destructive: true },
            // The first try may be refused with "enter your password" (MIP-2240): no toast.
            { suppressErrorToast: true }
        );
        expect(res).toMatchObject({ status: "created", created: { allowDestructive: true } });
    });
});

describe("createWebhook plan limit (MIP-1960)", () => {
    const refuse = (status: number, data: object) =>
        post.mockRejectedValueOnce({ response: { status, data } });
    const INPUT = { teamId: "t1", url: "https://x.example/h", events: ["task.created"] };

    it("a 429 plan_limit carries the numbers, not the manager 403", async () => {
        refuse(429, { error: "x", code: "plan_limit", limit: 3, used: 3 });
        expect(await createWebhook("tok", INPUT)).toEqual({ status: "limit", limit: 3, used: 3 });
    });

    it("a 403 is still the manager refusal, and a 429 without the code is a plain failure", async () => {
        refuse(403, { error: "Only the team owner or an editor can manage webhooks." });
        expect(await createWebhook("tok", INPUT)).toEqual({ status: "forbidden" });
        refuse(429, { error: "slow down" });
        expect(await createWebhook("tok", INPUT)).toEqual({ status: "error" });
    });
});
