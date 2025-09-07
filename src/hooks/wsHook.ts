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

function isInArray<T>(item: T, array: T[]): boolean {
    return array.includes(item);
}

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

    const makeDMUpdatedChat = async (newMessage: NewMessageProps): Promise<ChatProps> => {
        const updatedChat = await popSpecificMessages(newMessage.chatId, newMessage.chatType);
        return {
            chatId: newMessage.chatId,
            chatName: newMessage.sender.userName,
            systemUserId: newMessage.systemUserId,
            chatType: newMessage.chatType,
            dmPartnerUser: newMessage.sender,
            unread: false,
            messages: updatedChat,
            latestMessage: newMessage,
            latestMessageText: newMessage.contentText,
            TSLastMessage: newMessage.tsSent,
            project: newMessage.project,
        };
    };

    const makeGMUpdatedChat = async (newMessage: NewMessageProps): Promise<ChatProps> => {
        const updatedChat = await popSpecificMessages(newMessage.chatId, newMessage.chatType);
        return {
            chatId: newMessage.chatId,
            chatName: newMessage.chatName,
            systemUserId: newMessage.systemUserId,
            chatType: newMessage.chatType,
            dmPartnerUser: null,
            unread: false,
            messages: updatedChat,
            latestMessage: newMessage,
            latestMessageText: newMessage.contentText,
            TSLastMessage: newMessage.tsSent,
            project: newMessage.project,
        };
    };

    const makePMUpdatedChat = async (newMessage: NewMessageProps): Promise<ChatProps> => {
        const updatedChat = await popSpecificMessages(newMessage.chatId, newMessage.chatType);
        return {
            chatId: newMessage.chatId,
            chatName: newMessage.chatName,
            systemUserId: newMessage.systemUserId,
            chatType: newMessage.chatType,
            dmPartnerUser: null,
            unread: false,
            messages: updatedChat,
            latestMessage: newMessage,
            latestMessageText: newMessage.contentText,
            TSLastMessage: newMessage.tsSent,
            project: newMessage.project,
        };
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
            messageIdWithChatIdAndThreadId:
                newThreadMessage.chatType === 3
                    ? `${newThreadMessage.chatId}-${newThreadMessage.threadId}-${newThreadMessage.messageId}`
                    : `${newThreadMessage.chatId}-${newThreadMessage.taskId}-${newThreadMessage.messageId}`,
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
            console.error("socket is null");
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
                            messageIdWithChatIdAndThreadId:
                                newMessage.chatType === 3
                                    ? `${newMessage.chatId}-${newMessage.threadId}-${newMessage.messageId}`
                                    : `${newMessage.chatId}-${newMessage.taskId}-${newMessage.messageId}`,
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

                        // chatName: If it's DM message, chat name will be the sender name.
                        //           If it's GM or PM message, it'll be newMessage.chatName.
                        const updatedThreadChat: ThreadProps = {
                            chatId: newMessage.chatId,
                            chatName:
                                newMessage.chatType === 1
                                    ? newMessage.sender.userName
                                    : newMessage.chatName,
                            systemUserId: newMessage.systemUserId,
                            threadId: newThreadMessage.threadId,
                            chatType: newMessage.chatType,
                            dmPartnerUser: newMessage.sender,
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
                                        // Do nothing because it's someone edited his/her DM thread, not related to me.
                                    } else {
                                        // Put the edited thread message into the indexedDB.
                                        await putThreadMessageHandler(newMessage);
                                    }
                                } else {
                                    // Add the new thread message to the indexedDB only if the message is from my friend, not from me.
                                    if (fromMe === false && toMe === true) {
                                        addThreadMessage(newThreadMessage, newMessage.chatType);

                                        // If an user is opening the thread and get the new message, update the thread to show the message.
                                        if (
                                            currentThreadChat &&
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
                                    // Put the edited thread message into the indexedDB.
                                    await putThreadMessageHandler(newMessage);
                                } else {
                                    // Add the new thread message to the indexedDB only if the message is from someone, not from me.
                                    if (fromMe === false) {
                                        addThreadMessage(newThreadMessage, newMessage.chatType);

                                        // If an user is opening the thread and get the new message, update the thread to show the message.
                                        if (
                                            currentThreadChat &&
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
                                    // Put the edited thread message into the indexedDB.
                                    await putThreadMessageHandler(newMessage);
                                } else {
                                    // Add the new thread message to the indexedDB only if the message is from someone, not from me.
                                    if (fromMe === false) {
                                        addThreadMessage(newThreadMessage, newMessage.chatType);

                                        // If an user is opening the thread and get the new message, update the thread to show the message.
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

                                // Add the message sent from dm partner into the indexedDB.
                                await addMessage(newChatMessage, newMessage.chatType);

                                // Prepare a new/updated chat object from the new message for DM
                                const updatedChat = await makeDMUpdatedChat(newMessage);

                                if (newMessage.isEdited === true) {
                                    if (fromMe === false && toMe === false) {
                                        // Do nothing because it's someone edited his/her DM, not related to me.
                                    } else {
                                        // Put the edited message into the indexedDB.
                                        // TODO: If the edited message is the latest/most recent message,
                                        // then run updateAllChat() as well to update the chat sidebar.

                                        // If an user is opening the chat of the new message now using MAIN chat pane,
                                        // update the MAIN chat by appending the new message.
                                        if (
                                            currentMainChat &&
                                            newMessage.chatId === currentMainChat.chatId
                                        ) {
                                            setCurrentMainChat(updatedChat);
                                        }
                                        // If an user is opening the chat of the new message now using SUB chat pane,
                                        // update the SUB chat by appending the new message.
                                        else if (
                                            currentSubChat &&
                                            newMessage.chatId === currentSubChat.chatId
                                        ) {
                                            setCurrentSubChat(updatedChat);
                                        }
                                    }
                                } else {
                                    if (fromMe === false && toMe === true) {
                                        // If the new message is from my friend, not from me.

                                        // Update chat sidebar if the message not reaction-related.
                                        if (newMessage.isReactionUpdated === false) {
                                            await updateAllChat(updatedChat, newChatMessage);
                                        }

                                        // If an user is opening the chat of the new message now using MAIN chat pane,
                                        // update the MAIN chat by appending the new message.
                                        if (
                                            currentMainChat &&
                                            newMessage.chatId === currentMainChat?.chatId
                                        ) {
                                            setCurrentMainChat(updatedChat);
                                        }
                                        // If an user is opening the chat of the new message now using SUB chat pane,
                                        // update the SUB chat by appending the new message.
                                        else if (
                                            currentSubChat &&
                                            newMessage.chatId === currentSubChat.chatId
                                        ) {
                                            setCurrentSubChat(updatedChat);
                                        }
                                    } else if (fromMe === true) {
                                        // If the message is from me.
                                        // Update the chat sidebar and message section only when the message is from my friends.
                                        // If the message is from myself, do nothing because the chat sidebar and message section
                                        // are already updated when I sent the message from the Editor component.
                                    } else {
                                        // Do nothing cause it's a DM for others.
                                    }
                                }
                            } else if (newMessage.chatType === 2) {
                                if (newMessage.sender.userId === myself.userId) {
                                    console.log("GM from myself");
                                    fromMe = true;
                                } else {
                                    console.log("GM from someone");
                                }

                                // Add the new message into the indexedDB.
                                await addMessage(newChatMessage, newMessage.chatType);

                                // Prepare a new/updated chat object from the new message for GM
                                const updatedChat = await makeGMUpdatedChat(newMessage);

                                if (newMessage.isEdited === true) {
                                    // Put the edited message into the indexedDB.
                                    // TODO: If the edited message is the latest/most recent message,
                                    // then run updateAllChat() as well to update the chat sidebar.

                                    // If an user is opening the chat of the new message now using MAIN chat pane,
                                    // update the MAIN chat by appending the new message.
                                    if (
                                        currentMainChat &&
                                        newMessage.chatId === currentMainChat.chatId
                                    ) {
                                        setCurrentMainChat(updatedChat);
                                    }
                                    // If an user is opening the chat of the new message now using SUB chat pane,
                                    // update the SUB chat by appending the new message.
                                    else if (
                                        currentSubChat &&
                                        newMessage.chatId === currentSubChat.chatId
                                    ) {
                                        setCurrentSubChat(updatedChat);
                                    }
                                } else {
                                    if (fromMe === false) {
                                        // allChats.length > 0 <- what's this??
                                        if (allChats.length > 0) {
                                            // Update chat sidebar if the message not reaction-related.
                                            if (newMessage.isReactionUpdated === false) {
                                                await updateAllChat(updatedChat, newChatMessage);
                                            }

                                            // If an user is opening the chat of the new message now using MAIN chat pane,
                                            // update the MAIN chat by appending the new message.
                                            if (
                                                currentMainChat &&
                                                newMessage.chatId === currentMainChat.chatId
                                            ) {
                                                setCurrentMainChat(updatedChat);
                                            }
                                            // If an user is opening the chat of the new message now using SUB chat pane,
                                            // update the SUB chat by appending the new message.
                                            else if (
                                                currentSubChat &&
                                                newMessage.chatId === currentSubChat.chatId
                                            ) {
                                                setCurrentSubChat(updatedChat);
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

                                // Add the new message into the indexedDB.
                                await addMessage(newChatMessage, newMessage.chatType);

                                // Prepare a new/updated chat object from the new message for PM
                                const updatedChat = await makePMUpdatedChat(newMessage);

                                if (newMessage.isEdited === true) {
                                    // As of now, no one can edit PM message, but a system user can.
                                    // But an user can edit PM thread message tho.

                                    // If an user is opening the chat of the new message now using MAIN chat pane,
                                    // update the MAIN chat by appending the new message.
                                    if (
                                        currentMainChat &&
                                        newMessage.chatId === currentMainChat.chatId
                                    ) {
                                        setCurrentMainChat(updatedChat);
                                    }
                                    // If an user is opening the chat of the new message now using SUB chat pane,
                                    // update the SUB chat by appending the new message.
                                    else if (
                                        currentSubChat &&
                                        newMessage.chatId === currentSubChat.chatId
                                    ) {
                                        setCurrentSubChat(updatedChat);
                                    }
                                } else {
                                    if (fromMe === false) {
                                        // allChats.length > 0 <- what's this??
                                        if (allChats.length > 0) {
                                            // Update chat sidebar if the message not reaction-related.
                                            if (newMessage.isReactionUpdated === false) {
                                                await updateAllChat(updatedChat, newChatMessage);
                                            }

                                            // If an user is opening the chat of the new message now using MAIN chat pane,
                                            // update the MAIN chat by appending the new message.
                                            if (
                                                currentMainChat &&
                                                newMessage.chatId === currentMainChat.chatId
                                            ) {
                                                setCurrentMainChat(updatedChat);
                                            }
                                            // If an user is opening the chat of the new message now using SUB chat pane,
                                            // update the SUB chat by appending the new message.
                                            else if (
                                                currentSubChat &&
                                                newMessage.chatId === currentSubChat.chatId
                                            ) {
                                                setCurrentSubChat(updatedChat);
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

                const tmpNewActivityMessage: ActivityMessageProps = message;
                let newActivityMessage: ActivityMessageProps;
                if (tmpNewActivityMessage) {
                    if (tmpNewActivityMessage.activityType !== 2) {
                        // For mention and thread activities
                        if (
                            tmpNewActivityMessage.mentionedUserIds &&
                            isInArray(myself.userId, tmpNewActivityMessage.mentionedUserIds)
                        ) {
                            // If the message is GM or PM, check if the user is mentioned in the message.
                            // If the user is mentioned, update activityId and activityType.
                            const activityType = 3;
                            const chatType = tmpNewActivityMessage.chatType;
                            const chatId = tmpNewActivityMessage.chatId;
                            const threadId = tmpNewActivityMessage.threadId;
                            const messageId = tmpNewActivityMessage.messageId;
                            let newActivityId: string;
                            if (tmpNewActivityMessage.isThread === true) {
                                newActivityId = `${activityType}-${chatType}-${chatId}-${threadId}-${messageId}`;
                            } else {
                                newActivityId = `${activityType}-${chatType}-${chatId}-${messageId}`;
                            }
                            newActivityMessage = {
                                ...tmpNewActivityMessage,
                                activityId: newActivityId,
                                activityType: activityType,
                            };
                        } else {
                            // DM message or non-mentioned GM/PM message
                            newActivityMessage = tmpNewActivityMessage;
                        }

                        if (newActivityMessage) {
                            await addActivityMessage(newActivityMessage);
                            funcSetActivityMessages();
                        }
                    } else {
                        // For reaction activities.
                        // Only if the mentioned message is mine, define newActivityMessage.
                        // If not, ignore.
                        if (myself.userId === tmpNewActivityMessage.sender.userId) {
                            await addActivityMessage(tmpNewActivityMessage);
                            funcSetActivityMessages();
                        }
                    }
                }
            } else if (message.wsType === "userStatus") {
                const user: UserProps = message.user;

                await addUser(user);
            }
        });

        return () => {
            socket.off("message");
            socket.off("connect");
        };
    }, [accessToken, isLoading, allChats, currentMainChat, currentSubChat, currentThreadChat]);
};
