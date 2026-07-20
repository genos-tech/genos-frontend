/**
 * Guards the sidebar row's memo comparator.
 *
 * The comparator is what stops the whole visible sidebar re-rendering on
 * every channelService notify. Its risk is asymmetric:
 *
 *   - too STRICT (a field compared that needn't be) → lost perf, visible
 *     to nobody;
 *   - too LOOSE (a field the row renders but doesn't compare) → a
 *     silently stale row: an old preview, a missing unread dot, a name
 *     that never updates after a rename.
 *
 * So these tests are mostly "changing X must re-render", one per field
 * the row's subtree actually reads.
 */

import { describe, expect, it } from "vitest";

import { ChatListItemProps } from "../features/chat/components/sidebar/ChatListItem.types";
import {
    chatListItemPropsAreEqual,
    sameChatRender,
} from "../features/chat/components/sidebar/chatListItemEquality";
import { AllChatProps } from "../types/chat";

const baseChat = (): AllChatProps =>
    ({
        chatId: "c-1",
        chatType: 1,
        chatName: "Ada",
        isPinned: false,
        isPrivate: false,
        profileImagePath: "/img/a.png",
        lastReadMessageId: "10",
        latestMessageText: "hello",
        latestMessage: { messageId: 10, tsSent: "2026-07-20 10:00:00" },
        dmPartnerUser: { userId: "u2", userName: "Ada", avatarImgPath: "/img/u2.png" },
        TSLastMessage: "2026-07-20 10:00:00",
        mdmMembers: [{ userId: "u2" }, { userId: "u3" }],
    }) as unknown as AllChatProps;

// Stable across calls on purpose: the comparator checks
// `teamMemberProfiles` by REFERENCE (it only changes on a real profile
// edit), so a fresh object per helper call would look like a rename.
const PROFILES = {};

const withChat = (chat: AllChatProps, over: Partial<ChatListItemProps> = {}) =>
    ({
        chat,
        selected: false,
        isPinnedChat: false,
        incompleteTodoCount: 0,
        isToDoVisible: false,
        myself: { userId: "u1" },
        useTEM: { teamMemberProfiles: PROFILES },
        ...over,
    }) as unknown as ChatListItemProps;

describe("sameChatRender", () => {
    it("treats a freshly rebuilt but identical chat as equal", () => {
        // The whole point: `allChats` hands us a new object every notify.
        expect(sameChatRender(baseChat(), baseChat())).toBe(true);
    });

    const mutations: Array<{ field: string; mutate: (c: AllChatProps) => void }> = [
        { field: "chatId", mutate: (c) => (c.chatId = "c-2") },
        { field: "chatType", mutate: (c) => (c.chatType = 2) },
        { field: "chatName", mutate: (c) => (c.chatName = "Grace") },
        { field: "isPinned", mutate: (c) => (c.isPinned = true) },
        { field: "isPrivate", mutate: (c) => (c.isPrivate = true) },
        { field: "profileImagePath", mutate: (c) => (c.profileImagePath = "/img/b.png") },
        { field: "lastReadMessageId (unread dot)", mutate: (c) => (c.lastReadMessageId = "9") },
        { field: "latestMessageText (preview)", mutate: (c) => (c.latestMessageText = "bye") },
        {
            field: "latestMessage.messageId",
            mutate: (c) => (c.latestMessage = { ...c.latestMessage, messageId: 11 }),
        },
        {
            field: "latestMessage.tsSent",
            mutate: (c) =>
                (c.latestMessage = { ...c.latestMessage, tsSent: "2026-07-20 11:00:00" }),
        },
        {
            field: "dmPartnerUser.userId",
            mutate: (c) => (c.dmPartnerUser = { ...c.dmPartnerUser, userId: "u9" }),
        },
        {
            field: "dmPartnerUser.userName (rename)",
            mutate: (c) => (c.dmPartnerUser = { ...c.dmPartnerUser, userName: "Grace" }),
        },
        {
            field: "dmPartnerUser.avatarImgPath",
            mutate: (c) => (c.dmPartnerUser = { ...c.dmPartnerUser, avatarImgPath: "/img/z.png" }),
        },
        {
            field: "mdmMembers",
            mutate: (c) => (c.mdmMembers = [{ userId: "u2" }] as AllChatProps["mdmMembers"]),
        },
    ];

    for (const { field, mutate } of mutations) {
        it(`re-renders when ${field} changes`, () => {
            const next = baseChat();
            mutate(next);
            expect(sameChatRender(baseChat(), next)).toBe(false);
        });
    }
});

describe("chatListItemPropsAreEqual", () => {
    it("is equal when nothing the row renders changed", () => {
        expect(chatListItemPropsAreEqual(withChat(baseChat()), withChat(baseChat()))).toBe(true);
    });

    it("re-renders when the selection moves onto or off this row", () => {
        expect(
            chatListItemPropsAreEqual(
                withChat(baseChat(), { selected: false }),
                withChat(baseChat(), { selected: true })
            )
        ).toBe(false);
    });

    it("re-renders when team profiles change (rename / new avatar)", () => {
        expect(
            chatListItemPropsAreEqual(
                withChat(baseChat(), { useTEM: { teamMemberProfiles: {} } as never }),
                withChat(baseChat(), { useTEM: { teamMemberProfiles: { u2: {} } } as never })
            )
        ).toBe(false);
    });

    it("re-renders when the todo badge or its visibility changes", () => {
        expect(
            chatListItemPropsAreEqual(
                withChat(baseChat(), { incompleteTodoCount: 0 }),
                withChat(baseChat(), { incompleteTodoCount: 3 })
            )
        ).toBe(false);
        expect(
            chatListItemPropsAreEqual(
                withChat(baseChat(), { isToDoVisible: false }),
                withChat(baseChat(), { isToDoVisible: true })
            )
        ).toBe(false);
    });

    it("re-renders when the viewer changes", () => {
        expect(
            chatListItemPropsAreEqual(
                withChat(baseChat(), { myself: { userId: "u1" } as never }),
                withChat(baseChat(), { myself: { userId: "u7" } as never })
            )
        ).toBe(false);
    });

    it("IGNORES manager identity — the reason the memo works at all", () => {
        // These are rebuilt every render; comparing them would defeat the
        // memo entirely. Rows read live values through `liveRef` instead.
        expect(
            chatListItemPropsAreEqual(
                withChat(baseChat(), { useCM: { a: 1 } as never, useTM: { a: 1 } as never }),
                withChat(baseChat(), { useCM: { a: 2 } as never, useTM: { a: 2 } as never })
            )
        ).toBe(true);
    });
});
