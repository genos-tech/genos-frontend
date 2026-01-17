import { useCallback, useEffect, useMemo, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";

import { useAuth } from "../../../context/AuthContext";
import { ChatManagementState } from "../../../hooks/chats/useChatManagement";
import { TaskManagementState } from "../../../hooks/tasks/useTaskManagement";
import { UserProps } from "../../../types/admin";
import { ChatProps, MessageProps, ThreadMessageProps, ThreadProps } from "../../../types/chat";
import { getLocalCurrentTimestamp } from "../../../utils/dateUtils";
import { popSpecificMessages } from "../services/popSpecificMessages";
import { loadSpecificThreadMessagesByTaskId } from "../services/loadSpecificThreadMessagesByTaskId";
import { loadSpecificThreadMessages } from "../services/loadSpecificThreadMessages";

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

// Helper to build chat paths - avoids repeated string concatenations
const buildChatPath = (typePath: string, chatId?: number, threadId?: number, messageId?: number): string => {
    let path = `/home/chat/${typePath}`;
    if (chatId !== undefined) path += `/${chatId}`;
    if (threadId !== undefined) path += `/thread/${threadId}`;
    if (messageId !== undefined) path += `/message/${messageId}`;
    return path;
};

type UseChatRoutingProps = {
    useCM: ChatManagementState;
    useTM: TaskManagementState;
    myself: UserProps;
};

type ParsedRoute = {
    chatType: string | undefined;
    chatId: number | undefined;
    threadId: number | undefined;
    messageId: number | undefined;
};

export const useChatRouting = ({ useCM, useTM, myself }: UseChatRoutingProps) => {
    const { accessToken } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();

    // Ref to track if we're currently navigating from URL (to avoid circular updates)
    const isNavigatingFromUrl = useRef(false);
    // Ref to track the last URL we navigated to (to avoid duplicate navigations)
    const lastNavigatedPath = useRef("");

    // Memoized route parsing - only recalculates when pathname changes
    const parsedRoute = useMemo((): ParsedRoute => {
        const pathParts = location.pathname.split("/").filter(Boolean);
        // Expected format: /home/chat/:chatType/:chatId?/thread/:threadId?/message/:messageId?

        const result: ParsedRoute = {
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

    // Keep parseCurrentRoute for backward compatibility but use memoized value
    const parseCurrentRoute = useCallback(() => parsedRoute, [parsedRoute]);

    // Navigate to a specific chat type
    const navigateToChatType = useCallback(
        (chatType: number) => {
            const typePath = CHAT_TYPE_REVERSE_MAP[chatType];
            if (typePath) {
                navigate(buildChatPath(typePath));
            }
        },
        [navigate]
    );

    // Navigate to a specific chat
    const navigateToChat = useCallback(
        (chatType: number, chatId: number) => {
            const typePath = CHAT_TYPE_REVERSE_MAP[chatType];
            if (typePath) {
                navigate(buildChatPath(typePath, chatId));
            }
        },
        [navigate]
    );

    // Navigate to a specific thread
    const navigateToThread = useCallback(
        (chatType: number, chatId: number, threadId: number) => {
            const typePath = CHAT_TYPE_REVERSE_MAP[chatType];
            if (typePath) {
                navigate(buildChatPath(typePath, chatId, threadId));
            }
        },
        [navigate]
    );

    // Navigate to a specific message
    const navigateToMessage = useCallback(
        (chatType: number, chatId: number, messageId: number) => {
            const typePath = CHAT_TYPE_REVERSE_MAP[chatType];
            if (typePath) {
                navigate(buildChatPath(typePath, chatId, undefined, messageId));
            }
        },
        [navigate]
    );

    // Navigate to a specific message in a thread
    const navigateToThreadMessage = useCallback(
        (chatType: number, chatId: number, threadId: number, messageId: number) => {
            const typePath = CHAT_TYPE_REVERSE_MAP[chatType];
            if (typePath) {
                navigate(buildChatPath(typePath, chatId, threadId, messageId));
            }
        },
        [navigate]
    );

    // Get current chat type from URL - uses memoized parsedRoute directly
    const getCurrentChatTypeFromUrl = useCallback((): number => {
        if (parsedRoute.chatType && CHAT_TYPE_MAP[parsedRoute.chatType]) {
            return CHAT_TYPE_MAP[parsedRoute.chatType];
        }
        return 1; // Default to DM
    }, [parsedRoute.chatType]);

    // Extract values from parsedRoute for more stable dependencies
    const { chatType: urlChatType, chatId: urlChatId, threadId: urlThreadId, messageId: urlMessageId } = parsedRoute;

    // Effect 1: Handle missing chat type - redirect to default
    useEffect(() => {
        if (!urlChatType) {
            const lastChatType = localStorage.getItem("lastChatType");
            const defaultType = lastChatType ? CHAT_TYPE_REVERSE_MAP[Number(lastChatType)] : "dm";
            navigate(buildChatPath(defaultType || "dm"), { replace: true });
        }
    }, [urlChatType, navigate]);

    // Effect 2: Sync chat pane type from URL
    useEffect(() => {
        if (!urlChatType) return;
        
        const paneType = CHAT_TYPE_MAP[urlChatType];
        if (paneType && useCM.currentChatPaneType !== paneType) {
            useCM.setCurrentChatPaneType(paneType);
            localStorage.setItem("currentChatPaneType", paneType.toString());
        }
    }, [urlChatType, useCM.currentChatPaneType, useCM.setCurrentChatPaneType]);

    // Effect 3: Handle main chat navigation from URL
    useEffect(() => {
        if (!urlChatType || !urlChatId) return;
        
        const paneType = CHAT_TYPE_MAP[urlChatType];
        if (!paneType || useCM.allChats.length === 0) return;

        const existingChat = useCM.allChats.find((c) => c.chatId === urlChatId);
        if (!existingChat) return;

        const currentMainChatId = useCM.currentMainChat?.chatId;

        // If chat is already loaded but we need to focus on a specific message (not in thread)
        if (currentMainChatId === urlChatId && urlMessageId && urlThreadId === undefined) {
            const newMoveIndex = `${urlChatId}-${urlMessageId}`;
            if (useCM.currentMainChat?.moveToSpecificIndex !== newMoveIndex) {
                useCM.setCurrentMainChat({
                    ...useCM.currentMainChat!,
                    moveToSpecificIndex: newMoveIndex,
                });
            }
            return;
        }

        // If it's a different chat, load it
        if (currentMainChatId !== urlChatId) {
            isNavigatingFromUrl.current = true;

            popSpecificMessages(urlChatId, existingChat.chatType)
                .then((messages: MessageProps[]) => {
                    if (messages.length === 0) return;

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
                        moveToSpecificIndex: undefined,
                    };

                    // Determine moveToSpecificIndex based on thread/message presence
                    const newMoveIndex = urlThreadId !== undefined
                        ? `${urlChatId}-${urlThreadId}`
                        : urlMessageId
                            ? `${urlChatId}-${urlMessageId}`
                            : undefined;

                    // Single state update with delay for messages to settle
                    setTimeout(() => {
                        useCM.setCurrentMainChat({ ...newChat, moveToSpecificIndex: newMoveIndex });
                    }, 250);
                    
                    useCM.setIsMainChatVisible(true);
                })
                .catch((error) => console.error("Error loading chat from URL:", error))
                .finally(() => {
                    setTimeout(() => {
                        isNavigatingFromUrl.current = false;
                    }, 100);
                });
        }
    }, [urlChatType, urlChatId, urlThreadId, urlMessageId, useCM.allChats.length, useCM.currentMainChat?.chatId]);

    // Effect 4: Handle thread navigation from URL
    useEffect(() => {
        if (!urlChatType || !urlChatId || !urlThreadId) return;

        const currentThreadId = useCM.currentThreadChat?.threadId;
        if (currentThreadId === urlThreadId) return;

        const chatTypeNum = CHAT_TYPE_MAP[urlChatType];
        const currentChatName = useCM.currentMainChat?.chatName || "";

        // Helper to process thread messages and update state
        const processThreadMessages = (threadMessages: ThreadMessageProps[], threadIdToUse: number) => {
            if (!threadMessages || threadMessages.length === 0) {
                useCM.setIsThreadVisible(true);
                return;
            }

            const newThread: ThreadProps = {
                chatId: urlChatId,
                chatName: currentChatName,
                threadId: threadIdToUse,
                chatType: chatTypeNum,
                dmPartnerUser: myself,
                taskId: threadMessages[0].taskId || null,
                messages: threadMessages,
                project: threadMessages[0].project,
                TSLastMessage: getLocalCurrentTimestamp(),
                taskExist: threadMessages[0].taskExist,
                moveToSpecificIndex: undefined,
            };

            const newMoveIndex = urlMessageId
                ? `${urlChatId}-${urlThreadId}-${urlMessageId}`
                : `${urlChatId}-${urlThreadId}-1`;

            setTimeout(() => {
                useCM.setCurrentThreadChat({ ...newThread, moveToSpecificIndex: newMoveIndex });
            }, 250);

            if (newThread.taskExist === true && threadMessages[0].taskId) {
                useTM.setCurrentPreviewTaskId(threadMessages[0].taskId);
            }

            useCM.setIsThreadVisible(true);
        };

        // Load thread messages based on chat type
        if (chatTypeNum === 3) {
            // PM chat type - load by task ID
            loadSpecificThreadMessagesByTaskId(
                myself,
                chatTypeNum,
                urlChatId,
                urlThreadId,
                accessToken
            ).then((threadMessages) => {
                const threadIdToUse = threadMessages.length > 0 ? threadMessages[0].threadId : urlThreadId;
                processThreadMessages(threadMessages, threadIdToUse);
            });
        } else {
            // Other chat types
            loadSpecificThreadMessages(
                myself,
                chatTypeNum,
                urlChatId,
                urlThreadId,
                accessToken
            ).then((threadMessages) => {
                processThreadMessages(threadMessages, urlThreadId);
            });
        }
    }, [urlChatType, urlChatId, urlThreadId, urlMessageId, useCM.currentThreadChat?.threadId, accessToken, myself]);

    // Update URL when main chat changes (user navigates via UI)
    useEffect(() => {
        // Skip if we're currently navigating from URL (to avoid circular updates)
        if (isNavigatingFromUrl.current) return;

        const mainChat = useCM.currentMainChat;
        if (!mainChat || mainChat.chatId === -1) return;
        
        // Skip if URL already matches current chat
        if (urlChatId === mainChat.chatId) return;

        const typePath = CHAT_TYPE_REVERSE_MAP[mainChat.chatType];
        if (!typePath) return;

        const newPath = buildChatPath(typePath, mainChat.chatId);
        
        // Only update if path is different
        if (newPath !== location.pathname && newPath !== lastNavigatedPath.current) {
            lastNavigatedPath.current = newPath;
            navigate(newPath, { replace: true });
        }
    }, [useCM.currentMainChat?.chatId, useCM.currentMainChat?.chatType, urlChatId, location.pathname, navigate]);

    // Update URL when thread opens
    useEffect(() => {
        const mainChat = useCM.currentMainChat;
        const threadChat = useCM.currentThreadChat;
        
        if (!useCM.isThreadVisible || !threadChat || !mainChat || mainChat.chatId === -1) {
            return;
        }

        const typePath = CHAT_TYPE_REVERSE_MAP[mainChat.chatType];
        if (!typePath) return;

        const threadId = threadChat.chatType === 3 && threadChat.taskId 
            ? threadChat.taskId 
            : threadChat.threadId;

        const newPath = buildChatPath(typePath, mainChat.chatId, threadId, urlMessageId);
        navigate(newPath, { replace: true });
    }, [useCM.isThreadVisible, useCM.currentThreadChat?.threadId, useCM.currentThreadChat?.taskId, useCM.currentMainChat?.chatId, useCM.currentMainChat?.chatType, urlMessageId, navigate]);

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
