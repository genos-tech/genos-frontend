/**
 * The number on the app badge, the Chat tab and the bottom bar
 * (`unReadChatAndActivityCounts`): unread chats + unread Activity topics.
 *
 * The Activity count starts out as -1, meaning "not loaded yet" (and goes back
 * to -1 on a team switch, until the feed is read again). The total used to add
 * that -1 in as if it were a count, so until the Activity feed had loaded the
 * total read one too low, and with nothing else unread it read -1 (which
 * `useAppBadge` treats as "clear the badge"). The -1 is still the marker, but
 * it is not a count: it must add nothing to the total.
 */

import { act, renderHook } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

import { useChatManagement } from "../../hooks/chats/useChatManagement";
import type { UserProps } from "../../types/admin";

// The hook subscribes to the channel store and loads from it on mount; an empty
// store and no network is all this test needs.
vi.mock("../../services/channel/channelService", () => {
    const empty = () => new Map();
    const snapshot = {
        channels: empty(),
        channelsVersion: 1,
        flagByMessageId: empty(),
        flags: empty(),
        flagsVersion: 1,
        membersByChannel: empty(),
        messagesByChannel: empty(),
        pinByChannelId: empty(),
        retentionByChannel: empty(),
    };
    return {
        channelService: {
            fetchCompletedFlags: vi.fn(async () => undefined),
            fetchMessageById: vi.fn(async () => undefined),
            getSnapshot: () => snapshot,
            subscribe: () => () => undefined,
            syncChannel: vi.fn(async () => undefined),
        },
    };
});
vi.mock("../../features/chat/services/loadV3Chats", () => ({
    loadV3Chats: vi.fn(async () => []),
}));
vi.mock("../../features/chat/components/sidebar/activity/services/popActivityMessages", () => ({
    popActivityMessages: vi.fn(async () => []),
}));

const myself = { userId: "u-1" } as unknown as UserProps;

const setup = async () => {
    const hook = renderHook(() => useChatManagement(myself, null), {
        wrapper: MemoryRouter,
    });
    // Let the mount-time loaders settle.
    await act(async () => {
        await Promise.resolve();
    });
    return hook;
};

describe("unReadChatAndActivityCounts", () => {
    it("is 0, not -1, with nothing unread and the Activity feed not loaded", async () => {
        const { result } = await setup();

        act(() => {
            result.current.setUnReadChatCounts({});
            result.current.setUnReadActivityMessageCounts(-1);
        });

        expect(result.current.unReadChatAndActivityCounts).toBe(0);
    });

    it("counts the 3 unread DMs, not 2, while the Activity feed is not loaded", async () => {
        const { result } = await setup();

        act(() => {
            result.current.setUnReadChatCounts({ 1: 3 });
            result.current.setUnReadActivityMessageCounts(-1);
        });

        expect(result.current.unReadChatAndActivityCounts).toBe(3);
    });

    it("adds the Activity topics once the feed has loaded", async () => {
        const { result } = await setup();

        act(() => {
            result.current.setUnReadChatCounts({ 1: 3 });
            result.current.setUnReadActivityMessageCounts(-1);
        });
        act(() => {
            result.current.setUnReadActivityMessageCounts(2);
        });

        expect(result.current.unReadChatAndActivityCounts).toBe(5);
    });

    it("sums DMs, group chats and project chats with the Activity topics", async () => {
        const { result } = await setup();

        act(() => {
            result.current.setUnReadChatCounts({ 1: 1, 2: 2, 3: 3 });
            result.current.setUnReadActivityMessageCounts(4);
        });

        expect(result.current.unReadChatAndActivityCounts).toBe(10);
    });
});
