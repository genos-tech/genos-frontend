/**
 * Only teams you are a member of belong in a team picker.
 *
 * Cross-team sharing put host teams in `getMyTeams`: when another
 * organization shares a chat, project or note folder with us, their team
 * comes back as a shell flagged `isGuest`. Those shells used to be
 * switchable, which was always a dead end — the shared objects surface in
 * the user's own team, so entering the shell shows nothing new while
 * hiding half the affordances the team page normally has.
 *
 * So the shells are filtered out before any picker sees them, and
 * `switchTeam` is back to a single case: a team you belong to, whose
 * membership row the switch re-affirms.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

import { joinTeam } from "../features/admin/services/joinTeam";
import { membershipTeams } from "../features/admin/services/loadMyTeams";
import { switchTeam } from "../features/admin/services/switchTeam";
import type { Team, UserProps } from "../types/admin";

vi.mock("../features/admin/services/joinTeam", () => ({
    joinTeam: vi.fn(() => Promise.resolve({})),
}));

const team = (teamId: string, isGuest?: boolean): Team => ({
    teamId,
    teamName: teamId,
    teamEmail: `${teamId}@example.com`,
    teamOwnerId: "owner",
    isGuest,
});

const myself: UserProps = {
    userId: "u-1",
    userName: "Ada",
    userEmail: "ada@example.com",
    teamId: "t-mine",
    teamName: "Mine",
    tsLastSeen: "",
    tsJoined: "",
    isOfflineForced: false,
    role: "member",
    baseCountry: "JP",
    customStatus: "",
    avatarImgPath: "",
} as unknown as UserProps;

const setMyself = vi.fn();

// A local store rather than the environment's: `globalThis.localStorage` is
// absent under some Node/jsdom combinations, and this test is about the join
// call, not about which storage implementation ran.
const store = new Map<string, string>();
vi.stubGlobal("localStorage", {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
    clear: () => store.clear(),
});

const args = {
    accessToken: "token",
    myself,
    setMyself,
    teamId: "t-other",
    teamName: "Other",
};

describe("membershipTeams", () => {
    it("drops host teams the user only reaches through a share", () => {
        const filtered = membershipTeams([team("t-mine"), team("t-host", true), team("t-other")]);
        expect(filtered.map((t) => t.teamId)).toEqual(["t-mine", "t-other"]);
    });

    it("treats a missing isGuest as a membership", () => {
        expect(membershipTeams([team("t-mine")])).toHaveLength(1);
    });

    it("survives a failed load", () => {
        expect(membershipTeams(undefined)).toEqual([]);
    });
});

describe("switchTeam", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        localStorage.clear();
    });

    it("re-affirms the membership row", () => {
        switchTeam(args);
        expect(joinTeam).toHaveBeenCalledWith("token", "t-other", "u-1");
    });

    it("makes the team active, and forgets the old project", () => {
        localStorage.setItem("lastProjectId", "42");
        switchTeam(args);
        expect(localStorage.getItem("teamId")).toBe("t-other");
        expect(localStorage.getItem("lastProjectId")).toBeNull();
        expect(setMyself).toHaveBeenCalled();
    });
});
