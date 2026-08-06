/**
 * A DM thread's header must name the person you're talking to.
 *
 * The reported bug: opening a thread inside a DM showed "<friend> (you)", or
 * just "(you)" with no name at all. Both came from this inheritance step in
 * `useChatRouting`, which hardcoded `dmPartnerUser: myself` and read the name
 * off `currentMainChat`:
 *
 *   - `ThreadChatPaneHeader` decides "is this my own self-DM?" by comparing
 *     `dmPartnerUser.userId` to `myself.userId`, so a partner of `myself`
 *     appended "(you)" to every DM thread.
 *   - `currentMainChat` is still undefined on a cold thread deep-link, which
 *     emptied the name and left the bare "(you)" from the screenshot.
 *
 * `threadIdentityFromChannel` is pure precisely so this is checkable without
 * mounting the hook. See `parseChatRoute` for the same split.
 */

import { describe, expect, it } from "vitest";

import { threadIdentityFromChannel } from "../../features/chat/utils/threadIdentity";
import { UserProps } from "../../types/admin";
import { AllChatProps, ChatProps } from "../../types/chat";

const me = { userId: "u-me", userName: "M-Kentaro" } as UserProps;
const friend = { userId: "u-ryan", userName: "Ryan" } as UserProps;

const dmRow = {
    chatId: "channel-dm",
    chatType: 1,
    chatName: "Ryan",
    dmPartnerUser: friend,
} as AllChatProps;

const selfDmRow = {
    chatId: "channel-self",
    chatType: 1,
    chatName: "M-Kentaro",
    dmPartnerUser: me,
} as AllChatProps;

const gmRow = {
    chatId: "channel-gm",
    chatType: 2,
    chatName: "Launch crew",
    dmPartnerUser: me,
} as AllChatProps;

describe("threadIdentityFromChannel", () => {
    it("inherits the friend as partner, not the signed-in user", () => {
        const { chatName, dmPartnerUser } = threadIdentityFromChannel(
            [dmRow],
            "channel-dm",
            1,
            undefined,
            me
        );

        expect(chatName).toBe("Ryan");
        // The whole bug in one assertion: `myself` here is what made the
        // header read "Ryan (you)".
        expect(dmPartnerUser.userId).toBe(friend.userId);
    });

    it("names the channel on a cold deep-link, with no currentMainChat", () => {
        // `allChats` comes back from cache before any chat is opened, which is
        // the case that used to produce a nameless "(you)".
        const { chatName, dmPartnerUser } = threadIdentityFromChannel(
            [gmRow, dmRow],
            "channel-dm",
            1,
            undefined,
            me
        );

        expect(chatName).toBe("Ryan");
        expect(dmPartnerUser.userId).toBe(friend.userId);
    });

    it("still reports you as partner in your own self-DM", () => {
        // "(you)" is correct here — the fix must not suppress it everywhere.
        const { dmPartnerUser } = threadIdentityFromChannel(
            [selfDmRow],
            "channel-self",
            1,
            undefined,
            me
        );

        expect(dmPartnerUser.userId).toBe(me.userId);
    });

    it("matches on chat type, so a shared id can't cross channel kinds", () => {
        const collidingGm = { ...gmRow, chatId: "channel-dm" } as AllChatProps;
        const { chatName } = threadIdentityFromChannel(
            [collidingGm, dmRow],
            "channel-dm",
            1,
            undefined,
            me
        );

        expect(chatName).toBe("Ryan");
    });

    it("bridges the numeric chatId ThreadProps still declares", () => {
        // `ThreadProps.chatId` is typed `number` but holds a v3 UUID; the
        // lookup has to compare it as the string `allChats` stores.
        const { dmPartnerUser } = threadIdentityFromChannel(
            [dmRow],
            "channel-dm" as unknown as number,
            1,
            undefined,
            me
        );

        expect(dmPartnerUser.userId).toBe(friend.userId);
    });

    it("falls back to the open chat when the channel isn't in the list", () => {
        const openChat = {
            chatId: "channel-dm",
            chatType: 1,
            chatName: "Ryan",
            dmPartnerUser: friend,
        } as ChatProps;

        const { chatName, dmPartnerUser } = threadIdentityFromChannel(
            [],
            "channel-dm",
            1,
            openChat,
            me
        );

        expect(chatName).toBe("Ryan");
        expect(dmPartnerUser.userId).toBe(friend.userId);
    });

    it("degrades to the signed-in user when nothing knows the channel", () => {
        // `dmPartnerUser` is non-optional, so there has to be a value; an
        // unknown channel is the one case where "(you)" is unavoidable.
        const { chatName, dmPartnerUser } = threadIdentityFromChannel(
            [],
            "channel-missing",
            1,
            undefined,
            me
        );

        expect(chatName).toBe("");
        expect(dmPartnerUser.userId).toBe(me.userId);
    });
});
