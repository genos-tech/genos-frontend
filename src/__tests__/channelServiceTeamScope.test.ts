/**
 * Switching teams must not leave the previous team's chats on screen.
 *
 * Reported behaviour: sign in to team A, switch to team B, team A's
 * chats are still listed. Three separate things had to be true for that,
 * and fixing any one alone is not enough:
 *
 *  1. `GET /api/v3/channels/` returns EVERY team the caller belongs to
 *     unless narrowed, and the sidebar sent no `team_id`. So even a
 *     perfectly wiped cache refilled with both teams on the next
 *     refresh. This is the decisive one.
 *  2. `DatabaseUtils.clearTeamScopedStores()` — whose own comments say
 *     three times that it exists for team switching — empties the
 *     PERSISTED cache. `channelService`'s maps are process state and
 *     survived it, so the sidebar rendered team A from memory.
 *  3. The v3 socket's `query.teamId` was read once at mount from
 *     localStorage and the effect didn't depend on the team, so the
 *     connection stayed in the previous team's broadcast room.
 *
 * These tests cover 1 and 2 at the service boundary; 3 is covered in
 * `useChannelServiceBootstrap.test.ts`.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

import { channelService } from "../services/channel/channelService";

const get = vi.fn();

vi.mock("axios", () => ({
    default: {
        create: () => ({ get, post: vi.fn(), patch: vi.fn(), delete: vi.fn() }),
        isAxiosError: () => false,
    },
}));

// The service touches IDB on hydrate/persist; none of these tests need
// real persistence, and an unmocked `initDB` would open a database in
// the jsdom environment.
vi.mock("../db", () => ({
    initDB: vi.fn(async () => {
        throw new Error("no idb in this test");
    }),
    STORES: new Proxy({}, { get: (_t, k) => String(k) }),
}));

const TEAM_A = "11111111-1111-1111-1111-111111111111";
const TEAM_B = "22222222-2222-2222-2222-222222222222";

const channel = (id: string) => ({
    id,
    kind: 2,
    title: id,
    profileImageUrl: "",
    projectId: null,
    ownerId: null,
    isPrivate: false,
    legacyChatId: null,
    latestMessage: null,
    unreadCount: 0,
    tsCreated: "2026-01-01T00:00:00Z",
    tsUpdated: "2026-01-01T00:00:00Z",
});

describe("channelService team scoping", () => {
    beforeEach(() => {
        get.mockReset();
        get.mockResolvedValue({ data: { channels: [] } });
        channelService.setAccessToken("tok");
        channelService.setCurrentUserId("user-a");
        // Reset team state between tests without tripping the
        // switch-detection: go to null first, then to the test's team.
        channelService.setCurrentTeamId(null);
    });

    it("sends team_id on the channel list request", async () => {
        channelService.setCurrentTeamId(TEAM_A);
        await channelService.listChannels();
        expect(get).toHaveBeenCalledWith("/api/v3/channels/", {
            params: { team_id: TEAM_A },
        });
    });

    it("omits the parameter entirely when the team is unknown", async () => {
        // Not `team_id: undefined` — axios serializes that as the string
        // "undefined", which matches no team and would blank the chat
        // list during the window before the team resolves.
        await channelService.listChannels();
        expect(get).toHaveBeenCalledWith("/api/v3/channels/", { params: undefined });
    });

    it("asks for the new team after a switch", async () => {
        channelService.setCurrentTeamId(TEAM_A);
        await channelService.listChannels();
        channelService.setCurrentTeamId(TEAM_B);
        await channelService.listChannels();
        expect(get).toHaveBeenLastCalledWith("/api/v3/channels/", {
            params: { team_id: TEAM_B },
        });
    });

    it("drops the previous team's channels from memory on switch", () => {
        channelService.setCurrentTeamId(TEAM_A);
        channelService.handleChannelCreated(channel("chan-in-a") as never);
        expect(channelService.getSnapshot().channels.has("chan-in-a")).toBe(true);

        channelService.setCurrentTeamId(TEAM_B);

        // The core of the report: without this the row is still in the
        // in-memory map, so the sidebar renders it under team B no
        // matter how thoroughly IDB was cleared.
        expect(channelService.getSnapshot().channels.has("chan-in-a")).toBe(false);
    });

    it("does NOT wipe when the team is first assigned", () => {
        // Boot order is hydrate-from-IDB then set-team. Treating that
        // first assignment as a switch would discard everything the
        // hydration just loaded and blank the sidebar on every reload.
        channelService.handleChannelCreated(channel("hydrated") as never);
        channelService.setCurrentTeamId(TEAM_A);
        expect(channelService.getSnapshot().channels.has("hydrated")).toBe(true);
    });

    it("is a no-op when the same team is re-applied", () => {
        channelService.setCurrentTeamId(TEAM_A);
        channelService.handleChannelCreated(channel("keep-me") as never);
        // React re-renders push the same id repeatedly; each one must
        // not clear the store.
        channelService.setCurrentTeamId(TEAM_A);
        channelService.setCurrentTeamId(TEAM_A);
        expect(channelService.getSnapshot().channels.has("keep-me")).toBe(true);
    });
});
