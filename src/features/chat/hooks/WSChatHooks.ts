import { useEffect } from "react";
import { Socket } from "socket.io-client";

import { addChat } from '../services/addChat';
import { addMessage } from "../services/addMessage";
import { addThreadMessage } from "../services/addThreadMessage";
import { UserProps } from '../../../types/admin';
import {
    AllChatProps,
    ChatProps,
    MessageProps,
    ThreadMessageProps,
    NewMessageProps,
    NewThreadMessageProps,
    ThreadProps
} from "../../../types/chat";

type wsMessageHandleHookProps = {
    socket: Socket | null;
    accessToken: string | null;
    myself: UserProps;
    allChats: AllChatProps[];
    currentMainChat: ChatProps;
    currentSubChat: ChatProps | undefined;
    currentThreadChat: ThreadProps | undefined;
    setCurrentMainChat: (chat: ChatProps) => void;
    setCurrentSubChat: (chat: ChatProps) => void;
    setCurrentThreadChat: (chat: ThreadProps) => void;
    setAllChats: () => void;
};

export const wsMessageHandleHook = (props: wsMessageHandleHookProps) => {
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
    } = props;

    const updateChat = async (newMessage: NewMessageProps, newChatMessage: MessageProps) => {
        const newChat: AllChatProps = {
            chatId: newMessage.chatId,
            chatName: newMessage.chatName,
            isDm: newMessage.isDm ? true : false,
            dmPartnerUserId: newMessage.isDm ? newMessage.dmPartnerUserId : null,
            unread: true,
            latestMessage: newChatMessage,
            latestMessageText: newChatMessage.contentText,
            TSLastMessage: newChatMessage.tsSent,
        }
        if (newChat) {
            await addChat(newChat, newMessage.isDm)
            setAllChats()
        }
    }


    useEffect(() => {
        if (socket === null) {
            return;
        }

        socket.on("connect", () => {
            // // Join to initial user room
            // socket.emit("join", {
            //     joiningCGId: -1,
            //     joiningCGName: myself.userName,
            //     isDm: true,
            //     dmPartnerUserId: myself.userId,
            // });
        });

        socket.on("auth_error", (data) => {
            console.error("Authentication Error:", data.message);
            // alert(`Error: ${data.message}`);
        });

        socket.on("message", async (message) => {
            console.log("message:", message)
            if (message.chatId !== null) {
                var fromMe: boolean = false
                var toMe: boolean = false

                if (message.isThread === true) {
                    const newMessage: NewThreadMessageProps = message;
                    const newThreadMessage: ThreadMessageProps = {
                        messageIdWithChatIdAndThreadId: `${newMessage.chatId}-${newMessage.threadId}-${newMessage.messageId}`,
                        chatId: newMessage.chatId,
                        threadId: newMessage.threadId,
                        messageId: newMessage.messageId,
                        content: newMessage.content,
                        contentText: newMessage.contentText,
                        sender: newMessage.sender,
                        tsSent: newMessage.tsSent,
                        taskId: newMessage.taskId,
                    }
                    const updatedThreadChat: ThreadProps = {
                        chatId: newMessage.chatId,
                        chatName: newMessage.chatName,
                        threadId: newThreadMessage.threadId,
                        isDm: newMessage.isDm,
                        dmPartnerUserId: newMessage.isDm ? newMessage.dmPartnerUserId : null,
                        taskId: newThreadMessage.taskId,
                        unread: false,
                        messages: currentThreadChat ? [...currentThreadChat.messages, newThreadMessage] : [newThreadMessage],
                        TSLastMessage: newThreadMessage.tsSent,
                    };
                    if (updatedThreadChat && newThreadMessage) {
                        if (message.isDm === true) {
                            if (newMessage.dmPartnerUserId === myself.userId) {
                                if (newMessage.dmPartnerUserId === newMessage.sender.userId) {
                                    console.log("Personal DM thread")
                                    fromMe = true
                                    toMe = true
                                } else {
                                    console.log("DM thread from my friend")
                                    toMe = true
                                }
                            } else {
                                if (newMessage.sender.userId === myself.userId) {
                                    console.log("DM thread from myself")
                                    fromMe = true
                                    toMe = true
                                } else {
                                    console.log("DM thread not for me")
                                }
                            }

                            if (fromMe === false && toMe === true) {
                                addThreadMessage(newThreadMessage, newMessage.isDm);
                                if (
                                    currentThreadChat !== undefined
                                    && newMessage.chatId === currentThreadChat.chatId
                                    && newThreadMessage.threadId === currentThreadChat.threadId
                                ) {
                                    setCurrentThreadChat(updatedThreadChat);
                                }
                            }
                        } else {
                            if (newMessage.sender.userId === myself.userId) {
                                console.log("GM thread from myself")
                                fromMe = true
                            } else {
                                console.log("GM thread from someone")
                            }

                            if (fromMe === false) {
                                addThreadMessage(newThreadMessage, newMessage.isDm);
                                if (
                                    currentThreadChat !== undefined
                                    && newMessage.chatId === currentThreadChat.chatId
                                    && newThreadMessage.threadId === currentThreadChat.threadId
                                ) {
                                    setCurrentThreadChat(updatedThreadChat);
                                }
                            }
                        }
                    }
                } else {
                    const newMessage: NewMessageProps = message;
                    const newChatMessage: MessageProps = {
                        messageIdWithChatId: `${newMessage.chatId}-${newMessage.messageId}`,
                        chatId: newMessage.chatId,
                        messageId: newMessage.messageId,
                        content: newMessage.content,
                        contentText: newMessage.contentText,
                        sender: newMessage.sender,
                        numReplies: newMessage.numReplies,
                        tsSent: newMessage.tsSent,
                    }
                    const updatedChat: ChatProps = {
                        chatId: newMessage.chatId,
                        chatName: newMessage.chatName,
                        isDm: newMessage.isDm,
                        dmPartnerUserId: newMessage.isDm ? newMessage.dmPartnerUserId : null,
                        unread: false,
                        messages: [...currentMainChat.messages, newMessage],
                        latestMessage: newMessage,
                        latestMessageText: newMessage.contentText,
                        TSLastMessage: newMessage.tsSent,
                    };
                    if (updatedChat && newChatMessage) {
                        if (message.isDm === true) {
                            if (newMessage.dmPartnerUserId === myself.userId) {
                                if (newMessage.dmPartnerUserId === newMessage.sender.userId) {
                                    console.log("Personal DM")
                                    fromMe = true
                                    toMe = true
                                } else {
                                    console.log("DM from my friend")
                                    toMe = true
                                }
                            } else {
                                if (newMessage.sender.userId === myself.userId) {
                                    console.log("DM from myself")
                                    fromMe = true
                                    toMe = true
                                } else {
                                    console.log("DM not for me")
                                }
                            }

                            if (fromMe === false && toMe === true) {
                                await addMessage(newChatMessage, newMessage.isDm)
                                await updateChat(newMessage, newChatMessage)

                                if (newMessage.chatId === currentMainChat.chatId || currentMainChat.chatId === -1) {
                                    setCurrentMainChat(updatedChat);
                                } else if (newMessage.chatId === currentSubChat?.chatId) {
                                    setCurrentSubChat(updatedChat);
                                } else {
                                    console.log("Unexpected DM (newMessage.chatId):", newMessage.chatId)
                                    console.log("Unexpected DM (currentMainChat.chatId):", currentMainChat.chatId)
                                    console.log("Unexpected DM (currentSubChat.chatId):", currentSubChat?.chatId)
                                }

                            }
                            else if (fromMe === true && toMe === true) {
                                // Only updating indexedDB for chat, not updating messaging pane
                                await addMessage(newChatMessage, newMessage.isDm)
                                await updateChat(newMessage, newChatMessage)

                                // Insert the message when a user selects a new user
                                // for DM from Search list in ChatPane
                                if (newMessage.chatName !== newMessage.sender.userName) {
                                    addMessage(newChatMessage, newMessage.isDm)
                                }
                            }
                        } else {
                            if (newMessage.sender.userId === myself.userId) {
                                console.log("GM from myself")
                                fromMe = true
                            } else {
                                console.log("GM from someone")
                            }

                            if (fromMe === false) {
                                if (allChats.length > 0) {
                                    await addMessage(newChatMessage, newMessage.isDm)
                                    await updateChat(newMessage, newChatMessage)

                                    if (newMessage.chatId === currentMainChat.chatId) {
                                        setCurrentMainChat(updatedChat);
                                    } else if (newMessage.chatId === currentSubChat?.chatId) {
                                        setCurrentSubChat(updatedChat);
                                    } else {
                                        console.log("Unexpected GM (newMessage.chatId):", newMessage.chatId)
                                        console.log("Unexpected GM (currentMainChat.chatId):", currentMainChat.chatId)
                                        console.log("Unexpected GM (currentSubChat.chatId):", currentSubChat?.chatId)
                                    }
                                }
                            }
                            else if (fromMe) {
                                // Only updating indexedDB for chat, not updating messaging pane
                                await addMessage(newChatMessage, newMessage.isDm)
                                await updateChat(newMessage, newChatMessage)
                            }
                        }
                    }
                }
            }
        });
        return () => {
            socket.off("message");
            socket.off("connect");
        };
    }, [accessToken, allChats, currentMainChat, currentSubChat, currentThreadChat]);
}