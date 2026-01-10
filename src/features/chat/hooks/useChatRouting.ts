import { useCallback, useEffect, useRef } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";

import { useAuth } from "../../../context/AuthContext";
import { ChatManagementState } from "../../../hooks/chats/useChatManagement";
import { TaskManagementState } from "../../../hooks/tasks/useTaskManagement";
import { UserProps } from "../../../types/admin";
import { ChatProps, MessageProps, ThreadMessageProps, ThreadProps } from "../../../types/chat";
import { getLocalCurrentTimestamp } from "../../../utils/dateUtils";
import { loadSpecificThreadMessages } from "../services/loadSpecificThreadMessages";
import { popSpecificMessages } from "../services/popSpecificMessages";

// Chat type constants matching the existing codebase
const CHAT_TYPE_MAP: Record<string, number> = {
    dm: 1,
    gm: 2,
    pm: 3,
    activity: 5,
    flagged: 6,
};

const CHAT_TYPE_REVERSE_MAP: Record<number, string> = {
    1: "dm",
    2: "gm",
    3: "pm",
    5: "activity",
    6: "flagged",
};

type UseChatRoutingProps = {
    useCM: ChatManagementState;
    useTM: TaskManagementState;
    myself: UserProps;
};

type ChatRouteParams = {
    chatType?: string;
    chatId?: string;
    threadId?: string;
    messageId?: string;
};

