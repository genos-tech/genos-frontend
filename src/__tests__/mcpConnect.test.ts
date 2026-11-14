/**
 * The address people paste into Claude / ChatGPT (MIP: Connect an AI app).
 *
 * It is the API origin + `/api/public/v1/mcp`, typed EXACTLY: it is also the `resource`
 * the token is issued for, so a trailing slash, a query string (`?team_id=` is the
 * API-key form: with OAuth the team is picked on the consent page) or the wrong origin
 * all end in "signed in, but Genos refused the request".
 */
import { describe, expect, it } from "vitest";

import { claudeCodeAddCommand, MCP_PATH, mcpServerUrl } from "../utils/mcpConnect";

describe("mcpServerUrl", () => {
    it("is the origin plus the MCP path, exactly", () => {
        expect(mcpServerUrl("https://api.example.test")).toBe(
            "https://api.example.test/api/public/v1/mcp"
        );
        expect(MCP_PATH).toBe("/api/public/v1/mcp");
    });

    it.each([
        "https://api.example.test/",
        "https://api.example.test//",
        " https://api.example.test/ ",
    ])("never doubles or keeps a trailing slash on the origin: %j", (origin) => {
        expect(mcpServerUrl(origin)).toBe("https://api.example.test/api/public/v1/mcp");
    });

    it.each([
        "https://api.example.test",
        "https://api.example.test/",
        "https://api.example.test?team_id=abc",
        "https://api.example.test/?team_id=abc#frag",
        "http://localhost:8890",
    ])("has no trailing slash and no query string or fragment: %s", (origin) => {
        const url = mcpServerUrl(origin);
        expect(url.endsWith("/")).toBe(false);
        const parsed = new URL(url);
        expect(parsed.search).toBe("");
        expect(parsed.hash).toBe("");
        expect(parsed.pathname).toBe("/api/public/v1/mcp");
    });

    it("keeps a port, and the host it was given (never the production one)", () => {
        expect(mcpServerUrl("http://localhost:8890")).toBe(
            "http://localhost:8890/api/public/v1/mcp"
        );
        expect(mcpServerUrl("https://api.example.test")).not.toContain("genosai.dev");
    });

    it.each([undefined, null, "", "   "])("gives nothing for an unknown origin: %j", (origin) => {
        // The caller hides the address: a relative one would be pasted into an app and fail.
        expect(mcpServerUrl(origin)).toBe("");
    });
});

describe("claudeCodeAddCommand", () => {
    it("is the OAuth form: http transport, the address, and no key header", () => {
        const url = mcpServerUrl("https://api.example.test");
        const cmd = claudeCodeAddCommand(url);
        expect(cmd).toBe(
            "claude mcp add --transport http genos https://api.example.test/api/public/v1/mcp"
        );
        expect(cmd).not.toMatch(/--header|ApiKey|team_id/);
    });
});
