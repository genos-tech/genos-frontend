import { ChatProps } from "../../../types/chat";

export const defaultChat: ChatProps = {
    chatId: -1,
    chatName: "Origin",
    chatType: -1,
    dmPartnerUser: {
        teamId: "",
        teamName: "",
        userId: "",
        userName: "",
        userEmail: "",
        avatarImgPath: "",
        tsLastSeen: "",
        tsJoined: "",
        customStatus: "",
    },
    latestMessageText: "",
    TSLastMessage: "",
    lastReadMessageId: -1,
    messages: [],
    isPrivate: false,
};
