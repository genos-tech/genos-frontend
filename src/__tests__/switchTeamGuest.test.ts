/**
 * Switching into a team you are not a member of.
 *
 * Cross-team sharing put host teams in the team list: an external
 * participant sees the team that shared a chat, project or note folder with
 * them, and switches into it to reach that object. The switch itself was
 * written when every listed team was one you belonged to, so it ended with a
 * `/team/join/` call — the way a switch re-affirms a membership row and picks
 * up the Genos Guide notes.
 *
 * A guest has no membership row to re-affirm, and the endpoint says so (403).
 * Nothing breaks, but "arriving in a host team's context" must not look like
 * "joining it", so the call is skipped.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

import { joinTeam } from "../features/admin/services/joinTeam";
import { switchTeam } from "../features/admin/services/switchTeam";
import type { UserProps } from "../types/admin";

vi.mock("../features/admin/services/joinTeam", () => ({
    joinTeam: vi.fn(() => Promise.resolve({})),
}));

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
    teamId: "t-host",
    teamName: "Host",
};

describe("switchTeam", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        localStorage.clear();
    });

    it("re-affirms membership when switching into your own team", () => {
        switchTeam(args);
        expect(joinTeam).toHaveBeenCalledWith("token", "t-host", "u-1");
    });

    it("does not try to join a team you are only a guest of", () => {
        switchTeam({ ...args, isGuest: true });
        expect(joinTeam).not.toHaveBeenCalled();
    });

    it("still makes the guest team active, and forgets the old project", () => {
        localStorage.setItem("lastProjectId", "42");
        switchTeam({ ...args, isGuest: true });
        expect(localStorage.getItem("teamId")).toBe("t-host");
        expect(localStorage.getItem("lastProjectId")).toBeNull();
        expect(setMyself).toHaveBeenCalled();
    });
});
