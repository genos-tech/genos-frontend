/**
 * MIP-2090: the connect call names the active team, and the App flow's refusals at `initiate`
 * (`{detail: "<reason>"}`) each say what to do. The credentials part of the same call is
 * OAuthConnectCredentialsMIP2170.test.ts; this file only adds the team and the messages.
 */
import axios from "axios";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { activeTeamId } from "../features/integrations/services/activeTeam";
import { listConnections } from "../features/integrations/services/connections";
import { redirectToOAuthConnect } from "../features/integrations/services/oauth";
import { authApi } from "../services/api";

vi.mock("../services/api", () => ({ authApi: vi.fn() }));

const post = vi.fn();
const get = vi.fn();

const refusal = (status: number, detail: string) =>
    Object.assign(new axios.AxiosError("refused"), {
        response: { status, data: { detail } },
    });

beforeEach(() => {
    post.mockReset();
    get.mockReset();
    localStorage.clear();
    vi.mocked(authApi).mockReturnValue({ post, get } as unknown as ReturnType<typeof authApi>);
    vi.spyOn(console, "error").mockImplementation(() => {});
    Object.defineProperty(window, "location", {
        value: { href: "http://localhost/" },
        writable: true,
    });
});

describe("the active team", () => {
    it("is read from localStorage, null when absent", () => {
        expect(activeTeamId()).toBeNull();
        localStorage.setItem("teamId", "team-9");
        expect(activeTeamId()).toBe("team-9");
    });
});

describe("redirectToOAuthConnect sends team_id", () => {
    it("GitHub: the active team goes in the body, with credentials", async () => {
        localStorage.setItem("teamId", "team-9");
        post.mockResolvedValue({ data: { url: "https://github.com/apps/x/installations/new" } });
        expect(await redirectToOAuthConnect("github", "tok")).toBe(true);
        expect(post).toHaveBeenCalledWith(
            "/oauth/github/initiate/",
            { intent: "connect", next: "/workspace/integrations", team_id: "team-9" },
            { withCredentials: true }
        );
    });

    it("GitHub without a stored team: no team_id (the server takes the only team)", async () => {
        post.mockResolvedValue({ data: { url: "https://github.com/x" } });
        await redirectToOAuthConnect("github", "tok");
        expect(post.mock.calls[0][1]).toEqual({
            intent: "connect",
            next: "/workspace/integrations",
        });
    });

    it("Google never carries a team", async () => {
        localStorage.setItem("teamId", "team-9");
        post.mockResolvedValue({ data: { url: "https://accounts.google.com/x" } });
        await redirectToOAuthConnect("google", "tok");
        expect(post.mock.calls[0][1]).not.toHaveProperty("team_id");
    });
});

describe("the App flow's refusals at initiate", () => {
    it.each([
        ["team_required", 400, /Pick a team first/],
        ["team_not_found", 404, /team could not be found/],
        ["team_not_allowed", 403, /Only a team owner or editor/],
    ])("%s says what to do", async (detail, status, message) => {
        post.mockRejectedValue(refusal(status, detail));
        const shown = vi.fn();
        expect(await redirectToOAuthConnect("github", "tok", undefined, shown)).toBe(false);
        expect(shown).toHaveBeenCalledTimes(1);
        expect(shown.mock.calls[0][0]).toMatch(message);
    });

    it("any other failure stays the generic one", async () => {
        post.mockRejectedValue(refusal(500, "boom"));
        const shown = vi.fn();
        await redirectToOAuthConnect("github", "tok", undefined, shown);
        expect(shown.mock.calls[0][0]).toMatch(/Could not start the connect flow/);
    });

    it("a Google refusal is never read as a team message", async () => {
        post.mockRejectedValue(refusal(403, "team_not_allowed"));
        const shown = vi.fn();
        await redirectToOAuthConnect("google", "tok", undefined, shown);
        expect(shown.mock.calls[0][0]).toMatch(/Could not start the connect flow/);
    });
});

describe("listConnections asks about the active team", () => {
    it("sends team_id as a query parameter", async () => {
        localStorage.setItem("teamId", "team-9");
        get.mockResolvedValue({ data: { primary_auth_provider: "email", connections: [] } });
        await listConnections("tok");
        expect(get).toHaveBeenCalledWith("/integrations/me/", { params: { team_id: "team-9" } });
    });

    it("sends nothing extra without a stored team", async () => {
        get.mockResolvedValue({ data: { primary_auth_provider: "email", connections: [] } });
        await listConnections("tok");
        expect(get).toHaveBeenCalledWith("/integrations/me/", undefined);
    });
});
