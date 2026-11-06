import { beforeEach, describe, expect, it, vi } from "vitest";

import {
    getConsentContext,
    listMcpConnections,
    revokeMcpConnection,
    submitConsentDecision,
    updateMcpConnection,
} from "../services/mcpConnections";

const post = vi.fn();
const get = vi.fn();
const patch = vi.fn();
const del = vi.fn();

vi.mock("../services/api", () => ({
    authApi: (token: string | null) => (token ? { post, get, patch, delete: del } : null),
}));

const PARAMS = { client_id: "abc", resource: ["https://api.test/mcp"] };

beforeEach(() => {
    post.mockReset();
    get.mockReset();
    patch.mockReset();
    del.mockReset();
});

describe("consent calls", () => {
    it("posts the params to the context endpoint, quietly", async () => {
        post.mockResolvedValue({ data: { client: { name: "Claude" } } });
        const res = await getConsentContext("tok", PARAMS);
        expect(res.ok).toBe(true);
        expect(post).toHaveBeenCalledWith(
            "/mcp/oauth/consent/context/",
            { params: PARAMS },
            { suppressErrorToast: true }
        );
    });

    it("turns a 400 into a failure that carries the redirect only when given", async () => {
        post.mockRejectedValue({
            response: {
                status: 400,
                data: {
                    error: "invalid_scope",
                    error_description: "bad",
                    redirect_to: "https://a.test/cb?error=x",
                },
            },
        });
        const res = await getConsentContext("tok", PARAMS);
        expect(res).toEqual({
            ok: false,
            failure: {
                error: "invalid_scope",
                description: "bad",
                redirectTo: "https://a.test/cb?error=x",
                status: 400,
            },
        });
        post.mockRejectedValue({
            response: {
                status: 400,
                data: { error: "invalid_request", error_description: "x", redirect_to: null },
            },
        });
        const again = await getConsentContext("tok", PARAMS);
        expect(again.ok === false && again.failure.redirectTo).toBeNull();
    });

    it("survives a network error with no response", async () => {
        post.mockRejectedValue(new Error("offline"));
        const res = await getConsentContext("tok", PARAMS);
        expect(res.ok === false && res.failure.status).toBe(0);
    });

    it("never calls the API without a token", async () => {
        const res = await getConsentContext(null, PARAMS);
        expect(res.ok).toBe(false);
        expect(post).not.toHaveBeenCalled();
    });

    it("sends the decision in the API's shape", async () => {
        post.mockResolvedValue({ data: { redirect_to: "https://a.test/cb?code=1" } });
        const res = await submitConsentDecision("tok", PARAMS, {
            allow: true,
            scopes: ["mcp:read", "mcp:write"],
            teamIds: ["t1", "t2"],
            defaultTeamId: "t2",
        });
        expect(res).toEqual({ ok: true, redirectTo: "https://a.test/cb?code=1" });
        expect(post).toHaveBeenCalledWith(
            "/mcp/oauth/consent/decision/",
            {
                params: PARAMS,
                allow: true,
                scopes: ["mcp:read", "mcp:write"],
                team_ids: ["t1", "t2"],
                default_team_id: "t2",
            },
            { suppressErrorToast: true }
        );
    });

    it("a denial sends only the params and allow:false", async () => {
        post.mockResolvedValue({ data: { redirect_to: "https://a.test/cb?error=access_denied" } });
        await submitConsentDecision("tok", PARAMS, { allow: false });
        expect(post.mock.calls[0][1]).toEqual({ params: PARAMS, allow: false });
    });

    it("surfaces a plan refusal", async () => {
        post.mockRejectedValue({
            response: { status: 403, data: { error: "plan_required", error_description: "Pro" } },
        });
        const res = await submitConsentDecision("tok", PARAMS, {
            allow: true,
            scopes: ["mcp:read"],
            teamIds: ["t"],
            defaultTeamId: "t",
        });
        expect(res.ok === false && res.failure).toMatchObject({
            status: 403,
            error: "plan_required",
        });
    });
});

describe("connections", () => {
    it("lists active connections, or null when it cannot", async () => {
        get.mockResolvedValue({ data: { connections: [{ id: "c1" }] } });
        expect(await listMcpConnections("tok")).toEqual([{ id: "c1" }]);
        get.mockRejectedValue(new Error("x"));
        expect(await listMcpConnections("tok")).toBeNull();
    });

    it("patches only what changed, with the API's names", async () => {
        patch.mockResolvedValue({ data: { id: "c1" } });
        await updateMcpConnection("tok", "c1", { scopes: ["mcp:read"] });
        expect(patch).toHaveBeenLastCalledWith("/mcp/connections/c1/", { scopes: ["mcp:read"] });
        await updateMcpConnection("tok", "c1", { teamIds: ["t1"], defaultTeamId: "t1" });
        expect(patch).toHaveBeenLastCalledWith("/mcp/connections/c1/", {
            team_ids: ["t1"],
            default_team_id: "t1",
        });
    });

    it("returns null when an update fails", async () => {
        patch.mockRejectedValue(new Error("x"));
        expect(await updateMcpConnection("tok", "c1", { scopes: ["mcp:read"] })).toBeNull();
    });

    it("revokes with a delete", async () => {
        del.mockResolvedValue({});
        expect(await revokeMcpConnection("tok", "c1")).toBe(true);
        expect(del).toHaveBeenCalledWith("/mcp/connections/c1/");
        del.mockRejectedValue(new Error("x"));
        expect(await revokeMcpConnection("tok", "c1")).toBe(false);
    });
});
