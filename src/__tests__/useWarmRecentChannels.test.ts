/**
 * Boot warm-up hook tests.
 *
 * The subtle failure this pins down: `allChats` is re-derived into a NEW
 * array on every channelService notify — including the notifies caused
 * by the warm-up's own syncs landing. If the warm-up queue's canceller
 * is returned from an effect keyed on `allChats`, React tears it down on
 * the first such churn and only the opening batch ever runs.
 */

import { renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useWarmRecentChannels } from "../features/chat/hooks/useWarmRecentChannels";
import { __resetChannelPrefetchForTests } from "../services/channel/channelPrefetch";
import { channelService } from "../services/channel/channelService";
import { AllChatProps } from "../types/chat";

vi.mock("../db/config/schema", () => ({
    initDB: vi.fn().mockRejectedValue(new Error("IDB stubbed off in tests")),
}));

const chat = (id: string, ts: string) =>
    ({ chatId: id, chatType: 1, TSLastMessage: ts }) as unknown as AllChatProps;

describe("useWarmRecentChannels", () => {
    let syncSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
        __resetChannelPrefetchForTests();
        vi.stubGlobal("requestIdleCallback", (cb: () => void) => {
            cb();
            return 1;
        });
        vi.stubGlobal("cancelIdleCallback", () => {});
        vi.spyOn(channelService, "getSnapshot").mockReturnValue({
            messagesByChannel: new Map(),
        } as unknown as ReturnType<typeof channelService.getSnapshot>);
        syncSpy = vi
            .spyOn(channelService, "syncChannel")
            .mockImplementation(() => Promise.resolve());
    });

    afterEach(() => {
        vi.restoreAllMocks();
        vi.unstubAllGlobals();
    });

    it("warms most-recent-first", async () => {
        const chats = [
            chat("old", "2026-07-01 10:00:00"),
            chat("newest", "2026-07-20 10:00:00"),
            chat("mid", "2026-07-10 10:00:00"),
        ];
        renderHook(() => useWarmRecentChannels(chats));
        await vi.waitFor(() => expect(syncSpy).toHaveBeenCalledTimes(3));
        expect(syncSpy.mock.calls.map((c) => c[0])).toEqual(["newest", "mid", "old"]);
    });

    it("keeps draining the queue when allChats churns mid-warm-up", async () => {
        // 8 channels > one batch, so the queue must survive several
        // re-renders with fresh `allChats` identities to finish.
        const ids = Array.from({ length: 8 }, (_, i) => `c-${i}`);
        const build = () => ids.map((id, i) => chat(id, `2026-07-${20 - i} 10:00:00`));

        const { rerender } = renderHook(({ chats }) => useWarmRecentChannels(chats), {
            initialProps: { chats: build() },
        });

        // Simulate the store notifying repeatedly (new array each time),
        // exactly as a live message or a landing sync would.
        for (let i = 0; i < 4; i++) {
            rerender({ chats: build() });
            await Promise.resolve();
        }

        await vi.waitFor(() => expect(syncSpy).toHaveBeenCalledTimes(8));
    });

    it("does not re-warm on churn once the queue has drained", async () => {
        const chats = [chat("a", "2026-07-20 10:00:00"), chat("b", "2026-07-19 10:00:00")];
        const { rerender } = renderHook(({ c }) => useWarmRecentChannels(c), {
            initialProps: { c: chats },
        });
        await vi.waitFor(() => expect(syncSpy).toHaveBeenCalledTimes(2));

        rerender({ c: [...chats] });
        rerender({ c: [...chats] });
        await Promise.resolve();
        expect(syncSpy).toHaveBeenCalledTimes(2);
    });

    it("waits for chats to load before warming anything", async () => {
        const { rerender } = renderHook(({ c }) => useWarmRecentChannels(c), {
            initialProps: { c: [] as AllChatProps[] },
        });
        expect(syncSpy).not.toHaveBeenCalled();

        rerender({ c: [chat("a", "2026-07-20 10:00:00")] });
        await vi.waitFor(() => expect(syncSpy).toHaveBeenCalledTimes(1));
    });

    it("does nothing when disabled", async () => {
        renderHook(() => useWarmRecentChannels([chat("a", "2026-07-20 10:00:00")], false));
        await Promise.resolve();
        expect(syncSpy).not.toHaveBeenCalled();
    });
});
