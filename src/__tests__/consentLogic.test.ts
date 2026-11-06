import { describe, expect, it } from "vitest";

import {
    addableTeams,
    addTeam,
    chooseScopes,
    removeTeam,
    scopeChoiceOf,
} from "../features/admin/consent/connectionEdit";
import {
    actionForFailure,
    chooseDefaultTeam,
    clientAddress,
    initialChoice,
    initialTeamIds,
    isSafeRedirect,
    normalizeChoice,
    paramsFromSearch,
    pickDefault,
    scopesFor,
    toggleTeam,
} from "../features/admin/consent/consentLogic";
import type { ConsentContext, ConsentError } from "../services/mcpConnections";

const QUERY =
    "?response_type=code&client_id=abc&redirect_uri=https%3A%2F%2Fclaude.ai%2Fcb&state=xyz" +
    "&scope=mcp%3Aread+mcp%3Awrite&code_challenge=E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM" +
    "&code_challenge_method=S256&resource=https%3A%2F%2Fapi.example.test%2Fmcp";

describe("paramsFromSearch", () => {
    it("keeps the parameters as strings and decodes them", () => {
        const p = paramsFromSearch(QUERY)!;
        expect(p.client_id).toBe("abc");
        expect(p.redirect_uri).toBe("https://claude.ai/cb");
        expect(p.scope).toBe("mcp:read mcp:write");
        expect(p.state).toBe("xyz");
    });

    it("makes resource a list, because it may repeat", () => {
        expect(paramsFromSearch(QUERY)!.resource).toEqual(["https://api.example.test/mcp"]);
        const twice = paramsFromSearch(QUERY + "&resource=https%3A%2F%2Fother.test%2Fmcp")!;
        expect(twice.resource).toEqual(["https://api.example.test/mcp", "https://other.test/mcp"]);
    });

    it("takes the first of any other repeated parameter, as a string", () => {
        const p = paramsFromSearch(QUERY + "&state=second")!;
        expect(p.state).toBe("xyz");
        expect(typeof p.state).toBe("string");
    });

    it("is null when what the authorize endpoint always sends is missing", () => {
        for (const missing of ["response_type", "client_id", "redirect_uri", "code_challenge"]) {
            const q = new URLSearchParams(QUERY);
            q.delete(missing);
            expect(paramsFromSearch(`?${q.toString()}`), missing).toBeNull();
        }
        expect(paramsFromSearch("")).toBeNull();
        expect(paramsFromSearch("?client_id=")).toBeNull();
    });
});

describe("isSafeRedirect", () => {
    it("allows https and loopback http", () => {
        for (const url of [
            "https://claude.ai/api/mcp/auth_callback?code=1&state=x",
            "http://localhost:3118/callback?code=1",
            "http://127.0.0.1:5000/cb",
            "http://[::1]:7777/cb",
        ]) {
            expect(isSafeRedirect(url), url).toBe(true);
        }
    });

    it("refuses anything that could run code or leave the web", () => {
        for (const url of [
            "javascript:alert(1)",
            "data:text/html,<script>1</script>",
            "http://evil.example/cb",
            "http://localhost.evil.example/cb",
            "claude://callback",
            "ftp://x.example/cb",
            "//evil.example/cb",
            "/relative",
            "",
            "not a url",
            null,
            undefined,
            5,
        ]) {
            expect(isSafeRedirect(url), String(url)).toBe(false);
        }
    });
});

describe("actionForFailure", () => {
    const failure = (redirectTo: string | null): ConsentError => ({
        error: "invalid_scope",
        description: "x",
        redirectTo,
        status: 400,
    });

    it("sends the browser back to the app only when the API vouched for the address", () => {
        expect(actionForFailure(failure("https://claude.ai/cb?error=invalid_scope"))).toEqual({
            kind: "navigate",
            url: "https://claude.ai/cb?error=invalid_scope",
        });
    });

    it("stays and shows the error when there is no trusted address", () => {
        expect(actionForFailure(failure(null))).toEqual({ kind: "show" });
    });

    it("stays even when the API's address is not one the page will go to", () => {
        expect(actionForFailure(failure("javascript:alert(1)"))).toEqual({ kind: "show" });
        expect(actionForFailure(failure("http://evil.example/x"))).toEqual({ kind: "show" });
    });
});

