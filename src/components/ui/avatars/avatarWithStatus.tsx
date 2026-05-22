import { Socket } from "socket.io-client";

import { ChatManagementState } from "../../../hooks/chats/useChatManagement";
import { UIStateManagementState } from "../../../hooks/common/useUIStateManagement";
import { UserProps } from "../../../types/admin";
import { AllChatProps, ThreadProps } from "../../../types/chat";
import { UserAvatar } from "./UserAvatar";

// Backwards-compat prop surface. The legacy `myself`, `setMyself`, `useCM`,
// `useUISM`, and `socket` props are no longer read here — `<UserAvatar>`
// pulls them from `<AvatarContextProvider>` — but they are kept in the
// type so the ~15 unmigrated callsites compile unchanged.
type AvatarWithStatusProps = {
    myself: UserProps;
    setMyself: (value: UserProps) => void;
    avatarSize?: number;
    isYou: boolean;
    avatarUser?: UserProps;
    socket: Socket | null;
    isForBubble?: boolean;
    chat?: AllChatProps;
    thread?: ThreadProps;
    useCM: ChatManagementState;
    showNameAndEmail?: boolean;
    useUISM: UIStateManagementState;
    showPulseDot?: boolean;
};

// Resolve a fallback initial for the rare callsites where the avatar
// represents the chat itself (group / project chats with `chatType !== 1`)
// instead of a single user. For DM bubbles or any per-user surface this
// is undefined, so `<UserAvatar>` falls back to the user's name initial.
const resolveFallbackInitial = (
    isForBubble: boolean | undefined,
    chat: AllChatProps | undefined,
    thread: ThreadProps | undefined
): string | undefined => {
    if (isForBubble === true) return undefined;
    if (chat) {
        if (chat.chatType === 1) return undefined;
        const ch = chat.chatName?.trim();
        return ch ? ch.charAt(0).toUpperCase() : undefined;
    }
    if (thread) {
        if (thread.chatType === 1) return undefined;
        const th = thread.chatName?.trim();
        return th ? th.charAt(0).toUpperCase() : undefined;
    }
    return undefined;
};

/**
 * Thin compatibility shim around `<UserAvatar>`.
 *
 * Historical callers passed an entire `UserProps` blob (`avatarUser`)
 * plus a fan-out of `myself` / `setMyself` / `socket` / `useCM` /
 * `useUISM`. The single source of truth is now `AvatarContextProvider`
 * — we only need a `userId` to look up the live profile. This shim
 * adapts the legacy interface to that.
 */
export const AvatarWithStatus = (props: AvatarWithStatusProps) => {
    const {
        myself,
        avatarSize,
        isYou,
        avatarUser,
        isForBubble,
        chat,
        thread,
        showNameAndEmail,
        showPulseDot,
    } = props;

    // `isYou === true` callers always mean "the signed-in user". Falling
    // back to `avatarUser?.userId` covers the team-member / chat-row case.
    const targetUserId = isYou ? myself.userId : avatarUser?.userId;

    const fallbackInitial = resolveFallbackInitial(isForBubble, chat, thread);

    return (
        <UserAvatar
            fallbackInitial={fallbackInitial}
            showNameAndEmail={showNameAndEmail}
            size={avatarSize}
            userId={targetUserId}
            showPulseDot={showPulseDot}
        />
    );
};
