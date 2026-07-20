/**
 * Render-equality for a sidebar chat row.
 *
 * `useCM.allChats` is re-derived on EVERY channelService notify — each
 * incoming message, read-cursor advance, pin — and `v3ChannelsToLegacyChats`
 * builds a brand-new `AllChatProps` object per channel each time. So a
 * reference comparison on `chat` is always false, and `React.memo` on the
 * row never hits: the whole visible sidebar (avatars, titles, previews,
 * action buttons) re-renders continuously on a busy team.
 *
 * Hence a VALUE comparison over exactly the fields the row's subtree
 * reads. The field list below is not a guess — it was read off
 * `chatListItem.tsx` and its four children. If a child starts reading a
 * new `chat.*` field, it MUST be added here, or that field will render
 * stale. That is the one failure mode of this file, and it is invisible
 * to tests that don't assert on it — see `chatListItemEquality.test.ts`.
 *
 * Deliberately NOT compared:
 *
 *   - `useCM` / `useTM` / `useUISM` — rebuilt every render; the row only
 *     calls their setters (stable) and reads live values through
 *     `useCMRef`, never through the captured prop. See `chatListItem.tsx`.
 *   - Personal GM tags — `ChatListItemTags` subscribes via
 *     `usePersonalGMTags` (`useSyncExternalStore`) INSIDE the child, so it
 *     re-renders on its own whether or not this row does.
 *   - Avatar/display-name overrides from `AvatarContext` — context
 *     consumers re-render independently of a memoized ancestor.
 *
 * `useTEM.teamMemberProfiles` IS compared (by reference): the title and
 * avatar read it through props, so a rename or avatar change has to
 * repaint the row. It only changes on an actual profile edit, so it
 * doesn't defeat the memo on ordinary message traffic.
 */

import { AllChatProps } from "../../../../types/chat";
import { ChatListItemProps } from "./ChatListItem.types";

/** Cheap stable key for the MDM member strip (avatar + title read it). */
const mdmMembersKey = (chat: AllChatProps): string =>
    (chat.mdmMembers ?? []).map((m) => m.userId).join(",");

/** True when two snapshots of the same chat would render identically. */
export const sameChatRender = (a: AllChatProps, b: AllChatProps): boolean =>
    a.chatId === b.chatId &&
    a.chatType === b.chatType &&
    a.chatName === b.chatName &&
    a.isPinned === b.isPinned &&
    a.isPrivate === b.isPrivate &&
    a.profileImagePath === b.profileImagePath &&
    a.lastReadMessageId === b.lastReadMessageId &&
    a.latestMessageText === b.latestMessageText &&
    // The preview + unread dot key off the newest message; its id and
    // timestamp are what actually drive them.
    a.latestMessage?.messageId === b.latestMessage?.messageId &&
    a.latestMessage?.tsSent === b.latestMessage?.tsSent &&
    a.dmPartnerUser?.userId === b.dmPartnerUser?.userId &&
    a.dmPartnerUser?.userName === b.dmPartnerUser?.userName &&
    a.dmPartnerUser?.avatarImgPath === b.dmPartnerUser?.avatarImgPath &&
    mdmMembersKey(a) === mdmMembersKey(b);

export const chatListItemPropsAreEqual = (
    prev: ChatListItemProps,
    next: ChatListItemProps
): boolean =>
    prev.selected === next.selected &&
    prev.isPinnedChat === next.isPinnedChat &&
    prev.incompleteTodoCount === next.incompleteTodoCount &&
    prev.isToDoVisible === next.isToDoVisible &&
    prev.myself.userId === next.myself.userId &&
    prev.useTEM.teamMemberProfiles === next.useTEM.teamMemberProfiles &&
    sameChatRender(prev.chat, next.chat);
