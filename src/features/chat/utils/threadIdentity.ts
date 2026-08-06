// Whose conversation a thread belongs to, resolved from the channel it hangs
// off. A thread carries no name or DM partner of its own; it inherits both,
// and `ThreadChatPaneHeader` renders the result — appending "(you)" when the
// partner is you. So an inherited partner that's wrong doesn't just sit in
// state, it mislabels the header: `useChatRouting` hardcoded `myself` here,
// which made every DM thread look like a self-DM and stamped "(you)" next to
// a friend's name.
//
// Pure, so it can be unit-tested without mounting `useChatRouting` (which
// pulls in react-router + channelService) — same reason `parseChatRoute` was
// extracted out here.

import { UserProps } from "../../../types/admin";
import { AllChatProps, ChatProps } from "../../../types/chat";

export type ThreadIdentity = {
    chatName: string;
    dmPartnerUser: UserProps;
};

/**
 * The `chatName` + `dmPartnerUser` a thread under `chatId` should inherit.
 *
 * Reads the channel's own row out of `allChats` first. That list is populated
 * from cache at boot, so it answers even for a thread deep-link opened cold —
 * the case where `currentMainChat` is still undefined and the header was left
 * showing a nameless "(you)". `currentMainChat` stays as the fallback for a
 * channel that somehow isn't in the list.
 *
 * `myself` is the last resort only because `dmPartnerUser` is non-optional;
 * nothing outside a DM reads it.
 */
export function threadIdentityFromChannel(
    allChats: AllChatProps[],
    // `ThreadProps.chatId` is still typed `number` after the v3 UUID flip,
    // while `allChats` types the same value as the string it actually is.
    chatId: string | number,
    chatType: number,
    currentMainChat: ChatProps | undefined,
    myself: UserProps
): ThreadIdentity {
    const parent =
        allChats.find((c) => c.chatId === String(chatId) && c.chatType === chatType) ??
        currentMainChat;

    return {
        chatName: parent?.chatName || "",
        dmPartnerUser: parent?.dmPartnerUser ?? myself,
    };
}
