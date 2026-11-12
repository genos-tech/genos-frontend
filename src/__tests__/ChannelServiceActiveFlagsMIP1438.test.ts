/**
 * channelService.fetchActiveFlags — flags are loaded from the server (MIP-1438).
 *
 * Until now the only read was `status=completed`, so a flag set on one device never showed on
 * another, or after the local store was cleared. This is the flag counterpart of `fetchPins`:
 * the server's active list is the truth, with two exceptions it cannot know about yet (a flag
 * this tab is still sending, and one made after the server took its snapshot).
 */
import axios from "axios";
import { afterAll, afterEach, describe, expect, it, vi } from "vitest";

import { ChannelService } from "../services/channel/channelService";
import type { Flag } from "../types/channel";

vi.mock("../db/config/schema", () => ({
    initDB: vi.fn().mockRejectedValue(new Error("IDB stubbed off in tests")),
}));

const _origWarn = console.warn;
console.warn = vi.fn();
afterAll(() => {
    console.warn = _origWarn;
});
afterEach(() => vi.restoreAllMocks());

const SNAPSHOT = "2026-11-12T12:00:00Z";
const flag = (messageId: string, over: Partial<Flag> = {}): Flag => ({
    id: `flag-${messageId}`,
    messageId,
    tsCreated: "2026-11-01T09:00:00Z",
    ...over,
});

/** A service with a token and a stubbed HTTP client whose flag list answers `flags`. */
const makeService = (answer: unknown) => {
    const get = vi
        .fn()
        .mockImplementation(() =>
            answer instanceof Error ? Promise.reject(answer) : Promise.resolve({ data: answer })
        );
    const svc = new ChannelService();
    svc.setCurrentUserId("user-me");
    svc.setAccessToken("tok-1");
    vi.spyOn(axios, "create").mockReturnValue({ get } as never);
    // The host back-fill is its own GET by id; it is not what these tests are about.
    vi.spyOn(svc, "fetchMessageById").mockResolvedValue(null);
    return { svc, get };
};
const active = (svc: ChannelService) => [...svc.getSnapshot().flagByMessageId.keys()].sort();

describe("a device with no flags of its own", () => {
    it("shows the ones the server has", async () => {
        const { svc, get } = makeService({
            flags: [flag("m-1"), flag("m-2")],
            server_time: SNAPSHOT,
        });
        await svc.fetchActiveFlags();
        expect(get).toHaveBeenCalledWith("/api/v3/flags/?status=active");
        expect(active(svc)).toEqual(["m-1", "m-2"]);
    });

    it("back-fills the host message of each, so the Flagged list can draw it", async () => {
        const { svc } = makeService({ flags: [flag("m-1")], server_time: SNAPSHOT });
        await svc.fetchActiveFlags();
        expect(svc.fetchMessageById).toHaveBeenCalledWith("m-1");
    });
});

describe("a flag removed on another device", () => {
    it("goes from here too", async () => {
        const { svc } = makeService({ flags: [flag("m-2")], server_time: SNAPSHOT });
        svc.handleFlagAdded(flag("m-1"));
        svc.handleFlagAdded(flag("m-2"));
        await svc.fetchActiveFlags();
        expect(active(svc)).toEqual(["m-2"]);
    });
});

describe("what the server's answer cannot know about", () => {
    it("keeps a flag this tab is still sending (optimistic)", async () => {
        const { svc } = makeService({ flags: [], server_time: SNAPSHOT });
        svc.handleFlagAdded({
            id: "optimistic-m-9",
            messageId: "m-9",
            tsCreated: "2026-11-01T09:00:00Z",
        });
        await svc.fetchActiveFlags();
        expect(active(svc)).toEqual(["m-9"]);
    });

    it("keeps a flag made after the server's snapshot, and drops an older one that is gone", async () => {
        const { svc } = makeService({ flags: [], server_time: SNAPSHOT });
        svc.handleFlagAdded(flag("older", { tsCreated: "2026-11-12T11:59:00Z" }));
        svc.handleFlagAdded(flag("newer", { tsCreated: "2026-11-12T12:00:05Z" }));
        await svc.fetchActiveFlags();
        expect(active(svc)).toEqual(["newer"]);
    });

    it("with no server_time, drops what the server does not list (older than now)", async () => {
        const { svc } = makeService({ flags: [] });
        svc.handleFlagAdded(flag("gone"));
        await svc.fetchActiveFlags();
        expect(active(svc)).toEqual([]);
    });
});

describe("it does not disturb what is already right", () => {
    it("leaves a flag the server also lists alone (no rewrite, no notify)", async () => {
        const { svc } = makeService({ flags: [flag("m-1")], server_time: SNAPSHOT });
        svc.handleFlagAdded(flag("m-1"));
        const before = svc.getSnapshot().flagsVersion;
        await svc.fetchActiveFlags();
        expect(svc.getSnapshot().flagsVersion).toBe(before);
    });

    it("swaps a placeholder for the server's row", async () => {
        const { svc } = makeService({ flags: [flag("m-1")], server_time: SNAPSHOT });
        svc.handleFlagAdded({
            id: "optimistic-m-1",
            messageId: "m-1",
            tsCreated: "2026-11-12T11:00:00Z",
        });
        await svc.fetchActiveFlags();
        expect(svc.getSnapshot().flagByMessageId.get("m-1")?.id).toBe("flag-m-1");
    });

    it("reopens a flag completed here but active on the server (reopened elsewhere)", async () => {
        const { svc } = makeService({ flags: [flag("m-1")], server_time: SNAPSHOT });
        svc.handleFlagAdded(flag("m-1", { id: "old", completedAt: "2026-11-10T00:00:00Z" }));
        expect(active(svc)).toEqual([]);
        await svc.fetchActiveFlags();
        expect(active(svc)).toEqual(["m-1"]);
    });

    it("does not touch the completed ones the past view holds", async () => {
        const { svc } = makeService({ flags: [], server_time: SNAPSHOT });
        svc.handleFlagAdded(flag("done", { completedAt: "2026-11-10T00:00:00Z" }));
        await svc.fetchActiveFlags();
        expect(svc.getSnapshot().flags.size).toBe(1);
    });
});

describe("when the read cannot be made", () => {
    it("keeps the local flags on a failed request", async () => {
        const { svc } = makeService(new Error("offline"));
        svc.handleFlagAdded(flag("m-1"));
        await svc.fetchActiveFlags();
        expect(active(svc)).toEqual(["m-1"]);
    });

    it("asks for nothing without a token", async () => {
        const { svc, get } = makeService({ flags: [flag("m-1")] });
        svc.setAccessToken(null);
        await svc.fetchActiveFlags();
        expect(get).not.toHaveBeenCalled();
        expect(active(svc)).toEqual([]);
    });
});
