// @vitest-environment jsdom
//
// MIP-1719: `channel.appeared` makes the app re-read its chat list.
//
// What this pins: the notice calls `refreshChannels` (NOT `listChannels`, which only returns the
// list and would never evict or ingest); a burst of notices costs one read, after the quiet; a
// notice that arrives while a read is under way asks for one more read afterwards (it must not
// join a read that may have left before the chat existed); a malformed notice does nothing; and a
// failed read neither throws out of the handler nor stops later notices from working.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
    cancelChannelAppeared,
    CHANNEL_APPEARED_DEBOUNCE_MS,
    handleChannelAppeared,
} from "../../services/channel/channelAppeared";
import { channelService } from "../../services/channel/channelService";

const NOTICE = { teamId: "t-1", channelId: "c-1", kind: 2 };

/** A `refreshChannels` whose reads the test finishes by hand. */
function controlledRefresh() {
    const pending: Array<() => void> = [];
    const spy = vi.spyOn(channelService, "refreshChannels").mockImplementation(
        () =>
            new Promise<void>((resolve) => {
                pending.push(resolve);
            })
    );
    return { spy, finishOne: () => pending.shift()?.(), waiting: () => pending.length };
}

const settle = async () => {
    // Let the awaiting `run` loop continue after a read resolves.
    for (let i = 0; i < 5; i++) await Promise.resolve();
};

