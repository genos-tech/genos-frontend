import { Dispatch, SetStateAction, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import { loadSpecificThreadMessages } from "../../features/chat/services/loadSpecificThreadMessages";
import { loadV3Chats } from "../../features/chat/services/loadV3Chats";
import { popActivityMessages } from "../../features/chat/services/popActivityMessages";
import { popFlaggedMessages } from "../../features/chat/services/popFlaggedMessages";
import { popSpecificMessages } from "../../features/chat/services/popSpecificMessages";
import { UserProps } from "../../types/admin";
import {
    ActivityMessageProps,
    AllChatProps,
    ChatProps,
    FlaggedMessageProps,
    MessageProps,
    ThreadMessageProps,
    ThreadProps,
} from "../../types/chat";
import { ProjectProps } from "../../types/tasks";

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
    // Widened to the full `Dispatch<SetStateAction<...>>` so callers can use
    // the functional updater form `setCurrentThreadChat((prev) => ...)` to
    // patch a single field without reading the current value at render time.
    // This is what makes downstream `React.memo` on message bubbles safe —
    // handlers no longer close over a stale `useCM.currentThreadChat`.
    setCurrentThreadChat: Dispatch<SetStateAction<ThreadProps | undefined>>;
    allChats: AllChatProps[];
    setAllChats: (value: AllChatProps[] | ((prev: AllChatProps[]) => AllChatProps[])) => void;
    flaggedMessages: FlaggedMessageProps[];
    // Same reasoning as setCurrentThreadChat above.
    setFlaggedMessages: Dispatch<SetStateAction<FlaggedMessageProps[]>>;
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
        setCurrentPreviewTaskId: (id: number) => void,
        setCurrentProject: (project: ProjectProps | null) => void,
        // Optional matched-message focus (used by Spotlight). When > 0
        // the helper sets `moveToSpecificIndex` on the chat / thread
        // so the list scrolls to the bubble, and appends `/message/:id`
        // to the URL. Callers that don't need message focus omit it.
        messageId?: number
    ) => Promise<void>;
    moveToSpecificThreadChat: (
        chat: AllChatProps,
        threadId: number
    ) => Promise<ThreadProps | null>;
    defineNewChat: (chat: AllChatProps, messages: MessageProps[]) => ChatProps;
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
        // Source flipped from the legacy per-type IDB chain
        // (`popAllChats` → worker → 4× per-type stores) to the v3
        // unified channel store. The wire-shape conversion lives in
        // `features/chat/adapters/v3ToLegacy.ts`.
        //
        // PUNCH LIST (carry-over from the legacy fn):
        //   - The "initial DM chat" filter (`latestMessage.messageId <= 1`)
        //     handled a quirky empty-DM stub the legacy backend served on
        //     first DM contact. The v3 backend doesn't ship that stub, so
        //     the filter has no equivalent here.
        //   - The `setAllChats((prev) => [...new, ...preservedNotInLoad])`
        //     merge guarded against the worker IDB lagging a fresh
        //     write. The v3 channelService is the single source of truth
        //     in the main thread, so the prior-state merge isn't
        //     necessary on this path.
        const fresh = await loadV3Chats(myself.userId || null);
        setAllChats(fresh);
        setUnReadChatCounts(countUnreadChats(fresh));
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
            // `lastReadMessageId` is `string` post-v3 type flip; the
            // legacy `messageId` is still numeric. While the migration
            // straddles both shapes, defineNewChat writes lastRead as
            // a stringified int — Number() round-trips that. UUID-shaped
            // cursors will Number() to NaN and skip the increment, which
            // is the safer side of the migration gap (over-count is worse
            // than under-count for the unread badge).
            const lastRead = Number(chat.lastReadMessageId || "0");
            if (chat.latestMessage && lastRead < chat.latestMessage.messageId) {
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

    const defineNewChat = (chat: AllChatProps, messages: MessageProps[]): ChatProps => {
        const lastMsg = messages.length > 0 ? messages[messages.length - 1] : chat.latestMessage;
        // `lastReadMessageId` is a string after the v3 type flip; the
        // legacy `messageId` is still numeric, so we stringify on
        // assignment. Empty string is the "no messages yet" sentinel
        // (replaces the legacy `-1`).
        return {
            chatId: chat.chatId,
            chatName: chat.chatName,
            chatType: chat.chatType,
            dmPartnerUser: chat.dmPartnerUser,
            isPrivate: chat.isPrivate,
            lastReadMessageId: lastMsg?.messageId != null ? String(lastMsg.messageId) : "",
            latestMessage: lastMsg ?? chat.latestMessage,
            latestMessageText: lastMsg?.contentText ?? chat.latestMessageText ?? "",
            messages: messages,
            profileImagePath: chat.profileImagePath,
            project: chat.project,
            systemUserId: chat.systemUserId,
            TSLastMessage: lastMsg?.tsSent ?? chat.TSLastMessage ?? "",
        };
    };

    const moveToSpecificThreadChat = async (chat: AllChatProps, threadId: number) => {
        // PUNCH LIST: loadSpecificThreadMessages still takes `chatId:
        // number` and ThreadProps.chatId is still `number`. Both will
        // flip to string in a later session that migrates the
        // thread-services + ThreadProps shape. The casts below keep
        // the file compiling at the boundary; at runtime the integer
        // form was always what the legacy endpoint expected, so a
        // UUID-shaped chatId here would 400 — known migration gap.
        const threadMessages: ThreadMessageProps[] = await loadSpecificThreadMessages(
            myself,
            chat.chatType,
            chat.chatId as unknown as number,
            threadId,
            accessToken
        );
        if (threadMessages && threadMessages.length > 0) {
            const lastThreadMsg = threadMessages[threadMessages.length - 1];
            const newThread: ThreadProps = {
                chatId: chat.chatId as unknown as number,
                chatName: chat.chatName,
                chatType: chat.chatType,
                dmPartnerUser: chat.dmPartnerUser,
                messages: threadMessages,
                project: lastThreadMsg.project,
                taskExist: lastThreadMsg.taskExist,
                taskId: lastThreadMsg.taskId,
                threadId: threadId,
                TSLastMessage: lastThreadMsg.tsSent,
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
        setCurrentPreviewTaskId: (id: number) => void,
        setCurrentProject: (project: ProjectProps | null) => void,
        messageId?: number
    ) => {
        // Get the URL path for the chat type
        const chatTypePath = CHAT_TYPE_REVERSE_MAP[chatType];
        if (!chatTypePath) {
            console.error(`Invalid chat type: ${chatType}`);
            return;
        }

        // Build the destination URL once. Adding `/message/:id` is
        // optional — Spotlight passes it when the search response
        // identified the specific matched bubble; other callers don't.
        const hasMessage = messageId !== undefined && messageId > 0;
        const buildPath = (): string => {
            let path = `/workspace/chat/${chatTypePath}/${chatId}`;
            if (threadId > 0) path += `/thread/${threadId}`;
            if (hasMessage) path += `/message/${messageId}`;
            return path;
        };

        // Switching to the chat service is implicit: every code path below
        // calls `navigate("/workspace/chat/...")`, and the URL is now the source
        // of truth for the active service (see useGlobalServiceShortcut).
        setIsMainChatVisible(false);
        setIsChatNoteVisibleInChat(openTaskNoteInChat);
        setIsThreadTaskVisible(openThreadTaskPreview);

        // PUNCH LIST: `chatId` param is still `number` for the legacy
        // callers; `chat.chatId` is `string` post-v3 flip. We stringify
        // the param for the equality test so tsc accepts it. Once
        // moveToSpecificChat's signature flips to `chatId: string`
        // (and the URL parser stops Number()-ing it), this cast goes.
        const chatIdAsString = String(chatId);
        const targetChat: AllChatProps | undefined = allChats.find(
            (chat) => chat.chatType === chatType && chat.chatId === chatIdAsString
        );

        if (!targetChat) {
            console.error(`Chat not found: chatType=${chatType}, chatId=${chatId}`);
            // Still navigate to the chat page - the routing hook will handle loading
            navigate(buildPath());
            return;
        }

        try {
            const messages = await popSpecificMessages(chatId, chatType);
            const newChat: ChatProps = defineNewChat(targetChat, messages);
            // Spotlight may have asked us to focus a specific bubble in
            // the main channel. The chat list reads `moveToSpecificIndex`
            // (formatted as "{chatId}-{messageId}") to scroll-target.
            if (hasMessage && threadId === 0) {
                newChat.moveToSpecificIndex = `${chatId}-${messageId}`;
            }
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
                    // Re-apply moveToSpecificIndex for thread-message
                    // focus. `moveToSpecificThreadChat` set the thread
                    // without it; we add it here so a Spotlight match
                    // on a thread bubble actually scrolls.
                    if (hasMessage) {
                        setCurrentThreadChat({
                            ...newThread,
                            moveToSpecificIndex: `${chatId}-${threadId}-${messageId}`,
                        });
                    }
                }
                setIsMainChatVisible(true);
                setIsThreadVisible(true);
                navigate(buildPath());
            } else {
                setIsMainChatVisible(true);
                navigate(buildPath());
            }
        } catch (error) {
            console.error(error);
            // Still navigate on error to show the chat page
            navigate(buildPath());
        }
    };

    // Initialization Hooks
    useEffect(() => {
        funcSetAllChats();
        funcSetFlaggedMessages();
        funcSetActivityMessages();
        // Intentional: these three loaders fire ONCE on mount. They
        // close over `myself`/`accessToken` already; re-firing on every
        // render would thrash the worker + network.
        // eslint-disable-next-line react-hooks/exhaustive-deps
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
                // `chatId !== -1` was the legacy "is this a real
                // chat?" sentinel. With chatId now string, empty
                // string is the equivalent of "unset". `chatId` is
                // already a string so `.toString()` is structurally
                // a no-op but kept for clarity.
                if (currentMainChat.chatType === 1 && currentMainChat.chatId !== "") {
                    localStorage.setItem("lastChatType", "1");
                    localStorage.setItem("lastDMChatId", currentMainChat.chatId);
                }
                if (currentMainChat.chatType === 2 && currentMainChat.chatId !== "") {
                    localStorage.setItem("lastChatType", "2");
                    localStorage.setItem("lastGMChatId", currentMainChat.chatId);
                }
                if (currentMainChat.chatType === 3 && currentMainChat.chatId !== "") {
                    localStorage.setItem("lastChatType", "3");
                    localStorage.setItem("lastPMChatId", currentMainChat.chatId);
                }
                if (currentMainChat.chatType === 4 && currentMainChat.chatId !== "") {
                    localStorage.setItem("lastChatType", "4");
                    localStorage.setItem("lastMDMChatId", currentMainChat.chatId);
                }
            }
        }, 500);
        return () => clearTimeout(timerId);
        // Intentional: `funcSetAllChats` is re-derived on every render
        // and isn't memoized; including it in the dep array would re-arm
        // the timer continuously. Only the main/sub chat selection
        // should trigger a refresh.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [currentMainChat, currentSubChat]);

    // Keys sorted natural-case-insensitive ascending per the project's
    // `sort-keys` lint rule. Grouping comments (visibility / chat data
    // / etc.) lived above; the sorted shape is intentionally flat.
    return {
        activityMessages,
        allChats,
        currentChatPaneType,
        currentMainChat,
        currentSubChat,
        currentThreadChat,
        defineNewChat,
        flaggedMessages,
        funcSetActivityMessages,
        funcSetAllChats,
        funcSetFlaggedMessages,
        isChatNoteVisibleInChat,
        isMainChatVisible,
        isSubChatVisible,
        isThreadTaskVisible,
        isThreadVisible,
        moveToSpecificChat,
        moveToSpecificThreadChat,
        notMoveChatPaneType,
        setActivityMessages,
        setAllChats,
        setCurrentChatPaneType,
        setCurrentMainChat,
        setCurrentSubChat,
        setCurrentThreadChat,
        setFlaggedMessages,
        setIsChatNoteVisibleInChat,
        setIsMainChatVisible,
        setIsSubChatVisible,
        setIsThreadTaskVisible,
        setIsThreadVisible,
        setNotMoveChatPaneType,
        setShowOnlyInCompleteTodos,
        setUnReadActivityMessageCounts,
        setUnReadChatAndActivityCounts,
        setUnReadChatCounts,
        showOnlyInCompleteTodos,
        unReadActivityMessageCounts,
        unReadChatAndActivityCounts,
        unReadChatCounts,
    };
};
