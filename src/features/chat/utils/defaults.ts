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
    latestMessage: {
        chatType: -1,
        systemUserId: "",
        messageIdWithChatId: "",
        chatId: -1,
        messageId: -1,
        content: [],
        contentText: "",
        sender: {
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
        tsSent: "",
        tsUpdated: "",
        numReplies: 0,
        taskId: null,
        taskStatus: null,
    },
    isPrivate: false,
};

export const defaultTodoContent = [
    {
        type: "checkListItem",
        props: {
            checked: false,
            textColor: "default",
            textAlignment: "left",
            backgroundColor: "default",
        },
        content: [{ text: "Today's Todo", type: "text", styles: {} }],
        children: [],
    },
    {
        type: "paragraph",
        props: {
            textColor: "default",
            textAlignment: "left",
            backgroundColor: "default",
        },
        content: [],
        children: [],
    },
];
