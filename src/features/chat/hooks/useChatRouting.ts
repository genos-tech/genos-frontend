import { useCallback, useEffect, useMemo, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";

import { useAuth } from "../../../context/AuthContext";
import { ChatService } from "../../../db/services/chat.service";
import { ChatManagementState } from "../../../hooks/chats/useChatManagement";
import { TaskManagementState } from "../../../hooks/tasks/useTaskManagement";
import { UserProps } from "../../../types/admin";
import { ChatProps, MessageProps, ThreadMessageProps, ThreadProps } from "../../../types/chat";
import { getLocalCurrentTimestamp } from "../../../utils/dateUtils";
import { loadMDMHistory } from "../services/loadMDMHistory";
import { popSpecificMessages } from "../services/popSpecificMessages";
import { loadSpecificThreadMessagesByTaskId } from "../services/loadSpecificThreadMessagesByTaskId";
import { loadSpecificThreadMessages } from "../services/loadSpecificThreadMessages";

// Chat type constants matching the existing codebase
const CHAT_TYPE_MAP: Record<string, number> = {
    dm: 1,
    gm: 2,
    pm: 3,
    mdm: 4,
    activity: 5,
    flagged: 6,
};

const CHAT_TYPE_REVERSE_MAP: Record<number, string> = {
    1: "dm",
    2: "gm",
    3: "pm",
    4: "mdm",
    5: "activity",
    6: "flagged",
};

// Helper to build chat paths - defined outside component to avoid recreation
const buildChatPath = (typePath: string, chatId?: number, threadId?: number, messageId?: number): string => {
    let path = `/Home/chat/${typePath}`;
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

const EMPTY_ROUTE: ParsedRoute = {
    chatType: undefined,
    chatId: undefined,
    threadId: undefined,
    messageId: undefined,
};

export const useChatRouting = ({ useCM, useTM, myself }: UseChatRoutingProps) => {
    const { accessToken } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();
    const pathname = location.pathname;

    // Ref to track if we're currently navigating from URL (to avoid circular updates)
    const isNavigatingFromUrl = useRef(false);
    // Ref to track the last URL we navigated to (to avoid duplicate navigations)
    const lastNavigatedPath = useRef("");
    // Ref to track pathname changes vs allChats.length changes in the URL sync effect
    const prevPathnameRef = useRef("");

    // Memoized parsed route - only recalculates when pathname changes
    const parsedRoute = useMemo((): ParsedRoute => {
        const pathParts = pathname.split("/").filter(Boolean);
        // Expected format: /Home/chat/:chatType/:chatId?/thread/:threadId?/message/:messageId?

        const chatIndex = pathParts.indexOf("chat");
        if (chatIndex === -1) return EMPTY_ROUTE;

        const chatType = pathParts[chatIndex + 1];
        const chatIdStr = pathParts[chatIndex + 2];
        const threadIndex = pathParts.indexOf("thread");
        const messageIndex = pathParts.indexOf("message");

        return {
            chatType,
            chatId: chatIdStr && !isNaN(Number(chatIdStr)) ? Number(chatIdStr) : undefined,
            threadId: threadIndex !== -1 && pathParts[threadIndex + 1] 
                ? Number(pathParts[threadIndex + 1]) 
                : undefined,
            messageId: messageIndex !== -1 && pathParts[messageIndex + 1] 
                ? Number(pathParts[messageIndex + 1]) 
                : undefined,
        };
    }, [pathname]);

    // Stable callback that returns the memoized parsed route
    const parseCurrentRoute = useCallback(() => parsedRoute, [parsedRoute]);

    // Navigate to a specific chat type
    const navigateToChatType = useCallback(
        (chatType: number) => {
            // set to true to not move chat pane type
            useCM.setNotMoveChatPaneType(false);

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
                navigate(`/Home/chat/${typePath}/${chatId}/message/${messageId}`);
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

    // Memoized current chat type from URL - avoids recalculating on every access
    const currentChatTypeFromUrl = useMemo((): number => {
        const { chatType } = parsedRoute;
        if (chatType && CHAT_TYPE_MAP[chatType]) {
            return CHAT_TYPE_MAP[chatType];
        }
        return 1; // Default to DM
    }, [parsedRoute]);

    // Stable callback for getting current chat type
    const getCurrentChatTypeFromUrl = useCallback(
        (): number => currentChatTypeFromUrl,
        [currentChatTypeFromUrl]
    );

    // Helper to process thread messages - extracted to reduce duplication
    const processThreadMessages = useCallback(
        (
            threadMessages: ThreadMessageProps[],
            chatId: number,
            threadId: number,
            paneType: number,
            messageId: number | undefined,
            useTaskIdAsThreadId: boolean
        ) => {
            if (!threadMessages || threadMessages.length === 0) {
                useCM.setIsThreadVisible(true);
                return;
            }

            const firstMessage = threadMessages[0];
            const newThread: ThreadProps = {
                chatId,
                chatName: useCM.currentMainChat?.chatName || "",
                threadId: useTaskIdAsThreadId ? firstMessage.threadId : threadId,
                chatType: paneType,
                dmPartnerUser: myself,
                taskId: firstMessage.taskId || null,
                messages: threadMessages,
                project: firstMessage.project,
                TSLastMessage: getLocalCurrentTimestamp(),
                taskExist: firstMessage.taskExist,
                moveToSpecificIndex: undefined,
            };

            setTimeout(() => {
                const newMoveIndex = messageId
                    ? `${chatId}-${threadId}-${messageId}`
                    : `${chatId}-${threadId}-1`;
                useCM.setCurrentThreadChat({ ...newThread, moveToSpecificIndex: newMoveIndex });
            }, 250);

            if (newThread.taskExist === true && firstMessage.taskId) {
                useTM.setCurrentPreviewTaskId(firstMessage.taskId);
            }

            useCM.setIsThreadVisible(true);
        },
        [myself, useCM, useTM]
    );

    // Sync URL with chat state on initial load or URL change
    useEffect(() => {
        const { chatType, chatId, threadId, messageId } = parsedRoute;

        const isPathnameChange = prevPathnameRef.current !== pathname;
        prevPathnameRef.current = pathname;

        // If no chat type in URL, redirect to default (dm)
        if (!chatType) {
            const lastChatType = localStorage.getItem("lastChatType");
            const defaultType = lastChatType ? CHAT_TYPE_REVERSE_MAP[Number(lastChatType)] : "dm";
            navigate(`/Home/chat/${defaultType || "dm"}`, { replace: true });
            return;
        }

        // Cache pane type lookup - avoid repeated CHAT_TYPE_MAP access
        const paneType = CHAT_TYPE_MAP[chatType];
        if (!paneType) return;

        // MDM (type 4) is now displayed within the DM section (type 1)
        // So when navigating to MDM, set the pane type to DM
        const effectivePaneType = paneType === 4 ? 1 : paneType;

        // Update chat pane type from URL
        if (useCM.currentChatPaneType !== effectivePaneType && useCM.notMoveChatPaneType === false) {
            useCM.setCurrentChatPaneType(effectivePaneType);
            localStorage.setItem("currentChatPaneType", effectivePaneType.toString());
            useCM.setNotMoveChatPaneType(false); // set to false by default
        }

        // Early exit if no chatId or allChats not loaded
        const allChatsLength = useCM.allChats.length;
        if (!chatId || allChatsLength === 0) return;

        const existingChat = useCM.allChats.find(
            (c) => c.chatId === chatId && c.chatType === paneType
        );
        if (!existingChat) return;

        const currentMainChatId = useCM.currentMainChat?.chatId;

        // If chat is already loaded but we need to focus on a specific message
        if (currentMainChatId === chatId && messageId && threadId === undefined) {
            const newMoveIndex = `${chatId}-${messageId}`;
            if (useCM.currentMainChat!.moveToSpecificIndex !== newMoveIndex) {
                useCM.setCurrentMainChat({
                    ...useCM.currentMainChat!,
                    moveToSpecificIndex: newMoveIndex,
                });
            }
        }
        // If it's a different chat, load it
        else if (currentMainChatId !== chatId) {
            // When only allChats.length changed (not the URL), and currentMainChat is
            // already set, don't override it. This prevents the URL sync from reverting
            // a chat that was just set programmatically (e.g. via moveToSelectedChat).
            if (!isPathnameChange && currentMainChatId !== undefined) return;

            isNavigatingFromUrl.current = true;

            popSpecificMessages(chatId, existingChat.chatType)
                .then(async (messages: MessageProps[]) => {
                    let resolvedMessages = messages;
                    if (resolvedMessages.length === 0 && existingChat.chatType === 4) {
                        try {
                            const data = await loadMDMHistory(
                                myself.teamId, myself.teamName, myself.userId, accessToken, chatId
                            );
                            const mdmChat = data?.chat_history?.[0];
                            if (mdmChat?.messages?.length > 0) {
                                resolvedMessages = [...mdmChat.messages].sort(
                                    (a: MessageProps, b: MessageProps) => a.messageId - b.messageId
                                );
                                await new ChatService().batchInsertMDMMessages(resolvedMessages);
                            }
                        } catch (e) {
                            console.error("Failed to load MDM messages from backend:", e);
                        }
                    }
                    if (resolvedMessages.length === 0) return;

                    const lastMessage = resolvedMessages[resolvedMessages.length - 1];
                    const newChat: ChatProps = {
                        chatId: existingChat.chatId,
                        chatName: existingChat.chatName,
                        chatType: existingChat.chatType,
                        dmPartnerUser: existingChat.dmPartnerUser,
                        lastReadMessageId: lastMessage.messageId,
                        messages: resolvedMessages,
                        latestMessage: existingChat.latestMessage,
                        latestMessageText: existingChat.latestMessageText,
                        TSLastMessage: existingChat.TSLastMessage,
                        systemUserId: existingChat.systemUserId,
                        project: existingChat.project,
                        isPrivate: existingChat.isPrivate,
                        profileImagePath: existingChat.profileImagePath,
                        moveToSpecificIndex: undefined,
                    };

                    setTimeout(() => {
                        const isValidChat = useCM.currentMainChat?.chatId !== -1;
                        const newMoveIndex = threadId === undefined
                            ? (messageId && isValidChat ? `${chatId}-${messageId}` : undefined)
                            : (isValidChat ? `${chatId}-${threadId}` : undefined);
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

        // Handle thread message from URL
        const shouldLoadThread = threadId && (
            useCM.currentThreadChat === undefined ||
            useCM.currentThreadChat?.threadId !== threadId
        );

        if (shouldLoadThread) {
            const loadThreadFn = paneType === 3
                ? loadSpecificThreadMessagesByTaskId(myself, paneType, chatId, threadId, accessToken)
                : loadSpecificThreadMessages(myself, paneType, chatId, threadId, accessToken);

            loadThreadFn.then((threadMessages: ThreadMessageProps[]) => {
                processThreadMessages(threadMessages, chatId, threadId, paneType, messageId, paneType === 3);
            });
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [pathname, useCM.allChats.length]);

    // Update URL when main chat changes (user navigates via UI)
    useEffect(() => {
        const { chatId: urlChatId, chatType: urlChatType } = parsedRoute;

        // Skip if we're currently navigating from URL (to avoid circular updates)
        const currentMainChat = useCM.currentMainChat;
        const urlChatTypeNum = urlChatType ? CHAT_TYPE_MAP[urlChatType] : undefined;
        if (
            isNavigatingFromUrl.current ||
            (urlChatId === currentMainChat?.chatId && urlChatTypeNum === currentMainChat?.chatType)
        ) {
            return;
        }

        if (!currentMainChat || currentMainChat.chatId === -1) return;

        const typePath = CHAT_TYPE_REVERSE_MAP[currentMainChat.chatType];
        if (!typePath) return;

        const newPath = buildChatPath(typePath, currentMainChat.chatId);
        // Only update if path is different
        if (newPath !== pathname && newPath !== lastNavigatedPath.current) {
            lastNavigatedPath.current = newPath;
            navigate(newPath, { replace: true });
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [useCM.currentMainChat?.chatId, useCM.currentMainChat?.chatType]);

    // Update URL when thread opens
    useEffect(() => {
        const currentMainChat = useCM.currentMainChat;
        const currentThreadChat = useCM.currentThreadChat;

        if (
            !useCM.isThreadVisible ||
            !currentThreadChat ||
            !currentMainChat ||
            currentMainChat.chatId === -1
        ) {
            return;
        }

        const typePath = CHAT_TYPE_REVERSE_MAP[currentMainChat.chatType];
        if (!typePath) return;

        const threadId = currentThreadChat.chatType === 3 && currentThreadChat.taskId 
            ? currentThreadChat.taskId 
            : currentThreadChat.threadId;

        // Get the message id from the current path
        const { messageId } = parsedRoute;

        const newPath = messageId
            ? buildChatPath(typePath, currentMainChat.chatId, threadId, messageId)
            : buildChatPath(typePath, currentMainChat.chatId, threadId);

        navigate(newPath, { replace: true });
        // eslint-disable-next-line react-hooks/exhaustive-deps
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
