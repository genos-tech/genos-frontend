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
import { loadSpecificThreadMessages } from "../services/loadSpecificThreadMessages";
import { loadSpecificThreadMessagesByTaskId } from "../services/loadSpecificThreadMessagesByTaskId";
import { popSpecificMessages } from "../services/popSpecificMessages";

// Chat type constants matching the existing codebase.
// Keys sorted alphabetically per `sort-keys` (the integer values are
// still the canonical kind codes — DM=1, GM=2, PM=3, MDM=4, activity=5,
// flagged=6 — and don't depend on key declaration order).
const CHAT_TYPE_MAP: Record<string, number> = {
    activity: 5,
    dm: 1,
    flagged: 6,
    gm: 2,
    mdm: 4,
    pm: 3,
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
//
// `messageId` and `commentId` are mutually exclusive — either one focuses
// a thread message bubble (the existing flow) or one focuses a task
// comment in the PM thread's "Comments" tab. If both are passed,
// `commentId` wins (caller's choice was a deeper-link target).
const buildChatPath = (
    typePath: string,
    // `chatId` widened to `string | number` for the v3 migration —
    // post-flip the runtime value is the UUID string from
    // `ChatProps.chatId`. Numeric callers (legacy code paths in
    // services still building integer-keyed URLs) keep working via
    // the template literal coercion.
    chatId?: string | number,
    threadId?: number,
    messageId?: number,
    commentId?: number
): string => {
    let path = `/workspace/chat/${typePath}`;
    if (chatId !== undefined) path += `/${chatId}`;
    if (threadId !== undefined) path += `/thread/${threadId}`;
    if (commentId !== undefined) {
        path += `/comment/${commentId}`;
    } else if (messageId !== undefined) {
        path += `/message/${messageId}`;
    }
    return path;
};

type UseChatRoutingProps = {
    useCM: ChatManagementState;
    useTM: TaskManagementState;
    myself: UserProps;
};

type ParsedRoute = {
    chatType: string | undefined;
    // `chatId` is the URL chunk verbatim post-v3 flip — `ChatProps.chatId`
    // is `string` (UUID), and `Number()`-coercing a UUID would NaN. The
    // parser now stores the raw chunk; callers that still need a numeric
    // legacy chat id cast at the call boundary.
    chatId: string | undefined;
    threadId: number | undefined;
    messageId: number | undefined;
    // PM thread "Comments" tab deep-link target (task comment id).
    // Mutually exclusive with `messageId` at the URL level — the path
    // contains either `…/message/:id` or `…/comment/:id`, never both.
    commentId: number | undefined;
};

const EMPTY_ROUTE: ParsedRoute = {
    chatId: undefined,
    chatType: undefined,
    commentId: undefined,
    messageId: undefined,
    threadId: undefined,
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
        // Expected formats:
        //   /workspace/chat/:chatType/:chatId?/thread/:threadId?/message/:messageId?
        //   /workspace/chat/:chatType/:chatId?/thread/:threadId?/comment/:commentId?
        //
        // The `comment/...` shape is the PM thread "Comments" tab deep
        // link added alongside the existing `message/...` shape.

        const chatIndex = pathParts.indexOf("chat");
        if (chatIndex === -1) return EMPTY_ROUTE;

        const chatType = pathParts[chatIndex + 1];
        const chatIdStr = pathParts[chatIndex + 2];
        const threadIndex = pathParts.indexOf("thread");
        const messageIndex = pathParts.indexOf("message");
        const commentIndex = pathParts.indexOf("comment");

        // Keys sorted alphabetically per `sort-keys`.
        return {
            chatId: chatIdStr || undefined,
            chatType,
            commentId:
                commentIndex !== -1 && pathParts[commentIndex + 1]
                    ? Number(pathParts[commentIndex + 1])
                    : undefined,
            messageId:
                messageIndex !== -1 && pathParts[messageIndex + 1]
                    ? Number(pathParts[messageIndex + 1])
                    : undefined,
            threadId:
                threadIndex !== -1 && pathParts[threadIndex + 1]
                    ? Number(pathParts[threadIndex + 1])
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
        // Intentional: `useCM` is the legacy chat-management object —
        // re-deriving its callbacks on every render is fine, but adding
        // it to the dep list would re-create `navigateToChatType` for
        // every parent re-render and break downstream `React.memo`.
        // eslint-disable-next-line react-hooks/exhaustive-deps
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
                navigate(`/workspace/chat/${typePath}/${chatId}/message/${messageId}`);
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

            // Keys sorted alphabetically per `sort-keys`.
            const firstMessage = threadMessages[0];
            const newThread: ThreadProps = {
                chatId,
                chatName: useCM.currentMainChat?.chatName || "",
                chatType: paneType,
                dmPartnerUser: myself,
                messages: threadMessages,
                moveToSpecificIndex: undefined,
                project: firstMessage.project,
                taskExist: firstMessage.taskExist,
                taskId: firstMessage.taskId || null,
                threadId: useTaskIdAsThreadId ? firstMessage.threadId : threadId,
                TSLastMessage: getLocalCurrentTimestamp(),
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

    // Effect 1: Handle missing chat type - redirect to default
    useEffect(() => {
        const { chatType, chatId, threadId, messageId } = parsedRoute;

        const isPathnameChange = prevPathnameRef.current !== pathname;
        prevPathnameRef.current = pathname;

        // If no chat type in URL, redirect to default (dm)
        if (!chatType) {
            const lastChatType = localStorage.getItem("lastChatType");
            const defaultType = lastChatType ? CHAT_TYPE_REVERSE_MAP[Number(lastChatType)] : "dm";
            navigate(`/workspace/chat/${defaultType || "dm"}`, { replace: true });
            return;
        }

        // Cache pane type lookup - avoid repeated CHAT_TYPE_MAP access
        const paneType = CHAT_TYPE_MAP[chatType];
        if (!paneType) return;

        // MDM (type 4) is now displayed within the DM section (type 1)
        // So when navigating to MDM, set the pane type to DM
        const effectivePaneType = paneType === 4 ? 1 : paneType;

        // Update chat pane type from URL
        if (
            useCM.currentChatPaneType !== effectivePaneType &&
            useCM.notMoveChatPaneType === false
        ) {
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

            // PUNCH LIST: legacy services (`popSpecificMessages`,
            // `loadMDMHistory`, `loadSpecificThreadMessages*`) still take
            // `chatId: number`. The v3-flipped chatId is a UUID string,
            // so these calls will fail at runtime once UUID URLs flow
            // through. The cast keeps the compiler happy while the
            // services are migrated in follow-on sessions.
            popSpecificMessages(chatId as unknown as number, existingChat.chatType)
                .then(async (messages: MessageProps[]) => {
                    let resolvedMessages = messages;
                    if (resolvedMessages.length === 0 && existingChat.chatType === 4) {
                        try {
                            const data = await loadMDMHistory(
                                myself.teamId,
                                myself.teamName,
                                myself.userId,
                                accessToken,
                                chatId as unknown as number
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
                    // Keys sorted alphabetically (case-insensitive) per
                    // `sort-keys`. `lastReadMessageId: String(...)` bridges
                    // the legacy numeric `MessageProps.messageId` to the
                    // v3-flipped `ChatProps.lastReadMessageId: string`.
                    const newChat: ChatProps = {
                        chatId: existingChat.chatId,
                        chatName: existingChat.chatName,
                        chatType: existingChat.chatType,
                        dmPartnerUser: existingChat.dmPartnerUser,
                        isPrivate: existingChat.isPrivate,
                        lastReadMessageId: String(lastMessage.messageId),
                        latestMessage: existingChat.latestMessage,
                        latestMessageText: existingChat.latestMessageText,
                        messages: resolvedMessages,
                        moveToSpecificIndex: undefined,
                        profileImagePath: existingChat.profileImagePath,
                        project: existingChat.project,
                        systemUserId: existingChat.systemUserId,
                        TSLastMessage: existingChat.TSLastMessage,
                    };

                    setTimeout(() => {
                        // `chatId !== ""` is the v3-flipped "valid chat?"
                        // sentinel (replaces legacy `!== -1`).
                        const isValidChat = useCM.currentMainChat?.chatId !== "";
                        const newMoveIndex =
                            threadId === undefined
                                ? messageId && isValidChat
                                    ? `${chatId}-${messageId}`
                                    : undefined
                                : isValidChat
                                  ? `${chatId}-${threadId}`
                                  : undefined;
                        useCM.setCurrentMainChat({
                            ...newChat,
                            moveToSpecificIndex: newMoveIndex,
                        });
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
        const shouldLoadThread =
            threadId &&
            (useCM.currentThreadChat === undefined ||
                useCM.currentThreadChat?.threadId !== threadId);

        if (shouldLoadThread) {
            // PUNCH LIST: legacy thread-load services still take
            // `chatId: number`; processThreadMessages still takes
            // number too. Cast at the call boundary — same migration
            // gap as `popSpecificMessages` above.
            const legacyChatId = chatId as unknown as number;
            const loadThreadFn =
                paneType === 3
                    ? loadSpecificThreadMessagesByTaskId(
                          myself,
                          paneType,
                          legacyChatId,
                          threadId,
                          accessToken
                      )
                    : loadSpecificThreadMessages(
                          myself,
                          paneType,
                          legacyChatId,
                          threadId,
                          accessToken
                      );

            loadThreadFn.then((threadMessages: ThreadMessageProps[]) => {
                processThreadMessages(
                    threadMessages,
                    legacyChatId,
                    threadId,
                    paneType,
                    messageId,
                    paneType === 3
                );
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

        if (!currentMainChat || currentMainChat.chatId === "") return;

        // When a thread is visible, let the thread URL effect handle the full URL
        if (useCM.isThreadVisible && useCM.currentThreadChat) return;

        const typePath = CHAT_TYPE_REVERSE_MAP[currentMainChat.chatType];
        if (!typePath) return;

        const newPath = buildChatPath(typePath, currentMainChat.chatId);

        // Guard against stripping valid deep-link segments. The `pathname`
        // variable in this closure can briefly lag the actual browser URL
        // when state + router updates aren't batched into the same render
        // (e.g. Spotlight's `moveToSpecificChat` does setCurrentMainChat
        // + navigate("/chat/pm/1/message/6") inside an async fn; the
        // render that fires this effect sometimes sees the new
        // currentMainChat but the OLD pathname, so the equality check at
        // the top of the effect fails and we end up here, replacing the
        // freshly-pushed `/message/6` URL back to chat-level only).
        //
        // We check `window.location.pathname` directly — it always
        // reflects the true URL. If the real URL is already inside the
        // chat we're syncing to (i.e. starts with `newPath + "/"` or
        // equals `newPath`), leave it alone; the trailing `/thread/...`
        // and `/message/...` segments are intentional and should survive.
        const currentBrowserPath = window.location.pathname;
        if (currentBrowserPath === newPath || currentBrowserPath.startsWith(newPath + "/")) {
            return;
        }

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
            currentMainChat.chatId === ""
        ) {
            return;
        }

        const typePath = CHAT_TYPE_REVERSE_MAP[currentMainChat.chatType];
        if (!typePath) return;

        const threadId =
            currentThreadChat.chatType === 3 && currentThreadChat.taskId
                ? currentThreadChat.taskId
                : currentThreadChat.threadId;

        // Preserve the deep-link target already in the URL. `commentId`
        // wins over `messageId` because the user explicitly navigated
        // to a task comment (PM "Comments" tab), and we don't want a
        // stale `moveToSpecificIndex` (the thread bubble's focus state)
        // to overwrite the active comment focus.
        const { commentId } = parsedRoute;
        let { messageId } = parsedRoute;
        if (commentId === undefined && !messageId && currentThreadChat.moveToSpecificIndex) {
            const parts = currentThreadChat.moveToSpecificIndex.split("-");
            if (parts.length >= 3) {
                const parsedMsgId = Number(parts[parts.length - 1]);
                if (!isNaN(parsedMsgId) && parsedMsgId > 0) {
                    messageId = parsedMsgId;
                }
            }
        }

        const newPath = buildChatPath(
            typePath,
            currentMainChat.chatId,
            threadId,
            messageId,
            commentId
        );

        navigate(newPath, { replace: true });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [useCM.isThreadVisible, useCM.currentThreadChat?.chatId]);

    // Keys sorted alphabetically (case-insensitive) per `sort-keys`.
    return {
        CHAT_TYPE_MAP,
        CHAT_TYPE_REVERSE_MAP,
        getCurrentChatTypeFromUrl,
        navigateToChat,
        navigateToChatType,
        navigateToMessage,
        navigateToThread,
        navigateToThreadMessage,
        parseCurrentRoute,
    };
};
