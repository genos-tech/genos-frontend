/**
 * What `createApiKey` puts on the wire (MIP-723). The server takes
 * `allow_destructive` as a JSON bool on a write key only, and an
 * omitted field is the safe default — so the client sends it when asked
 * for, and otherwise not at all.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

import { authApi } from "../services/api";
import { createApiKey } from "../services/developerApi";

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
        expect(post).toHaveBeenCalledWith("/api-keys/", {
            name: "Ops",
            scope: "write",
            allow_destructive: true,
        });
        expect(res).toMatchObject({ status: "created", created: { allowDestructive: true } });
    });
});