describe("handleChannelAppeared", () => {
    beforeEach(() => {
        vi.useFakeTimers();
    });

    afterEach(async () => {
        cancelChannelAppeared();
        vi.useRealTimers();
        vi.restoreAllMocks();
    });

    it("re-reads the list with refreshChannels, not listChannels", async () => {
        const refresh = vi.spyOn(channelService, "refreshChannels").mockResolvedValue();
        const list = vi.spyOn(channelService, "listChannels").mockResolvedValue([]);
        handleChannelAppeared(NOTICE);
        await vi.advanceTimersByTimeAsync(CHANNEL_APPEARED_DEBOUNCE_MS);
        expect(refresh).toHaveBeenCalledTimes(1);
        // `refreshChannels` is allowed to call `listChannels` itself (it is mocked here, so
        // it does not): the point is that the handler goes through the refresh.
        expect(list).not.toHaveBeenCalled();
    });

    it("waits for the quiet before reading", async () => {
        const refresh = vi.spyOn(channelService, "refreshChannels").mockResolvedValue();
        handleChannelAppeared(NOTICE);
        await vi.advanceTimersByTimeAsync(CHANNEL_APPEARED_DEBOUNCE_MS - 1);
        expect(refresh).not.toHaveBeenCalled();
        await vi.advanceTimersByTimeAsync(1);
        expect(refresh).toHaveBeenCalledTimes(1);
    });

    it("a burst of notices costs one read, after the last of them", async () => {
        const refresh = vi.spyOn(channelService, "refreshChannels").mockResolvedValue();
        for (let i = 0; i < 20; i++) {
            handleChannelAppeared({ ...NOTICE, channelId: `c-${i}` });
            await vi.advanceTimersByTimeAsync(CHANNEL_APPEARED_DEBOUNCE_MS - 50);
        }
        expect(refresh).not.toHaveBeenCalled(); // each notice moved the read back
        await vi.advanceTimersByTimeAsync(CHANNEL_APPEARED_DEBOUNCE_MS);
        expect(refresh).toHaveBeenCalledTimes(1);
    });

    it("a notice that arrives while a read is under way asks for one more read, not a shared one", async () => {
        const { spy, finishOne, waiting } = controlledRefresh();
        handleChannelAppeared(NOTICE);
        await vi.advanceTimersByTimeAsync(CHANNEL_APPEARED_DEBOUNCE_MS);
        expect(spy).toHaveBeenCalledTimes(1);

        // A second chat appears while the first read is in flight; so does a third.
        handleChannelAppeared({ ...NOTICE, channelId: "c-2" });
        handleChannelAppeared({ ...NOTICE, channelId: "c-3" });
        await vi.advanceTimersByTimeAsync(CHANNEL_APPEARED_DEBOUNCE_MS * 4);
        expect(spy).toHaveBeenCalledTimes(1); // still the one read: no second GET piled on

        finishOne();
        await settle();
        expect(spy).toHaveBeenCalledTimes(2); // ONE more read, started after the notices
        finishOne();
        await settle();
        expect(spy).toHaveBeenCalledTimes(2);
        expect(waiting()).toBe(0);
    });

    it("with no notice during the read, it reads once and stops", async () => {
        const { spy, finishOne } = controlledRefresh();
        handleChannelAppeared(NOTICE);
        await vi.advanceTimersByTimeAsync(CHANNEL_APPEARED_DEBOUNCE_MS);
        finishOne();
        await settle();
        await vi.advanceTimersByTimeAsync(CHANNEL_APPEARED_DEBOUNCE_MS * 4);
        expect(spy).toHaveBeenCalledTimes(1);
    });

    it("a later notice, after the read ended, reads again", async () => {
        const refresh = vi.spyOn(channelService, "refreshChannels").mockResolvedValue();
        handleChannelAppeared(NOTICE);
        await vi.advanceTimersByTimeAsync(CHANNEL_APPEARED_DEBOUNCE_MS);
        handleChannelAppeared({ ...NOTICE, channelId: "c-2" });
        await vi.advanceTimersByTimeAsync(CHANNEL_APPEARED_DEBOUNCE_MS);
        expect(refresh).toHaveBeenCalledTimes(2);
    });

    it.each([
        ["undefined", undefined],
        ["null", null],
        ["a string", "channel.appeared"],
        ["a number", 7],
        ["an array", []],
        ["an empty object", {}],
        ["no channel id", { teamId: "t-1", kind: 2 }],
        ["an empty channel id", { ...NOTICE, channelId: "" }],
        ["a numeric channel id", { ...NOTICE, channelId: 7 }],
        ["no kind", { teamId: "t-1", channelId: "c-1" }],
        ["a text kind", { ...NOTICE, kind: "2" }],
    ])("ignores a malformed notice: %s", async (_name, payload) => {
        const refresh = vi.spyOn(channelService, "refreshChannels").mockResolvedValue();
        expect(() => handleChannelAppeared(payload)).not.toThrow();
        await vi.advanceTimersByTimeAsync(CHANNEL_APPEARED_DEBOUNCE_MS * 4);
        expect(refresh).not.toHaveBeenCalled();
    });

    it("a malformed notice does not cancel a good one already waiting", async () => {
        const refresh = vi.spyOn(channelService, "refreshChannels").mockResolvedValue();
        handleChannelAppeared(NOTICE);
        handleChannelAppeared(null);
        await vi.advanceTimersByTimeAsync(CHANNEL_APPEARED_DEBOUNCE_MS);
        expect(refresh).toHaveBeenCalledTimes(1);
    });

    it("a failed read is logged, throws nothing, and does not stop the next notice reading", async () => {
        const error = vi.spyOn(console, "error").mockImplementation(() => {});
        const refresh = vi
            .spyOn(channelService, "refreshChannels")
            .mockRejectedValueOnce(new Error("offline"))
            .mockResolvedValue();
        handleChannelAppeared(NOTICE);
        await vi.advanceTimersByTimeAsync(CHANNEL_APPEARED_DEBOUNCE_MS);
        expect(error).toHaveBeenCalledTimes(1);
        handleChannelAppeared(NOTICE);
        await vi.advanceTimersByTimeAsync(CHANNEL_APPEARED_DEBOUNCE_MS);
        expect(refresh).toHaveBeenCalledTimes(2);
    });

    it("cancelChannelAppeared drops a read that has not started", async () => {
        const refresh = vi.spyOn(channelService, "refreshChannels").mockResolvedValue();
        handleChannelAppeared(NOTICE);
        cancelChannelAppeared();
        await vi.advanceTimersByTimeAsync(CHANNEL_APPEARED_DEBOUNCE_MS * 4);
        expect(refresh).not.toHaveBeenCalled();
    });
});
