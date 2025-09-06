import { useEffect } from "react";
import { Socket } from "socket.io-client";

import { addUser } from "../features/admin/services/addUser";
import { addChat } from "../features/chat/services/addChat";
import { addActivityMessage } from "../features/chat/services/addActivityMessage";
import { addMessage } from "../features/chat/services/addMessage";
import { addThreadMessage } from "../features/chat/services/addThreadMessage";
import { popSpecificMessages } from "../features/chat/services/popSpecificMessages";
import { loadSpecificThreadMessages } from "../features/chat/services/loadSpecificThreadMessages";
import { UserProps } from "../types/admin";
import {
    AllChatProps,
    ChatProps,
    MessageProps,
    ThreadMessageProps,
    NewMessageProps,
    NewThreadMessageProps,
    ThreadProps,
    ActivityMessageProps,
} from "../types/chat";
import { getCurrentTimestamp } from "../utils/dateUtils";

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
    funcSetAllChats: () => void;
    setIsTaskCommentUpdated: (value: boolean) => void;
    isLoading: boolean;
    funcSetActivityMessages: () => void;
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
        funcSetAllChats,
        setIsTaskCommentUpdated,
        isLoading,
        funcSetActivityMessages,
    } = props;

    const updateAllChat = async (currentChat: ChatProps, newChatMessage: MessageProps) => {
        const newChat: AllChatProps = {
            chatId: currentChat.chatId,
            chatName: currentChat.chatName,
            chatType: currentChat.chatType,
            systemUserId: currentChat.systemUserId,
            dmPartnerUser: currentChat.dmPartnerUser,
            unread: true,
            latestMessage: newChatMessage,
            latestMessageText: newChatMessage.contentText,
            TSLastMessage: newChatMessage.tsSent,
        };
        if (newChat) {
            await addChat(newChat, currentChat.chatType);
            funcSetAllChats();
        }
    };

    const makeUpdatedChat = async (
        currentChat: ChatProps,
        newMessage: NewMessageProps
    ): Promise<ChatProps> => {
        const updatedChat = await popSpecificMessages(currentChat.chatId, currentChat.chatType);
        return {
            chatId: currentChat.chatId,
            chatName: currentChat.chatName,
            systemUserId: currentChat.systemUserId,
            chatType: currentChat.chatType,
            dmPartnerUser: currentChat.dmPartnerUser,
            unread: false,
            messages: updatedChat,
            latestMessage: newMessage,
            latestMessageText: newMessage.contentText,
            TSLastMessage: newMessage.tsSent,
            project: currentChat.project,
        };
    };

    const putMessageHandler = async (newMessage: NewMessageProps) => {
        const newChatMessage: MessageProps = {
            chatType: newMessage.chatType,
            messageIdWithChatId:
                newMessage.chatType === 3
                    ? `${newMessage.chatId}-${newMessage.taskId}`
                    : `${newMessage.chatId}-${newMessage.messageId}`,
            chatId: newMessage.chatId,
            messageId: newMessage.messageId,
            content: newMessage.content,
            contentText: newMessage.contentText,
            reactions: newMessage.reactions,
            sender: newMessage.sender,
            tsSent: newMessage.tsSent,
            tsUpdated: newMessage.tsUpdated,
            numReplies: newMessage.numReplies,
            taskId: newMessage.taskId,
            taskStatus: newMessage.taskStatus,
        };

        await addMessage(newChatMessage, newChatMessage.chatType);

        if (newMessage.chatId === currentMainChat?.chatId || currentMainChat?.chatId === -1) {
            const updatedChat = await makeUpdatedChat(currentMainChat, newMessage);
            setCurrentMainChat(updatedChat);
            if (newMessage.isReactionUpdated === false) {
                await updateAllChat(currentMainChat, newChatMessage);
            }
        } else if (newMessage.chatId === currentSubChat?.chatId) {
            const updatedChat = await makeUpdatedChat(currentSubChat, newMessage);
            setCurrentSubChat(updatedChat);
            if (newMessage.isReactionUpdated === false) {
                await updateAllChat(currentSubChat, newChatMessage);
            }
        }
    };

    const makeUpdatedThreadChat = async (
        currentThread: ThreadProps,
        newMessage: NewThreadMessageProps
    ): Promise<ThreadProps> => {
        const updatedMessages: ThreadMessageProps[] = await loadSpecificThreadMessages(
            myself,
            currentThread.chatType,
            currentThread.chatId,
            currentThread.threadId,
            accessToken
        );
        return {
            chatType: currentThread.chatType,
            chatId: currentThread.chatId,
            chatName: currentThread.chatName,
            systemUserId: currentThread.systemUserId,
            threadId: currentThread.threadId,
            dmPartnerUser: currentThread.dmPartnerUser,
            taskId: currentThread.taskId,
            unread: false,
            messages: updatedMessages,
            TSLastMessage: newMessage.tsSent,
            project: newMessage.project,
            taskExist: currentThread.taskId ? true : false,
        };
    };

    const putThreadMessageHandler = async (newThreadMessage: NewThreadMessageProps) => {
        const newChatMessage: ThreadMessageProps = {
            chatType: newThreadMessage.chatType,
            messageIdWithChatIdAndThreadId: `${newThreadMessage.chatId}-${newThreadMessage.threadId}-${newThreadMessage.messageId}`,
            chatId: newThreadMessage.chatId,
            threadId: newThreadMessage.threadId,
            messageId: newThreadMessage.messageId,
            content: newThreadMessage.content,
            contentText: newThreadMessage.contentText,
            reactions: newThreadMessage.reactions,
            sender: newThreadMessage.sender,
            tsSent: newThreadMessage.tsSent,
            tsUpdated: newThreadMessage.tsUpdated,
            taskId: newThreadMessage.taskId,
        };

        await addThreadMessage(newChatMessage, newChatMessage.chatType);

        if (
            currentThreadChat !== undefined &&
            newThreadMessage.chatId === currentThreadChat.chatId &&
            newThreadMessage.threadId === currentThreadChat.threadId
        ) {
            const updatedThreadChat = await makeUpdatedThreadChat(
                currentThreadChat,
                newThreadMessage
            );
            setCurrentThreadChat(updatedThreadChat);
        }
    };

    useEffect(() => {
        if (socket === null) {
            return;
        }

        const intervalId = setInterval(() => {
            const isOfflineForced: string = localStorage.getItem("isOfflineForced") || "false";
            const role: string = localStorage.getItem("role") || "";
            const baseCountry: string = localStorage.getItem("baseCountry") || "";
            const customStatus: string = localStorage.getItem("customStatus") || "";

            socket.emit("heartbeat", {
                message: "alive",
                is_online: true,
                user: {
                    ...myself,
                    isOfflineForced: isOfflineForced,
                    role: role,
                    baseCountry: baseCountry,
                    customStatus: customStatus,
                    tsLastSeen: getCurrentTimestamp(),
                },
            });
        }, 5_000);

        socket.on("connect", () => {
            console.log("WS connected");
        });

        socket.on("auth_error", (data) => {
            console.error("Authentication Error:", data.message);
            // alert(`Error: ${data.message}`);
        });

        socket.on("message", async (message) => {
            if (message.wsType === "chat") {
                console.log("chat_message:", message);
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
                            reactions: newMessage.reactions,
                            sender: newMessage.sender,
                            tsSent: newMessage.tsSent,
                            tsUpdated: newMessage.tsUpdated,
                            taskId: newMessage.taskId,
                        };
                        const updatedThreadChat: ThreadProps = {
                            chatId: newMessage.chatId,
                            chatName: newMessage.chatName,
                            systemUserId: newMessage.systemUserId,
                            threadId: newThreadMessage.threadId,
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

                                if (newMessage.isEdited === true) {
                                    if (fromMe === false && toMe === false) {
                                        // Do nothing because it's someones DM
                                    } else {
                                        await putThreadMessageHandler(newMessage);
                                    }
                                } else {
                                    if (fromMe === false && toMe === true) {
                                        addThreadMessage(newThreadMessage, newMessage.chatType);
                                        if (
                                            currentThreadChat !== undefined &&
                                            newMessage.chatId === currentThreadChat.chatId &&
                                            newThreadMessage.threadId ===
                                                currentThreadChat.threadId
                                        ) {
                                            setCurrentThreadChat(updatedThreadChat);
                                        }
                                    }
                                }
                            } else if (message.chatType === 2) {
                                if (newMessage.sender.userId === myself.userId) {
                                    console.log("GM thread from myself");
                                    fromMe = true;
                                } else {
                                    console.log("GM thread from someone");
                                }

                                if (newMessage.isEdited === true) {
                                    await putThreadMessageHandler(newMessage);
                                } else {
                                    if (fromMe === false) {
                                        addThreadMessage(newThreadMessage, newMessage.chatType);
                                        if (
                                            currentThreadChat !== undefined &&
                                            newMessage.chatId === currentThreadChat.chatId &&
                                            newThreadMessage.threadId ===
                                                currentThreadChat.threadId
                                        ) {
                                            setCurrentThreadChat(updatedThreadChat);
                                        }
                                    }
                                }
                            } else if (newMessage.chatType === 3) {
                                if (newMessage.sender.userId === myself.userId) {
                                    console.log("PM thread from myself");
                                    fromMe = true;
                                } else {
                                    console.log("PM thread from someone");
                                }

                                if (newMessage.isEdited === true) {
                                    await putThreadMessageHandler(newMessage);
                                } else {
                                    if (fromMe === false) {
                                        addThreadMessage(newThreadMessage, newMessage.chatType);
                                        if (
                                            currentThreadChat !== undefined &&
                                            newMessage.chatId === currentThreadChat.chatId &&
                                            newThreadMessage.threadId ===
                                                currentThreadChat.threadId
                                        ) {
                                            setCurrentThreadChat(updatedThreadChat);
                                        }
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
                            reactions: newMessage.reactions,
                            sender: newMessage.sender,
                            numReplies: newMessage.numReplies,
                            tsSent: newMessage.tsSent,
                            tsUpdated: newMessage.tsUpdated,
                            taskId: newMessage.taskId,
                            taskStatus: newMessage.taskStatus,
                        };
                        if (newChatMessage) {
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

                                if (newMessage.isEdited === true) {
                                    if (fromMe === false && toMe === false) {
                                        // Do nothing because it's someones DM
                                    } else {
                                        await putMessageHandler(newMessage);
                                    }
                                } else {
                                    if (fromMe === false && toMe === true) {
                                        await addMessage(newChatMessage, newMessage.chatType);

                                        if (
                                            newMessage.chatId === currentMainChat?.chatId ||
                                            currentMainChat?.chatId === -1
                                        ) {
                                            const updatedChat = await makeUpdatedChat(
                                                currentMainChat,
                                                newMessage
                                            );
                                            setCurrentMainChat(updatedChat);
                                            if (newMessage.isReactionUpdated === false) {
                                                await updateAllChat(
                                                    currentMainChat,
                                                    newChatMessage
                                                );
                                            }
                                        } else if (newMessage.chatId === currentSubChat?.chatId) {
                                            const updatedChat = await makeUpdatedChat(
                                                currentSubChat,
                                                newMessage
                                            );
                                            setCurrentSubChat(updatedChat);
                                            if (newMessage.isReactionUpdated === false) {
                                                await updateAllChat(
                                                    currentSubChat,
                                                    newChatMessage
                                                );
                                            }
                                        }
                                    } else if (fromMe === true) {
                                        // Do nothing cause adding the new message
                                        // and updating chat are done by Editor component.
                                    } else {
                                        // Do nothing cause it's DM for others.
                                    }
                                }
                            } else if (newMessage.chatType === 2) {
                                if (newMessage.sender.userId === myself.userId) {
                                    console.log("GM from myself");
                                    fromMe = true;
                                } else {
                                    console.log("GM from someone");
                                }

                                if (newMessage.isEdited === true) {
                                    await putMessageHandler(newMessage);
                                } else {
                                    if (fromMe === false) {
                                        if (allChats.length > 0) {
                                            await addMessage(newChatMessage, newMessage.chatType);

                                            if (newMessage.chatId === currentMainChat?.chatId) {
                                                const updatedChat = await makeUpdatedChat(
                                                    currentMainChat,
                                                    newMessage
                                                );
                                                setCurrentMainChat(updatedChat);
                                                if (newMessage.isReactionUpdated === false) {
                                                    await updateAllChat(
                                                        currentMainChat,
                                                        newChatMessage
                                                    );
                                                }
                                            } else if (
                                                newMessage.chatId === currentSubChat?.chatId
                                            ) {
                                                const updatedChat = await makeUpdatedChat(
                                                    currentSubChat,
                                                    newMessage
                                                );
                                                setCurrentSubChat(updatedChat);
                                                if (newMessage.isReactionUpdated === false) {
                                                    await updateAllChat(
                                                        currentSubChat,
                                                        newChatMessage
                                                    );
                                                }
                                            }
                                        }
                                    } else {
                                        // Do nothing cause adding the new message
                                        // and updating chat are done by Editor component.
                                    }
                                }
                            } else if (newMessage.chatType === 3) {
                                if (newMessage.sender.userId === myself.userId) {
                                    console.log("PM from myself");
                                    fromMe = true;
                                } else {
                                    console.log("PM from someone");
                                }

                                if (newMessage.isEdited === true) {
                                    // As of now, no one can edit PM message.
                                    // PM thread message is editable tho.
                                    await putMessageHandler(newMessage);
                                } else {
                                    if (fromMe === false) {
                                        if (allChats.length > 0) {
                                            await addMessage(newChatMessage, newMessage.chatType);

                                            if (newMessage.chatId === currentMainChat?.chatId) {
                                                const updatedChat = await makeUpdatedChat(
                                                    currentMainChat,
                                                    newMessage
                                                );
                                                setCurrentMainChat(updatedChat);
                                                if (newMessage.isReactionUpdated === false) {
                                                    await updateAllChat(
                                                        currentMainChat,
                                                        newChatMessage
                                                    );
                                                }
                                            } else if (
                                                newMessage.chatId === currentSubChat?.chatId
                                            ) {
                                                const updatedChat = await makeUpdatedChat(
                                                    currentSubChat,
                                                    newMessage
                                                );
                                                setCurrentSubChat(updatedChat);
                                                if (newMessage.isReactionUpdated === false) {
                                                    await updateAllChat(
                                                        currentSubChat,
                                                        newChatMessage
                                                    );
                                                }
                                            }
                                        }
                                    } else {
                                        // Do nothing cause adding the new message
                                        // and updating chat are done by Editor component.
                                    }
                                }
                            } else {
                                console.error("Unknown chatType:", newMessage.chatType);
                            }
                        }
                    }
                }
            } else if (message.wsType === "task") {
                console.log("Got a task comment");
                console.log("task_message:", message);
                if (setIsTaskCommentUpdated) {
                    setIsTaskCommentUpdated(true);
                }
            } else if (message.wsType === "activity") {
                console.log("Got an activity message");
                console.log("activity_message:", message);
                const newActivityMessage: ActivityMessageProps = message;
                if (newActivityMessage) {
                    await addActivityMessage(newActivityMessage);
                    funcSetActivityMessages();
                }
            } else if (message.wsType === "userStatus") {
                const user: UserProps = message.user;

                await addUser(user);
            }
        });

        return () => {
            clearInterval(intervalId);
            socket.off("message");
            socket.off("connect");
        };
    }, [accessToken, isLoading, allChats, currentMainChat, currentSubChat, currentThreadChat]);
};
