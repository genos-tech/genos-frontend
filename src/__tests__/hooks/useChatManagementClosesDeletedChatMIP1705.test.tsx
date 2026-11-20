/**
 * MIP-1705: when the chat that is open disappears from the store (its owner deleted it, or this
 * person was removed from it), the main pane closes.
 *
 * Found in a real browser: the sidebar dropped a deleted group, but the pane on the right kept the
 * group's header over an empty body, because the live-update bridge only PATCHES the open chat and
 * simply returned when its messages were gone.
 */

import { act, renderHook } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useChatManagement } from "../../hooks/chats/useChatManagement";
import type { UserProps } from "../../types/admin";
import type { ChatProps } from "../../types/chat";

const store = vi.hoisted(() => {
    const subscribers = new Set<() => void>();
    const snapshot = {
        channels: new Map<string, unknown>(),
        channelsVersion: 1,
        flagByMessageId: new Map(),
        flags: new Map(),
        flagsVersion: 1,
        membersByChannel: new Map(),
        messagesByChannel: new Map<string, unknown[]>(),
        pinByChannelId: new Map(),
        retentionByChannel: new Map(),
    };
    return { subscribers, snapshot };
});

vi.mock("../../services/channel/channelService", () => ({
    channelService: {
        fetchCompletedFlags: vi.fn(async () => undefined),
        fetchMessageById: vi.fn(async () => undefined),
        getSnapshot: () => store.snapshot,
        subscribe: (cb: () => void) => {
            store.subscribers.add(cb);
            return () => store.subscribers.delete(cb);
        },
        syncChannel: vi.fn(async () => undefined),
    },
}));
vi.mock("../../features/chat/services/loadV3Chats", () => ({
    loadV3Chats: vi.fn(async () => []),
}));
vi.mock("../../features/chat/components/sidebar/activity/services/popActivityMessages", () => ({
    popActivityMessages: vi.fn(async () => []),
}));

const myself = { userId: "u-1" } as unknown as UserProps;
const OPEN = "11111111-1111-4111-8111-111111111111";
const OTHER = "22222222-2222-4222-8222-222222222222";

const chat = (chatId: string) =>
    ({ chatId, chatType: 2, chatName: chatId, messages: [] }) as unknown as ChatProps;

const open = async (chatId: string, { inStore }: { inStore: boolean }) => {
    store.snapshot.channels.clear();
    store.snapshot.messagesByChannel.clear();
    if (inStore) {
        store.snapshot.channels.set(chatId, { id: chatId });
        store.snapshot.messagesByChannel.set(chatId, []);
    }
    const hook = renderHook(() => useChatManagement(myself, null), { wrapper: MemoryRouter });
    await act(async () => {
        await Promise.resolve();
    });
    act(() => hook.result.current.setCurrentMainChat(chat(chatId)));
    return hook;
};

const storeNow = (fn: () => void) =>
    act(() => {
        fn();
        for (const cb of [...store.subscribers]) cb();
    });

describe("the open chat leaves the store", () => {
    beforeEach(() => store.subscribers.clear());

    it("closes the pane when its chat is dropped from the store", async () => {
        const { result } = await open(OPEN, { inStore: true });
        expect(result.current.currentMainChat?.chatId).toBe(OPEN);

        storeNow(() => {
            store.snapshot.channels.delete(OPEN);
            store.snapshot.messagesByChannel.delete(OPEN);
        });

        expect(result.current.currentMainChat).toBeUndefined();
    });

    it("keeps the pane while the chat is still in the store", async () => {
        const { result } = await open(OPEN, { inStore: true });

        storeNow(() => store.snapshot.messagesByChannel.set(OPEN, []));

        expect(result.current.currentMainChat?.chatId).toBe(OPEN);
    });

    it("never closes a chat that was not in the store yet (not hydrated is not deleted)", async () => {
        const { result } = await open(OPEN, { inStore: false });

        storeNow(() => store.snapshot.channels.set(OTHER, { id: OTHER }));

        expect(result.current.currentMainChat?.chatId).toBe(OPEN);
    });

    it("another chat leaving the store does not close this one", async () => {
        const { result } = await open(OPEN, { inStore: true });
        storeNow(() => store.snapshot.channels.set(OTHER, { id: OTHER }));

        storeNow(() => store.snapshot.channels.delete(OTHER));

        expect(result.current.currentMainChat?.chatId).toBe(OPEN);
    });

    it("a chat the person switched to before the drop is not closed by the old one's drop", async () => {
        const { result } = await open(OPEN, { inStore: true });
        store.snapshot.channels.set(OTHER, { id: OTHER });
        store.snapshot.messagesByChannel.set(OTHER, []);
        act(() => result.current.setCurrentMainChat(chat(OTHER)));

        storeNow(() => {
            store.snapshot.channels.delete(OPEN);
            store.snapshot.messagesByChannel.delete(OPEN);
        });

        expect(result.current.currentMainChat?.chatId).toBe(OTHER);
    });
});