const TEAMS: ConsentContext["teams"] = [
    { id: "t1", name: "Alpha" },
    { id: "t2", name: "Beta" },
    { id: "t3", name: "Gamma" },
];

describe("team defaults", () => {
    it("prefers the team the member is working in, if offered", () => {
        expect(chooseDefaultTeam(TEAMS, "t2", null)).toBe("t2");
    });

    it("falls back to the first team when the current one is not offered or unknown", () => {
        expect(chooseDefaultTeam(TEAMS, "gone", null)).toBe("t1");
        expect(chooseDefaultTeam(TEAMS, null, null)).toBe("t1");
    });

    it("keeps an existing connection's default while it is still offered", () => {
        const existing = {
            active: true,
            scope: "read" as const,
            allowDestructive: false,
            defaultTeamId: "t3",
            teamIds: ["t3"],
        };
        expect(chooseDefaultTeam(TEAMS, "t2", existing)).toBe("t3");
        expect(chooseDefaultTeam(TEAMS, "t2", { ...existing, defaultTeamId: "gone" })).toBe("t2");
    });

    it("is empty when there are no teams", () => {
        expect(chooseDefaultTeam([], "t1", null)).toBe("");
        expect(initialTeamIds([], "", null)).toEqual([]);
    });

    it("starts with the default alone, never every team", () => {
        expect(initialTeamIds(TEAMS, "t2", null)).toEqual(["t2"]);
    });

    it("starts with an existing connection's teams that are still offered", () => {
        const existing = {
            active: true,
            scope: "write" as const,
            allowDestructive: false,
            defaultTeamId: "t1",
            teamIds: ["t1", "gone", "t3"],
        };
        expect(initialTeamIds(TEAMS, "t1", existing)).toEqual(["t1", "t3"]);
    });

    it("unticking the default hands it to the first team still ticked", () => {
        expect(toggleTeam(["t1", "t2"], "t1", "t1")).toEqual({
            teamIds: ["t2"],
            defaultTeamId: "t2",
        });
    });

    it("unticking another team leaves the default alone", () => {
        expect(toggleTeam(["t1", "t2"], "t1", "t2")).toEqual({
            teamIds: ["t1"],
            defaultTeamId: "t1",
        });
    });

    it("cannot untick the last team", () => {
        expect(toggleTeam(["t1"], "t1", "t1")).toEqual({ teamIds: ["t1"], defaultTeamId: "t1" });
    });

    it("ticking adds a team without moving the default", () => {
        expect(toggleTeam(["t1"], "t1", "t3")).toEqual({
            teamIds: ["t1", "t3"],
            defaultTeamId: "t1",
        });
    });

    it("making a team the default ticks it", () => {
        expect(pickDefault(["t1"], "t2")).toEqual({ teamIds: ["t1", "t2"], defaultTeamId: "t2" });
        expect(pickDefault(["t1", "t2"], "t2")).toEqual({
            teamIds: ["t1", "t2"],
            defaultTeamId: "t2",
        });
    });
});

describe("scope choices", () => {
    const ALL = ["mcp:read", "mcp:write", "mcp:destructive"] as const;

    it("deleting needs write", () => {
        expect(normalizeChoice({ write: false, destructive: true })).toEqual({
            write: false,
            destructive: false,
        });
        expect(normalizeChoice({ write: true, destructive: true })).toEqual({
            write: true,
            destructive: true,
        });
    });

    it("starts with write if asked for and deleting always off", () => {
        expect(initialChoice([...ALL], null)).toEqual({ write: true, destructive: false });
        expect(initialChoice(["mcp:read"], null)).toEqual({ write: false, destructive: false });
    });

    it("starts from an existing connection's own setting, within what is asked for", () => {
        const existing = {
            active: true,
            scope: "write" as const,
            allowDestructive: true,
            defaultTeamId: "t1",
            teamIds: ["t1"],
        };
        expect(initialChoice([...ALL], existing)).toEqual({ write: true, destructive: true });
        expect(initialChoice(["mcp:read", "mcp:write"], existing)).toEqual({
            write: true,
            destructive: false,
        });
        expect(initialChoice(["mcp:read"], existing)).toEqual({
            write: false,
            destructive: false,
        });
        // A revoked connection is not a setting to carry over.
        expect(initialChoice([...ALL], { ...existing, active: false })).toEqual({
            write: true,
            destructive: false,
        });
    });

    it("always sends read and never more than was asked for", () => {
        expect(scopesFor({ write: false, destructive: false }, [...ALL])).toEqual(["mcp:read"]);
        expect(scopesFor({ write: true, destructive: false }, [...ALL])).toEqual([
            "mcp:read",
            "mcp:write",
        ]);
        expect(scopesFor({ write: true, destructive: true }, [...ALL])).toEqual([
            "mcp:read",
            "mcp:write",
            "mcp:destructive",
        ]);
        expect(scopesFor({ write: true, destructive: true }, ["mcp:read"])).toEqual(["mcp:read"]);
        expect(scopesFor({ write: false, destructive: true }, [...ALL])).toEqual(["mcp:read"]);
    });
});

