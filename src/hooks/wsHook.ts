import { useEffect } from "react";
import { Socket } from "socket.io-client";

import { addChat } from "../features/chat/services/addChat";
import { addMessage } from "../features/chat/services/addMessage";
import { addThreadMessage } from "../features/chat/services/addThreadMessage";
import { UserProps } from "../types/admin";
import {
    AllChatProps,
    ChatProps,
    MessageProps,
    ThreadMessageProps,
    NewMessageProps,
    NewThreadMessageProps,
    ThreadProps,
} from "../types/chat";

type wsHookProps = {
    socket: Socket | null;
    accessToken: string | null;
    myself: UserProps;
    allChats: AllChatProps[];
    currentMainChat: ChatProps | undefined;
    currentSubChat: ChatProps | undefined;
    currentThreadChat: ThreadProps | undefined;
    setCurrentMainChat: (chat: ChatProps) => void;
    setCurrentSubChat: (chat: ChatProps) => void;
    setCurrentThreadChat: (chat: ThreadProps) => void;
    setAllChats: () => void;
    setIsTaskCommentUpdated: (value: boolean) => void;
    isLoading: boolean;
};

export const wsHook = (props: wsHookProps) => {
    const {
        socket,
        accessToken,
        myself,
        allChats,
        currentMainChat,
        currentSubChat,
        currentThreadChat,
        setCurrentMainChat,
        setCurrentSubChat,
        setCurrentThreadChat,
        setAllChats,
        setIsTaskCommentUpdated,
        isLoading,
    } = props;

    const updateChat = async (
        chatName: string,
        dmPartnerUser: UserProps | null,
        newMessage: NewMessageProps,
        newChatMessage: MessageProps
    ) => {
        const newChat: AllChatProps = {
            chatId: newMessage.chatId,
            chatName: chatName,
            isDm: newMessage.isDm ? true : false,
            chatType: newMessage.chatType,
            systemUserId: newMessage.systemUserId,
            dmPartnerUser: dmPartnerUser,
            unread: true,
            latestMessage: newChatMessage,
            latestMessageText: newChatMessage.contentText,
            TSLastMessage: newChatMessage.tsSent,
        };
        if (newChat) {
            await addChat(newChat, newMessage.chatType);
            setAllChats();
        }
    };

    useEffect(() => {
        if (socket === null) {
            return;
        }

        socket.on("connect", () => {
            console.log("WS connected");
        });

        socket.on("auth_error", (data) => {
            console.error("Authentication Error:", data.message);
            // alert(`Error: ${data.message}`);
        });

        socket.on("message", async (message) => {
            console.log("message:", message);
            if (message.wsType === "chat") {
                if (message.chatId !== null) {
                    var fromMe: boolean = false;
                    var toMe: boolean = false;

                    if (message.isThread === true) {
                        const newMessage: NewThreadMessageProps = message;
                        const newThreadMessage: ThreadMessageProps = {
                            chatType: newMessage.chatType,
                            systemUserId: newMessage.systemUserId,
                            messageIdWithChatIdAndThreadId: `${newMessage.chatId}-${newMessage.threadId}-${newMessage.messageId}`,
                            chatId: newMessage.chatId,
                            threadId: newMessage.threadId,
                            messageId: newMessage.messageId,
                            content: newMessage.content,
                            contentText: newMessage.contentText,
                            sender: newMessage.sender,
                            tsSent: newMessage.tsSent,
                            taskId: newMessage.taskId,
                        };
                        const updatedThreadChat: ThreadProps = {
                            chatId: newMessage.chatId,
                            chatName: newMessage.chatName,
                            systemUserId: newMessage.systemUserId,
                            threadId: newThreadMessage.threadId,
                            isDm: newMessage.isDm,
                            chatType: newMessage.chatType,
                            dmPartnerUser: newMessage.dmPartnerUser,
                            taskId: newThreadMessage.taskId,
                            unread: false,
                            messages: currentThreadChat
                                ? [...currentThreadChat.messages, newThreadMessage]
                                : [newThreadMessage],
                            TSLastMessage: newThreadMessage.tsSent,
                        };
                        if (updatedThreadChat && newThreadMessage) {
                            if (message.chatType === 1) {
                                if (
                                    newMessage.dmPartnerUser !== null &&
                                    newMessage.dmPartnerUser.userId === myself.userId
                                ) {
                                    if (
                                        newMessage.dmPartnerUser.userId ===
                                        newMessage.sender.userId
                                    ) {
                                        console.log("Personal DM thread");
                                        fromMe = true;
                                        toMe = true;
                                    } else {
                                        console.log("DM thread from my friend");
                                        toMe = true;
                                    }
                                } else {
                                    if (newMessage.sender.userId === myself.userId) {
                                        console.log("DM thread from myself");
                                        fromMe = true;
                                        toMe = true;
                                    } else {
                                        console.log("DM thread not for me");
                                    }
                                }

                                if (fromMe === false && toMe === true) {
                                    addThreadMessage(
                                        newThreadMessage,
                                        newMessage.chatType
                                    );
                                    if (
                                        currentThreadChat !== undefined &&
                                        newMessage.chatId === currentThreadChat.chatId &&
                                        newThreadMessage.threadId === currentThreadChat.threadId
                                    ) {
                                        setCurrentThreadChat(updatedThreadChat);
                                    }
                                }
                            } else if (message.chatType === 2) {
                                if (newMessage.sender.userId === myself.userId) {
                                    console.log("GM thread from myself");
                                    fromMe = true;
                                } else {
                                    console.log("GM thread from someone");
                                }

                                if (fromMe === false) {
                                    addThreadMessage(
                                        newThreadMessage,
                                        newMessage.chatType
                                    );
                                    if (
                                        currentThreadChat !== undefined &&
                                        newMessage.chatId === currentThreadChat.chatId &&
                                        newThreadMessage.threadId === currentThreadChat.threadId
                                    ) {
                                        setCurrentThreadChat(updatedThreadChat);
                                    }
                                }
                            } else if (newMessage.chatType === 3) {
                                if (newMessage.sender.userId === myself.userId) {
                                    console.log("PM thread from myself");
                                    fromMe = true;
                                } else {
                                    console.log("PM thread from someone");
                                }

                                if (fromMe === false) {
                                    addThreadMessage(
                                        newThreadMessage,
                                        newMessage.chatType
                                    );
                                    if (
                                        currentThreadChat !== undefined &&
                                        newMessage.chatId === currentThreadChat.chatId &&
                                        newThreadMessage.threadId === currentThreadChat.threadId
                                    ) {
                                        setCurrentThreadChat(updatedThreadChat);
                                    }
                                }
                            } else {
                                console.error("Unknown chatType (thread):", newMessage.chatType);
                            }
                        }
                    } else {
                        const newMessage: NewMessageProps = message;
                        const newChatMessage: MessageProps = {
                            chatType: newMessage.chatType,
                            systemUserId: newMessage.systemUserId,
                            messageIdWithChatId: `${newMessage.chatId}-${newMessage.messageId}`,
                            chatId: newMessage.chatId,
                            messageId: newMessage.messageId,
                            content: newMessage.content,
                            contentText: newMessage.contentText,
                            sender: newMessage.sender,
                            numReplies: newMessage.numReplies,
                            tsSent: newMessage.tsSent,
                        };
                        const updatedChat: ChatProps = {
                            chatId: newMessage.chatId,
                            chatName: newMessage.chatName,
                            systemUserId: newMessage.systemUserId,
                            isDm: newMessage.isDm,
                            chatType: newMessage.chatType,
                            dmPartnerUser: newMessage.dmPartnerUser,
                            unread: false,
                            messages:
                                currentMainChat === undefined
                                    ? []
                                    : [...currentMainChat.messages, newMessage],
                            latestMessage: newMessage,
                            latestMessageText: newMessage.contentText,
                            TSLastMessage: newMessage.tsSent,
                        };
                        if (updatedChat && newChatMessage) {
                            if (newMessage.chatType === 1 && newMessage.dmPartnerUser !== null) {
                                if (
                                    newMessage.dmPartnerUser !== null &&
                                    newMessage.dmPartnerUser.userId === myself.userId
                                ) {
                                    if (
                                        newMessage.dmPartnerUser.userId ===
                                        newMessage.sender.userId
                                    ) {
                                        console.log("Personal DM");
                                        fromMe = true;
                                        toMe = true;
                                    } else {
                                        console.log("DM from my friend");
                                        toMe = true;
                                    }
                                } else {
                                    if (newMessage.sender.userId === myself.userId) {
                                        console.log("DM from myself");
                                        fromMe = true;
                                    } else {
                                        console.log("DM not for me");
                                    }
                                }

                                if (fromMe === false && toMe === true) {
                                    await addMessage(newChatMessage, newMessage.chatType);
                                    await updateChat(
                                        newMessage.sender.userName,
                                        newMessage.sender,
                                        newMessage,
                                        newChatMessage
                                    );

                                    if (
                                        newMessage.chatId === currentMainChat?.chatId ||
                                        currentMainChat?.chatId === -1
                                    ) {
                                        setCurrentMainChat(updatedChat);
                                    } else if (newMessage.chatId === currentSubChat?.chatId) {
                                        setCurrentSubChat(updatedChat);
                                    }
                                } else if (fromMe === true) {
                                    // Do nothing cause adding the new message
                                    // and updating chat are done by Editor component.
                                } else {
                                    // Do nothing cause it's DM for others.
                                }
                            } else if (newMessage.chatType === 2) {
                                if (newMessage.sender.userId === myself.userId) {
                                    console.log("GM from myself");
                                    fromMe = true;
                                } else {
                                    console.log("GM from someone");
                                }

                                if (fromMe === false) {
                                    if (allChats.length > 0) {
                                        await addMessage(newChatMessage, newMessage.chatType);
                                        await updateChat(
                                            newMessage.chatName,
                                            null,
                                            newMessage,
                                            newChatMessage
                                        );
                                        if (newMessage.chatId === currentMainChat?.chatId) {
                                            setCurrentMainChat(updatedChat);
                                        } else if (newMessage.chatId === currentSubChat?.chatId) {
                                            setCurrentSubChat(updatedChat);
                                        }
                                    }
                                } else {
                                    // Do nothing cause adding the new message
                                    // and updating chat are done by Editor component.
                                }
                            } else if (newMessage.chatType === 3) {
                                if (newMessage.sender.userId === myself.userId) {
                                    console.log("PM from myself");
                                    fromMe = true;
                                } else {
                                    console.log("PM from someone");
                                }

                                if (fromMe === false) {
                                    if (allChats.length > 0) {
                                        await addMessage(newChatMessage, newMessage.chatType);
                                        await updateChat(
                                            newMessage.chatName,
                                            null,
                                            newMessage,
                                            newChatMessage
                                        );
                                        if (newMessage.chatId === currentMainChat?.chatId) {
                                            setCurrentMainChat(updatedChat);
                                        } else if (newMessage.chatId === currentSubChat?.chatId) {
                                            setCurrentSubChat(updatedChat);
                                        }
                                    }
                                } else {
                                    // Do nothing cause adding the new message
                                    // and updating chat are done by Editor component.
                                }
                            } else {
                                console.error("Unknown chatType:", newMessage.chatType);
                            }
                        }
                    }
                }
            } else if (message.wsType === "task") {
                if (setIsTaskCommentUpdated) {
                    setIsTaskCommentUpdated(true);
                }
            }
        });

        return () => {
            socket.off("message");
            socket.off("connect");
        };
    }, [accessToken, isLoading, allChats, currentMainChat, currentSubChat, currentThreadChat]);
};
