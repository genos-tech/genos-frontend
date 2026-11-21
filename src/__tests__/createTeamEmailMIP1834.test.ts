import { beforeEach, describe, expect, it, vi } from "vitest";

import { createTeam } from "../features/admin/services/createTeam";
import { teamEmailFor } from "../features/admin/services/teamEmail";
import { authApi } from "../services/api";

// MIP-1834: `team_email` was built as `${teamName}@genos.tech` (now teams.genosai.dev, MIP-1912), so any name with a space,
// a Japanese character or a symbol produced an address the API refuses (400 "Enter a valid
// email address."), and the UI then blamed the team name.

vi.mock("../services/api", () => ({
    authApi: vi.fn(),
    nonAuthApi: vi.fn(),
}));

// What the API accepts as an address for a team: an ASCII local part of sane length on the
// teams.genosai.dev domain (a subdomain Genos owns, with no mailbox; MIP-1912).
const VALID_TEAM_EMAIL = /^[a-z0-9]+(?:-[a-z0-9]+)*@teams\.genosai\.dev$/;

const NAMES = [
    "Docs Walk Lab",
    "営業部",
    "Team 🚀 Rocket",
    "  Leading and trailing  ",
    "Acme",
    "acme",
    "A&B / C+D (2026)!",
    "X".repeat(80),
    "Ünïcödé Café",
    "!!!",
    "日本語 and English",
];

describe("teamEmailFor (MIP-1834)", () => {
    it.each(NAMES)("builds a valid team address for %j", (name) => {
        const email = teamEmailFor(name);
        expect(email).toMatch(VALID_TEAM_EMAIL);
        expect(email.length).toBeLessThanOrEqual(254);
        // The local part (before @) stays within RFC 5321's 64 characters.
        expect(email.split("@")[0].length).toBeLessThanOrEqual(64);
    });

    it("keeps the readable slug of an ASCII name", () => {
        expect(teamEmailFor("Docs Walk Lab")).toMatch(
            /^docs-walk-lab-[a-z0-9]{6}@teams\.genosai\.dev$/
        );
    });

    it("falls back to a fixed word when the name has no ASCII letters or digits", () => {
        expect(teamEmailFor("営業部")).toMatch(/^team-[a-z0-9]{6}@teams\.genosai\.dev$/);
        expect(teamEmailFor("!!!")).toMatch(/^team-[a-z0-9]{6}@teams\.genosai\.dev$/);
    });

    it("gives two names with the same slug different addresses", () => {
        // "Acme" and "acme" are different team names (the name is unique, case-sensitively),
        // so the suffix must keep their addresses apart.
        const a = teamEmailFor("Acme");
        const b = teamEmailFor("acme");
        expect(a).not.toBe(b);
    });

    it("never contains the characters the API refused", () => {
        for (const name of NAMES) {
            const localPart = teamEmailFor(name).split("@")[0];
            expect(localPart).not.toMatch(/[^a-z0-9-]/);
        }
    });
});

describe("createTeam sends a valid team_email (MIP-1834)", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it.each(NAMES)("posts the name %j with a valid team_email", async (name) => {
        const mockPost = vi.fn().mockResolvedValue({ data: { teamDetails: {} } });
        vi.mocked(authApi).mockReturnValue({ post: mockPost } as never);

        await createTeam("token", name, "user1");

        const body = mockPost.mock.calls[0][1];
        expect(body.team_name).toBe(name);
        expect(body.team_email).toMatch(VALID_TEAM_EMAIL);
    });
});
