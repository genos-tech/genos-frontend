/**
 * `loadV3Chats` — pre-auth quiet, real failures loud.
 *
 * Two of the three loaders in `useChatManagement` fire before the async token
 * refresh resolves (the mount-once effect runs before `myself.userId` has even
 * hydrated). Calling `listChannels` then can only throw `UNAUTHENTICATED`
 * before any HTTP — so it must not be attempted, and must not be reported as a
 * failure. It logged a red console error on every boot, which is worse than
 * useless: it trains everyone to ignore the log that does matter.
 *
 * The counterpart matters just as much: once a token exists, a failure IS
 * real, and silence there is what let a frozen chat list masquerade as a
 * rendering bug for days.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { loadV3Chats } from "../features/chat/services/loadV3Chats";
import { channelService } from "../services/channel/channelService";

vi.mock("../db/config/schema", () => ({
    initDB: vi.fn().mockRejectedValue(new Error("IDB stubbed off in tests")),
}));

describe("loadV3Chats pre-auth behaviour", () => {
    let errorSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
        errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    });

    afterEach(() => {
        vi.restoreAllMocks();
        channelService.setAccessToken(null);
    });

    it("does not call listChannels before a token exists", async () => {
        channelService.setAccessToken(null);
        const listSpy = vi.spyOn(channelService, "listChannels");

        await loadV3Chats("user-1");

        expect(listSpy).not.toHaveBeenCalled();
    });

    it("stays silent pre-auth — no console error on boot", async () => {
        channelService.setAccessToken(null);

        await loadV3Chats("user-1");

        expect(errorSpy).not.toHaveBeenCalled();
    });

    it("still returns the snapshot pre-auth rather than throwing", async () => {
        channelService.setAccessToken(null);

        await expect(loadV3Chats("user-1")).resolves.toEqual(expect.any(Array));
    });

    it("logs loudly when a real failure happens WITH a token", async () => {
        channelService.setAccessToken("tok-1");
        vi.spyOn(channelService, "listChannels").mockRejectedValue(new Error("network down"));

        await loadV3Chats("user-1");

        expect(errorSpy).toHaveBeenCalledTimes(1);
        expect(String(errorSpy.mock.calls[0][0])).toContain("listChannels failed");
    });

    it("loads normally once a token exists", async () => {
        channelService.setAccessToken("tok-1");
        const listSpy = vi.spyOn(channelService, "listChannels").mockResolvedValue([]);

        await loadV3Chats("user-1");

        expect(listSpy).toHaveBeenCalledTimes(1);
        expect(errorSpy).not.toHaveBeenCalled();
    });
});
