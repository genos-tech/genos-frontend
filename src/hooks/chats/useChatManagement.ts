import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import { loadSpecificThreadMessages } from "../../features/chat/services/loadSpecificThreadMessages";
import { popActivityMessages } from "../../features/chat/services/popActivityMessages";
import { popAllChats } from "../../features/chat/services/popAllChats";
import { popFlaggedMessages } from "../../features/chat/services/popFlaggedMessages";
import { popSpecificMessages } from "../../features/chat/services/popSpecificMessages";
import { UserProps } from "../../types/admin";
import {
    ActivityMessageProps,
    AllChatProps,
    ChatProps,
    FlaggedMessageProps,
    ThreadMessageProps,
    ThreadProps,
} from "../../types/chat";
import { getLocalCurrentTimestamp } from "../../utils/dateUtils";

// Chat type constants for URL routing
const CHAT_TYPE_REVERSE_MAP: Record<number, string> = {
    1: "dm",
    2: "gm",
    3: "pm",
    4: "mdm",
};

export interface ChatManagementState {
    isMainChatVisible: boolean;
    setIsMainChatVisible: (value: boolean) => void;
    isSubChatVisible: boolean;
    setIsSubChatVisible: (value: boolean) => void;
    isThreadVisible: boolean;
    setIsThreadVisible: (value: boolean) => void;
    isThreadTaskVisible: boolean;
    setIsThreadTaskVisible: (value: boolean) => void;
    isChatNoteVisibleInChat: boolean;
    setIsChatNoteVisibleInChat: (value: boolean) => void;
    currentChatPaneType: number;
    setCurrentChatPaneType: (value: number) => void;
    notMoveChatPaneType: boolean;
    setNotMoveChatPaneType: (value: boolean) => void;
    currentMainChat: ChatProps | undefined;
    setCurrentMainChat: (value: ChatProps | undefined) => void;
    currentSubChat: ChatProps | undefined;
    setCurrentSubChat: (value: ChatProps | undefined) => void;
    currentThreadChat: ThreadProps | undefined;
    setCurrentThreadChat: (value: ThreadProps | undefined) => void;
    allChats: AllChatProps[];
    setAllChats: (value: AllChatProps[] | ((prev: AllChatProps[]) => AllChatProps[])) => void;
    flaggedMessages: FlaggedMessageProps[];
    setFlaggedMessages: (value: FlaggedMessageProps[]) => void;
    activityMessages: ActivityMessageProps[];
    setActivityMessages: (value: ActivityMessageProps[]) => void;
    unReadChatCounts: Record<string, number>;
    setUnReadChatCounts: (value: Record<string, number>) => void;
    unReadActivityMessageCounts: number;
    setUnReadActivityMessageCounts: (value: number) => void;
    unReadChatAndActivityCounts: number;
    setUnReadChatAndActivityCounts: (value: number) => void;
    funcSetAllChats: () => Promise<void>;
    funcSetFlaggedMessages: () => Promise<void>;
    funcSetActivityMessages: () => Promise<void>;
    moveToSpecificChat: (
        chatType: number,
        chatId: number,
        threadId: number,
        openTaskNoteInChat: boolean,
        openThreadTaskPreview: boolean,
        setOpeningService: (service: number) => void,
        setCurrentPreviewTaskId: (id: number) => void,
        setCurrentProject: (project: any) => void
    ) => Promise<void>;
    moveToSpecificThreadChat: (
        chat: AllChatProps,
        threadId: number
    ) => Promise<ThreadProps | null>;
    defineNewChat: (chat: AllChatProps, messages: any) => ChatProps;
    showOnlyInCompleteTodos: boolean;
    setShowOnlyInCompleteTodos: (value: boolean) => void;
}