export const useChatRouting = ({ useCM, useTM, myself }: UseChatRoutingProps) => {
    const { accessToken } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();
    const params = useParams<ChatRouteParams>();

    // Ref to track if we're currently navigating from URL (to avoid circular updates)
    const isNavigatingFromUrl = useRef(false);
    // Ref to track the last URL we navigated to (to avoid duplicate navigations)
    const lastNavigatedPath = useRef("");

    // Parse the current URL to extract chat routing info
    const parseCurrentRoute = useCallback(() => {
        const pathParts = location.pathname.split("/").filter(Boolean);
        // Expected format: /home/chat/:chatType/:chatId?/thread/:threadId?/message/:messageId?

        const result: {
            chatType: string | undefined;
            chatId: number | undefined;
            threadId: number | undefined;
            messageId: number | undefined;
        } = {
            chatType: undefined,
            chatId: undefined,
            threadId: undefined,
            messageId: undefined,
        };

        const chatIndex = pathParts.indexOf("chat");
        if (chatIndex === -1) return result;

        // Get chat type (dm, gm, pm, activity, flagged)
        if (pathParts[chatIndex + 1]) {
            result.chatType = pathParts[chatIndex + 1];
        }

        // Get chat ID
        if (pathParts[chatIndex + 2] && !isNaN(Number(pathParts[chatIndex + 2]))) {
            result.chatId = Number(pathParts[chatIndex + 2]);
        }

        // Look for thread
        const threadIndex = pathParts.indexOf("thread");
        if (threadIndex !== -1 && pathParts[threadIndex + 1]) {
            result.threadId = Number(pathParts[threadIndex + 1]);
        }

        // Look for message
        const messageIndex = pathParts.indexOf("message");
        if (messageIndex !== -1 && pathParts[messageIndex + 1]) {
            result.messageId = Number(pathParts[messageIndex + 1]);
        }

        return result;
    }, [location.pathname]);

    // Navigate to a specific chat type
    const navigateToChatType = useCallback(
        (chatType: number) => {
            const typePath = CHAT_TYPE_REVERSE_MAP[chatType];
            if (typePath) {
                navigate(`/home/chat/${typePath}`);
            }
        },
        [navigate]
    );

    // Navigate to a specific chat
    const navigateToChat = useCallback(
        (chatType: number, chatId: number) => {
            const typePath = CHAT_TYPE_REVERSE_MAP[chatType];
            if (typePath) {
                navigate(`/home/chat/${typePath}/${chatId}`);
            }
        },
        [navigate]
    );

    // Navigate to a specific thread
    const navigateToThread = useCallback(
        (chatType: number, chatId: number, threadId: number) => {
            const typePath = CHAT_TYPE_REVERSE_MAP[chatType];
            if (typePath) {
                navigate(`/home/chat/${typePath}/${chatId}/thread/${threadId}`);
            }
        },
        [navigate]
    );

    // Navigate to a specific message
    const navigateToMessage = useCallback(
        (chatType: number, chatId: number, messageId: number) => {
            const typePath = CHAT_TYPE_REVERSE_MAP[chatType];
            if (typePath) {
                navigate(`/home/chat/${typePath}/${chatId}/message/${messageId}`);
            }
        },
        [navigate]
    );

    // Navigate to a specific message in a thread
    const navigateToThreadMessage = useCallback(
        (chatType: number, chatId: number, threadId: number, messageId: number) => {
            const typePath = CHAT_TYPE_REVERSE_MAP[chatType];
            if (typePath) {
                navigate(
                    `/home/chat/${typePath}/${chatId}/thread/${threadId}/message/${messageId}`
                );
            }
        },
        [navigate]
    );

    // Get current chat type from URL
    const getCurrentChatTypeFromUrl = useCallback((): number => {
        const { chatType } = parseCurrentRoute();
        if (chatType && CHAT_TYPE_MAP[chatType]) {
            return CHAT_TYPE_MAP[chatType];
        }
        return 1; // Default to DM
    }, [parseCurrentRoute]);

    // Sync URL with chat state on initial load or URL change
    useEffect(() => {
        const { chatType, chatId, threadId, messageId } = parseCurrentRoute();

        // If no chat type in URL, redirect to default (dm)
        if (!chatType) {
            const lastChatType = localStorage.getItem("lastChatType");
            const defaultType = lastChatType ? CHAT_TYPE_REVERSE_MAP[Number(lastChatType)] : "dm";
            navigate(`/home/chat/${defaultType || "dm"}`, { replace: true });
            return;
        }

        // Update chat pane type from URL
        const paneType = CHAT_TYPE_MAP[chatType];
        if (paneType && useCM.currentChatPaneType !== paneType) {
            useCM.setCurrentChatPaneType(paneType);
            localStorage.setItem("currentChatPaneType", paneType.toString());
        }

        // If there's a chatId in the URL and allChats is loaded, load that chat
        if (chatId && paneType && useCM.allChats.length > 0) {
            const existingChat = useCM.allChats.find((c) => c.chatId === chatId);

            // If chat is already loaded but we need to focus on a specific message
            if (
                existingChat &&
                useCM.currentMainChat?.chatId === chatId &&
                messageId &&
                threadId === undefined
            ) {
                const newMoveIndex = `${chatId}-${messageId}`;
                if (useCM.currentMainChat.moveToSpecificIndex !== newMoveIndex) {
                    useCM.setCurrentMainChat({
                        ...useCM.currentMainChat,
                        moveToSpecificIndex: newMoveIndex,
                    });
                }
            }
            // If it's a different chat, load it
            else if (existingChat && useCM.currentMainChat?.chatId !== chatId) {
                // Mark that we're navigating from URL
                isNavigatingFromUrl.current = true;

                // Load messages for this chat
                popSpecificMessages(chatId, existingChat.chatType)
                    .then((messages: MessageProps[]) => {
                        if (messages.length > 0) {
                            const newChat: ChatProps = {
                                chatId: existingChat.chatId,
                                chatName: existingChat.chatName,
                                chatType: existingChat.chatType,
                                dmPartnerUser: existingChat.dmPartnerUser,
                                lastReadMessageId: messages[messages.length - 1].messageId,
                                messages: messages,
                                latestMessage: existingChat.latestMessage,
                                latestMessageText: existingChat.latestMessageText,
                                TSLastMessage: existingChat.TSLastMessage,
                                systemUserId: existingChat.systemUserId,
                                project: existingChat.project,
                                isPrivate: existingChat.isPrivate,
                                profileImagePath: existingChat.profileImagePath,
                                moveToSpecificIndex:
                                    messageId && useCM.currentMainChat?.chatId !== -1
                                        ? `${chatId}-${messageId}`
                                        : undefined,
                            };
                            useCM.setCurrentMainChat(newChat);
                            useCM.setIsMainChatVisible(true);
                        }
                    })
                    .catch((error) => console.error("Error loading chat from URL:", error))
                    .finally(() => {
                        // Reset the flag after a short delay
                        setTimeout(() => {
                            isNavigatingFromUrl.current = false;
                        }, 100);
                    });
            }
        }

        // Handle thread message from URL
        if (
            chatId &&
            threadId &&
            (useCM.currentThreadChat === undefined ||
                useCM.currentThreadChat?.threadId !== threadId)
        ) {
            loadSpecificThreadMessages(
                myself,
                CHAT_TYPE_MAP[chatType],
                chatId,
                threadId,
                accessToken
            ).then((threadMessages: ThreadMessageProps[]) => {
                if (threadMessages && threadMessages.length > 0) {
                    const newThread: ThreadProps = {
                        chatId: chatId,
                        chatName: useCM.currentMainChat?.chatName || "",
                        threadId: threadId,
                        chatType: CHAT_TYPE_MAP[chatType],
                        dmPartnerUser: myself,
                        taskId: threadMessages[0].taskId || null,
                        messages: threadMessages,
                        project: threadMessages[0].project,
                        TSLastMessage: getLocalCurrentTimestamp(),
                        taskExist: threadMessages[0].taskExist,
                        moveToSpecificIndex: messageId
                            ? `${chatId}-${threadId}-${messageId}`
                            : undefined,
                    };
                    if (newThread) {
                        console.log(newThread);
                        useCM.setCurrentThreadChat(newThread);
                        if (newThread.taskExist === true && threadMessages[0].taskId) {
                            useTM.setCurrentPreviewTaskId(threadMessages[0].taskId);
                        }
                    }
                }

                // Open thread chat
                useCM.setIsThreadVisible(true);
            });
        }
    }, [location.pathname, useCM.allChats.length]);

    // Update URL when main chat changes (user navigates via UI)
    useEffect(() => {
        const { chatId } = parseCurrentRoute();

        // Skip if we're currently navigating from URL (to avoid circular updates)
        if (isNavigatingFromUrl.current || chatId === useCM.currentMainChat?.chatId) {
            return;
        }

        if (useCM.currentMainChat && useCM.currentMainChat.chatId !== -1) {
            const chatType = useCM.currentMainChat.chatType;
            const chatId = useCM.currentMainChat.chatId;
            const typePath = CHAT_TYPE_REVERSE_MAP[chatType];

            if (typePath) {
                const newPath = `/home/chat/${typePath}/${chatId}`;
                // Only update if path is different
                if (newPath !== location.pathname && newPath !== lastNavigatedPath.current) {
                    lastNavigatedPath.current = newPath;
                    navigate(newPath, { replace: true });
                }
            }
        }
    }, [useCM.currentMainChat?.chatId]);

    // Update URL when thread opens
    useEffect(() => {
        if (
            useCM.isThreadVisible &&
            useCM.currentThreadChat &&
            useCM.currentMainChat &&
            useCM.currentMainChat.chatId !== -1
        ) {
            const chatType = useCM.currentMainChat.chatType;
            const chatId = useCM.currentMainChat.chatId;
            const threadId = useCM.currentThreadChat.chatId;
            const typePath = CHAT_TYPE_REVERSE_MAP[chatType];

            if (typePath) {
                navigate(`/home/chat/${typePath}/${chatId}/thread/${threadId}`, { replace: true });
            }
        }
    }, [useCM.isThreadVisible, useCM.currentThreadChat?.chatId]);

    return {
        parseCurrentRoute,
        navigateToChatType,
        navigateToChat,
        navigateToThread,
        navigateToMessage,
        navigateToThreadMessage,
        getCurrentChatTypeFromUrl,
        CHAT_TYPE_MAP,
        CHAT_TYPE_REVERSE_MAP,
    };
};
