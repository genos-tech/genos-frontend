import { ChatProps } from "../../../types/chat";

// PUNCH LIST (v3 chatId migration): `ChatProps.chatId` and
// `lastReadMessageId` are `string` post-flip — empty-string sentinel
// replaces the legacy `-1`. `MessageProps.chatId` / `messageId` are
// still `number` (the v3 message schema is migrated separately), so
// `latestMessage` keeps its numeric sentinels.
// Keys sorted alphabetically per `sort-keys` (case-insensitive).
export const defaultChat: ChatProps = {
    chatId: "",
    chatName: "Genos",
    chatType: -1,
    dmPartnerUser: {
        avatarImgPath: "",
        customStatus: "",
        teamId: "",
        teamName: "",
        tsJoined: "",
        tsLastSeen: "",
        userEmail: "",
        userId: "",
        userName: "",
    },
    isPrivate: false,
    lastReadMessageId: "",
    latestMessage: {
        chatId: -1,
        chatType: -1,
        content: [],
        contentText: "",
        messageId: -1,
        messageIdWithChatId: "",
        numReplies: 0,
        sender: {
            avatarImgPath: "",
            customStatus: "",
            teamId: "",
            teamName: "",
            tsJoined: "",
            tsLastSeen: "",
            userEmail: "",
            userId: "",
            userName: "",
        },
        systemUserId: "",
        taskId: null,
        taskStatus: null,
        tsSent: "",
        tsUpdated: "",
    },
    latestMessageText: "",
    messages: [],
    TSLastMessage: "",
};