describe("editing a connected app", () => {
    it("reads a connection's scope as choices", () => {
        expect(scopeChoiceOf({ scope: "read", allowDestructive: true })).toEqual({
            write: false,
            destructive: false,
        });
        expect(scopeChoiceOf({ scope: "write", allowDestructive: true })).toEqual({
            write: true,
            destructive: true,
        });
    });

    it("sends read first and only what is chosen", () => {
        expect(chooseScopes({ write: false, destructive: true })).toEqual(["mcp:read"]);
        expect(chooseScopes({ write: true, destructive: false })).toEqual([
            "mcp:read",
            "mcp:write",
        ]);
        expect(chooseScopes({ write: true, destructive: true })).toEqual([
            "mcp:read",
            "mcp:write",
            "mcp:destructive",
        ]);
    });

    it("removing the default team hands the default to the first left", () => {
        const c = { teams: TEAMS, defaultTeamId: "t1" };
        expect(removeTeam(c, "t1")).toEqual({ teamIds: ["t2", "t3"], defaultTeamId: "t2" });
        expect(removeTeam(c, "t3")).toEqual({ teamIds: ["t1", "t2"], defaultTeamId: "t1" });
    });

    it("cannot remove the last team or one it does not have", () => {
        expect(removeTeam({ teams: [TEAMS[0]], defaultTeamId: "t1" }, "t1")).toBeNull();
        expect(removeTeam({ teams: TEAMS, defaultTeamId: "t1" }, "nope")).toBeNull();
    });

    it("adding a team keeps the ones it has and the default", () => {
        const c = { teams: TEAMS.slice(0, 2), defaultTeamId: "t2" };
        expect(addTeam(c, "t3")).toEqual({ teamIds: ["t1", "t2", "t3"], defaultTeamId: "t2" });
        expect(addTeam(c, "t1")).toBeNull();
    });

    it("offers only the member's teams the connection lacks", () => {
        expect(addableTeams({ teams: TEAMS.slice(0, 2) }, TEAMS)).toEqual([TEAMS[2]]);
        expect(addableTeams({ teams: TEAMS }, TEAMS)).toEqual([]);
        expect(addableTeams({ teams: [] }, [])).toEqual([]);
    });
});

describe("what the consent page may send", () => {
    it("is only ever a subset of what the context offered", () => {
        const offered = ["mcp:read", "mcp:write"] as const;
        // Every combination of choices, including a stale "deleting" tick.
        for (const write of [true, false]) {
            for (const destructive of [true, false]) {
                const sent = scopesFor({ write, destructive }, [...offered]);
                expect(sent.every((s) => (offered as readonly string[]).includes(s))).toBe(true);
                expect(sent).toContain("mcp:read");
                expect(sent).not.toContain("mcp:destructive");
            }
        }
        expect(scopesFor({ write: true, destructive: true }, ["mcp:read"])).toEqual(["mcp:read"]);
    });
});

describe("clientAddress", () => {
    it("is the full address for a metadata document", () => {
        expect(
            clientAddress({
                kind: "metadata_document",
                host: "a.pages.dev",
                url: "https://a.pages.dev/x/c.json",
            })
        ).toBe("https://a.pages.dev/x/c.json");
    });

    it("falls back to the host when there is no address, and is empty for a registered app", () => {
        expect(clientAddress({ kind: "metadata_document", host: "a.pages.dev" })).toBe(
            "a.pages.dev"
        );
        expect(clientAddress({ kind: "registered", host: "", url: "" })).toBe("");
        expect(
            clientAddress({ kind: "registered", host: "x.test", url: "https://x.test/y" })
        ).toBe("");
    });
});