export const useChatManagement = (
    myself: UserProps,
    accessToken: string | null
): ChatManagementState => {
    const navigate = useNavigate();

    // Chat visibility states
    const [isMainChatVisible, setIsMainChatVisible] = useState(true);
    const [isSubChatVisible, setIsSubChatVisible] = useState(false);
    const [isThreadVisible, setIsThreadVisible] = useState(false);
    const [isThreadTaskVisible, setIsThreadTaskVisible] = useState(false);
    const [isChatNoteVisibleInChat, setIsChatNoteVisibleInChat] = useState(false);

    // Chat type state
    const [currentChatPaneType, setCurrentChatPaneType] = useState<number>(
        Number(localStorage.getItem("currentChatPaneType") || "1")
    );

    // Not move chat pane type state
    // true: not move chat pane type (used for activity and flagged chats only via UI)
    // false: move chat pane type (used for all chats via URL)
    const [notMoveChatPaneType, setNotMoveChatPaneType] = useState<boolean>(false);

    // To-Do visibility state: 0: show only incomplete todos, 1: show all todos
    const [showOnlyInCompleteTodos, setShowOnlyInCompleteTodos] = useState<boolean>(
        Number(localStorage.getItem("showOnlyInCompleteTodos") || "0") === 0 ? true : false
    );

    // Current chats
    const [currentMainChat, setCurrentMainChat] = useState<ChatProps | undefined>(undefined);
    const [currentSubChat, setCurrentSubChat] = useState<ChatProps>();
    const [currentThreadChat, setCurrentThreadChat] = useState<ThreadProps>();

    // Chat data
    const [allChats, setAllChats] = useState<AllChatProps[]>([]);
    const [flaggedMessages, setFlaggedMessages] = useState<FlaggedMessageProps[]>([]);
    const [activityMessages, setActivityMessages] = useState<ActivityMessageProps[]>([]);

    // Unread counts
    const [unReadChatCounts, setUnReadChatCounts] = useState<Record<string, number>>({});
    const [unReadActivityMessageCounts, setUnReadActivityMessageCounts] = useState<number>(-1);
    const [unReadChatAndActivityCounts, setUnReadChatAndActivityCounts] = useState<number>(0);

    const funcSetFlaggedMessages = async () => {
        const rawFlaggedMessages: FlaggedMessageProps[] = await popFlaggedMessages();
        if (rawFlaggedMessages) {
            setFlaggedMessages(rawFlaggedMessages);
        }
    };

    const funcSetAllChats = async () => {
        const rawAllChats: AllChatProps[] = await popAllChats();
        if (rawAllChats) {
            const allChatsWithoutInitialDMChat = rawAllChats.filter(
                (chat) => !(chat.chatType === 1 && chat.latestMessage?.messageId <= 1)
            );

            const initialDMChatIdx = rawAllChats.findIndex(
                (chat) =>
                    chat.chatType === 1 &&
                    currentMainChat?.chatId === chat.chatId &&
                    chat.latestMessage?.messageId <= 1
            );

            let finalAllChats: AllChatProps[];
            if (initialDMChatIdx !== -1) {
                const initialDMChat = rawAllChats[initialDMChatIdx];
                finalAllChats = [
                    {
                        ...initialDMChat,
                        latestMessage: {
                            ...initialDMChat.latestMessage,
                            tsSent: getLocalCurrentTimestamp(),
                        },
                    },
                    ...allChatsWithoutInitialDMChat,
                ];
            } else {
                finalAllChats = allChatsWithoutInitialDMChat;
            }

            const idbKeys = new Set(
                finalAllChats.map((c) => `${c.chatType}-${c.chatId}`)
            );
            setAllChats((prev) => {
                const preserved = prev.filter(
                    (c) => !idbKeys.has(`${c.chatType}-${c.chatId}`)
                );
                return [...finalAllChats, ...preserved];
            });
            setUnReadChatCounts(countUnreadChats(allChatsWithoutInitialDMChat));
        }
    };

    const funcSetActivityMessages = async () => {
        const activityMessages: ActivityMessageProps[] = await popActivityMessages(myself);
        if (activityMessages) {
            setActivityMessages(activityMessages);
            setUnReadActivityMessageCounts(countUnreadActivityMessages(activityMessages));
        }
    };

    const countUnreadChats = (chats: AllChatProps[]): Record<string, number> => {
        return chats.reduce<Record<string, number>>((acc, chat) => {
            if (chat.latestMessage && chat.lastReadMessageId < chat.latestMessage.messageId) {
                acc[chat.chatType] = (acc[chat.chatType] ?? 0) + 1;
            }
            return acc;
        }, {});
    };

    const countUnreadActivityMessages = (activityMessages: ActivityMessageProps[]): number => {
        return activityMessages.reduce<number>((acc, activity) => {
            if (activity.isRead === false) {
                acc += 1;
            }
            return acc;
        }, 0);
    };

    const defineNewChat = (chat: AllChatProps, messages: any): ChatProps => {
        const lastMsg = messages.length > 0 ? messages[messages.length - 1] : chat.latestMessage;
        return {
            chatId: chat.chatId,
            chatName: chat.chatName,
            chatType: chat.chatType,
            dmPartnerUser: chat.dmPartnerUser,
            lastReadMessageId: lastMsg?.messageId ?? -1,
            messages: messages,
            latestMessage: lastMsg ?? chat.latestMessage,
            latestMessageText: lastMsg?.contentText ?? chat.latestMessageText ?? "",
            TSLastMessage: lastMsg?.tsSent ?? chat.TSLastMessage ?? "",
            systemUserId: chat.systemUserId,
            project: chat.project,
            isPrivate: chat.isPrivate,
            profileImagePath: chat.profileImagePath,
        };
    };

    const moveToSpecificThreadChat = async (chat: AllChatProps, threadId: number) => {
        const threadMessages: ThreadMessageProps[] = await loadSpecificThreadMessages(
            myself,
            chat.chatType,
            chat.chatId,
            threadId,
            accessToken
        );
        if (threadMessages && threadMessages.length > 0) {
            const newThread: ThreadProps = {
                chatId: chat.chatId,
                chatName: chat.chatName,
                threadId: threadId,
                chatType: chat.chatType,
                dmPartnerUser: chat.dmPartnerUser,
                taskId: threadMessages[threadMessages.length - 1].taskId,
                messages: threadMessages,
                project: threadMessages[threadMessages.length - 1].project,
                TSLastMessage: threadMessages[threadMessages.length - 1].tsSent,
                taskExist: threadMessages[threadMessages.length - 1].taskExist,
            };
            if (newThread) {
                setCurrentThreadChat(newThread);
                return newThread;
            }
        }
        return null;
    };

    const moveToSpecificChat = async (
        chatType: number,
        chatId: number,
        threadId: number,
        openTaskNoteInChat: boolean,
        openThreadTaskPreview: boolean,
        setOpeningService: (service: number) => void,
        setCurrentPreviewTaskId: (id: number) => void,
        setCurrentProject: (project: any) => void
    ) => {
        // Get the URL path for the chat type
        const chatTypePath = CHAT_TYPE_REVERSE_MAP[chatType];
        if (!chatTypePath) {
            console.error(`Invalid chat type: ${chatType}`);
            return;
        }

        setOpeningService(1); // move to chat
        setIsMainChatVisible(false);
        setIsChatNoteVisibleInChat(openTaskNoteInChat);
        setIsThreadTaskVisible(openThreadTaskPreview);

        const targetChat: AllChatProps | undefined = allChats.find(
            (chat) => chat.chatType === chatType && chat.chatId === chatId
        );

        if (!targetChat) {
            console.error(`Chat not found: chatType=${chatType}, chatId=${chatId}`);
            // Still navigate to the chat page - the routing hook will handle loading
            if (threadId > 0) {
                navigate(`/Home/chat/${chatTypePath}/${chatId}/thread/${threadId}`);
            } else {
                navigate(`/Home/chat/${chatTypePath}/${chatId}`);
            }
            return;
        }

        try {
            const messages = await popSpecificMessages(chatId, chatType);
            const newChat: ChatProps = defineNewChat(targetChat, messages);
            setCurrentMainChat(newChat);

            if (threadId > 0) {
                const newThread = await moveToSpecificThreadChat(targetChat, threadId);
                if (newThread) {
                    // Set project if the project id exists in the thread messages.
                    if (newThread.project?.projectId) {
                        setCurrentProject(newThread.project);
                    }
                    if (newThread.taskExist === true && newThread.taskId) {
                        setCurrentPreviewTaskId(newThread.taskId);
                    }
                }
                setIsMainChatVisible(true);
                setIsThreadVisible(true);
                // Navigate to thread URL
                navigate(`/Home/chat/${chatTypePath}/${chatId}/thread/${threadId}`);
            } else {
                setIsMainChatVisible(true);
                // Navigate to chat URL
                navigate(`/Home/chat/${chatTypePath}/${chatId}`);
            }
        } catch (error) {
            console.error(error);
            // Still navigate on error to show the chat page
            if (threadId > 0) {
                navigate(`/Home/chat/${chatTypePath}/${chatId}/thread/${threadId}`);
            } else {
                navigate(`/Home/chat/${chatTypePath}/${chatId}`);
            }
        }
    };

    // Initialization Hooks
    useEffect(() => {
        funcSetAllChats();
        funcSetFlaggedMessages();
        funcSetActivityMessages();
    }, []);

    useEffect(() => {
        setUnReadChatCounts(countUnreadChats(allChats));
    }, [allChats]);

    useEffect(() => {
        // Exclude the first thread message cause it's actually not a thread message.
        const tmpActivityMessages: ActivityMessageProps[] = activityMessages.filter(
            (item) => !(item.isThread === true && item.messageId === 1)
        );
        setUnReadActivityMessageCounts(countUnreadActivityMessages(tmpActivityMessages));
    }, [activityMessages]);

    useEffect(() => {
        if (unReadChatCounts) {
            // 1: DM, 2: GM, 3: PM
            setUnReadChatAndActivityCounts(
                (unReadChatCounts[1] || 0 + unReadChatCounts[2] || 0 + unReadChatCounts[3] || 0) +
                    unReadActivityMessageCounts
            );
        }
    }, [unReadChatCounts, unReadActivityMessageCounts]);

    useEffect(() => {
        const timerId = setTimeout(() => {
            funcSetAllChats();
            if (currentMainChat) {
                if (currentMainChat.chatType === 1 && currentMainChat.chatId !== -1) {
                    localStorage.setItem("lastChatType", "1");
                    localStorage.setItem("lastDMChatId", currentMainChat.chatId.toString() || "");
                }
                if (currentMainChat.chatType === 2 && currentMainChat.chatId !== -1) {
                    localStorage.setItem("lastChatType", "2");
                    localStorage.setItem("lastGMChatId", currentMainChat.chatId.toString() || "");
                }
                if (currentMainChat.chatType === 3 && currentMainChat.chatId !== -1) {
                    localStorage.setItem("lastChatType", "3");
                    localStorage.setItem("lastPMChatId", currentMainChat.chatId.toString() || "");
                }
                if (currentMainChat.chatType === 4 && currentMainChat.chatId !== -1) {
                    localStorage.setItem("lastChatType", "4");
                    localStorage.setItem("lastMDMChatId", currentMainChat.chatId.toString() || "");
                }
            }
        }, 500);
        return () => clearTimeout(timerId);
    }, [currentMainChat, currentSubChat]);

    return {
        // Visibility states
        isMainChatVisible,
        setIsMainChatVisible,
        isSubChatVisible,
        setIsSubChatVisible,
        isThreadVisible,
        setIsThreadVisible,
        isThreadTaskVisible,
        setIsThreadTaskVisible,
        isChatNoteVisibleInChat,
        setIsChatNoteVisibleInChat,

        // Chat type
        currentChatPaneType,
        setCurrentChatPaneType,
        notMoveChatPaneType,
        setNotMoveChatPaneType,

        // Current chats
        currentMainChat,
        setCurrentMainChat,
        currentSubChat,
        setCurrentSubChat,
        currentThreadChat,
        setCurrentThreadChat,

        // Chat data
        allChats,
        setAllChats,
        flaggedMessages,
        setFlaggedMessages,
        activityMessages,
        setActivityMessages,

        // Unread counts
        unReadChatCounts,
        setUnReadChatCounts,
        unReadActivityMessageCounts,
        setUnReadActivityMessageCounts,
        unReadChatAndActivityCounts,
        setUnReadChatAndActivityCounts,

        // Functions
        funcSetAllChats,
        funcSetFlaggedMessages,
        funcSetActivityMessages,
        moveToSpecificChat,
        moveToSpecificThreadChat,
        defineNewChat,

        // To-Do visibility
        showOnlyInCompleteTodos,
        setShowOnlyInCompleteTodos,
    };
};
