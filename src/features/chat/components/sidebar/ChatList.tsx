import { useEffect, useMemo, useRef, useState } from "react";
import ChatBubbleOutlineRoundedIcon from "@mui/icons-material/ChatBubbleOutlineRounded";
import FlagOutlinedIcon from "@mui/icons-material/FlagOutlined";
import NotificationsNoneRoundedIcon from "@mui/icons-material/NotificationsNoneRounded";
import { Box, List, Stack, Typography } from "@mui/joy";
import { useColorScheme } from "@mui/joy/styles";
import { Virtuoso, VirtuosoHandle } from "react-virtuoso";
import { Socket } from "socket.io-client";

import { ChatManagementState } from "../../../../hooks/chats/useChatManagement";
import { ProjectManagementState } from "../../../../hooks/common/useProjectManagement";
import { TeamManagementState } from "../../../../hooks/common/useTeamManagement";
import { UIStateManagementState } from "../../../../hooks/common/useUIStateManagement";
import { NoteManagementState } from "../../../../hooks/notes/useNoteManagement";
import { TaskManagementState } from "../../../../hooks/tasks/useTaskManagement";
import { useTranslation, type Messages } from "../../../../i18n";
import { UserProps } from "../../../../types/admin";
import { ActivityMessageProps, AllChatProps, FlaggedMessageProps } from "../../../../types/chat";
import { isMac } from "../../../../utils/platform";
import { useScrollToBottomOnNewActivity } from "../../hooks/messageBubbleHooks";
import { useChatRouting } from "../../hooks/useChatRouting";
import { ChipId, makeChipFilter } from "../../utils/activityChipFilters";
import { ChatListItemForActivity } from "./activity/chatListItemForActivity";
import { ChatListItem } from "./chatListItem";
import { ChatListItemForFlagMessages } from "./chatListItemForFlagMessages";

// Constants
const CHAT_TYPES = {
    DM: 1,
    GM: 2,
    PM: 3,
    PINNED: 4,
    ACTIVITY: 5,
    FLAGGED: 6,
} as const;

const ACTIVITY_TYPES = {
    ALL: 0,
    THREAD: 1,
    TASK: 2,
    MENTION: 3,
    REACTION: 4,
} as const;

const ACTIVITY_FILTERS = {
    [ACTIVITY_TYPES.ALL]: () => true,
    [ACTIVITY_TYPES.THREAD]: (item: ActivityMessageProps) => item.isThread === true,
    [ACTIVITY_TYPES.TASK]: (item: ActivityMessageProps) => item.chatType > 2,
    [ACTIVITY_TYPES.MENTION]: (item: ActivityMessageProps) => item.activityType === 3,
    [ACTIVITY_TYPES.REACTION]: (item: ActivityMessageProps) => item.activityType === 2,
} as const;

// Empty state configuration. Labels resolved at render time via i18n keys.
type EmptyStateKeys = {
    titleKey: keyof Messages["chat"]["sidebar"];
    subtitleKey: keyof Messages["chat"]["sidebar"];
};
const EMPTY_STATES: Record<number, { icon: React.ElementType } & EmptyStateKeys> = {
    [CHAT_TYPES.DM]: {
        icon: ChatBubbleOutlineRoundedIcon,
        titleKey: "emptyDMTitle",
        subtitleKey: "emptyDMSubtitle",
    },
    [CHAT_TYPES.GM]: {
        icon: ChatBubbleOutlineRoundedIcon,
        titleKey: "emptyGMTitle",
        subtitleKey: "emptyGMSubtitle",
    },
    [CHAT_TYPES.PM]: {
        icon: ChatBubbleOutlineRoundedIcon,
        titleKey: "emptyPMTitle",
        subtitleKey: "emptyPMSubtitle",
    },
    [CHAT_TYPES.ACTIVITY]: {
        icon: NotificationsNoneRoundedIcon,
        titleKey: "emptyActivityTitle",
        subtitleKey: "emptyActivitySubtitle",
    },
    [CHAT_TYPES.FLAGGED]: {
        icon: FlagOutlinedIcon,
        titleKey: "emptyFlaggedTitle",
        subtitleKey: "emptyFlaggedSubtitle",
    },
};

// Interfaces for better prop organization
interface ChatListState {
    showOnlyUnreadItems: boolean;
    incompleteTodoCount: number;
    isToDoVisible: boolean;
}

interface ChatListActions {
    setIsToDoVisible: (value: boolean) => void;
}

interface ChatListData {
    myself: UserProps;
    setMyself: (value: UserProps) => void;
}

// Sort all chats by pinned status and then by TSLastMessage in desc
const sortAllChatByPinned = (allChats: AllChatProps[]) => {
    return allChats.sort((a, b) => {
        if (a.isPinned && !b.isPinned) return -1;
        if (!a.isPinned && b.isPinned) return 1;
        return new Date(b.TSLastMessage).getTime() - new Date(a.TSLastMessage).getTime();
    });
};

type ChatListProps = {
    socket: Socket | null;
    targetChatType: number;
    includeMDM?: boolean; // When true, include MDM (type 4) chats along with DM (type 1)
    currentActivityMessageType: number;
    // Multi-select chip refinement that AND-composes with the
    // single-select above. Only the Activity-tab consumer threads a
    // live set; non-Activity consumers pass `EMPTY_CHIP_SET` to keep
    // a stable identity across renders.
    selectedActivityChipIds: ReadonlySet<ChipId>;
    useCM: ChatManagementState;
    state: ChatListState;
    actions: ChatListActions;
    data: ChatListData;
    useUISM: UIStateManagementState;
    useTEM: TeamManagementState;
    useTM: TaskManagementState;
    usePM: ProjectManagementState;
    // Optional — only needed when rendering activity-feed items so the
    // note-mention click handler can dispatch via `useNM`. Chat / task
    // lists don't pass it.
    useNM?: NoteManagementState;
    chatRouting: ReturnType<typeof useChatRouting>;
};

// Custom hook for managing filtered chats
const useFilteredChats = (
    allChats: AllChatProps[],
    targetChatType: number,
    showOnlyUnreadItems: boolean,
    includeMDM: boolean = false
) => {
    return useMemo(() => {
        const chatTypeFilter = (chat: AllChatProps) => {
            if (includeMDM && targetChatType === 1) {
                return chat.chatType === 1 || chat.chatType === 4;
            }
            return chat.chatType === targetChatType;
        };

        let filtered = allChats.filter(chatTypeFilter);
        if (showOnlyUnreadItems) {
            filtered = filtered.filter(
                (item) =>
                    item.lastReadMessageId <
                    (item.latestMessage
                        ? item.latestMessage.messageId
                        : item.lastReadMessageId + 1)
            );
        }
        return sortAllChatByPinned([...filtered]);
    }, [allChats, targetChatType, showOnlyUnreadItems, includeMDM]);
};

// Custom hook for managing filtered activity messages
const useFilteredActivityMessages = (
    activityMessages: ActivityMessageProps[],
    currentActivityMessageType: number,
    selectedActivityChipIds: ReadonlySet<ChipId>,
    showOnlyUnreadItems: boolean
) => {
    const [tmpActivityMessages, setTmpActivityMessages] = useState<ActivityMessageProps[]>(
        activityMessages.filter((item) => !(item.isThread === true && item.messageId === 1))
    );

    useEffect(() => {
        const filteredMessages = activityMessages.filter(
            (item) => !(item.isThread === true && item.messageId === 1)
        );

        if (filteredMessages) {
            // AND-compose the primary single-select with the new
            // multi-select chip refinement. Empty chip set passes
            // everything through (makeChipFilter short-circuits) so
            // the unfiltered baseline matches the pre-chip behaviour.
            const primaryFn =
                ACTIVITY_FILTERS[currentActivityMessageType as keyof typeof ACTIVITY_FILTERS] ??
                (() => true);
            const chipFn = makeChipFilter(selectedActivityChipIds);
            const filtered = filteredMessages.filter((item) => primaryFn(item) && chipFn(item));

            if (showOnlyUnreadItems) {
                setTmpActivityMessages(filtered.filter((item) => item.isRead === false));
            } else {
                setTmpActivityMessages(filtered);
            }
        }
    }, [
        activityMessages,
        currentActivityMessageType,
        selectedActivityChipIds,
        showOnlyUnreadItems,
    ]);

    return tmpActivityMessages;
};

// Empty state component
const EmptyState = ({ chatType }: { chatType: number }) => {
    const { mode } = useColorScheme();
    const { t } = useTranslation();
    const isDark = mode === "dark";
    const config = EMPTY_STATES[chatType] || EMPTY_STATES[CHAT_TYPES.DM];
    const Icon = config.icon;

    return (
        <Box
            sx={{
                height: "100%",
                display: "flex",
                flexDirection: "column",
                justifyContent: "center",
                alignItems: "center",
                px: 3,
                py: 6,
                animation: "fadeIn 0.4s ease-out",
                "@keyframes fadeIn": {
                    from: { opacity: 0, transform: "translateY(8px)" },
                    to: { opacity: 1, transform: "translateY(0)" },
                },
            }}
        >
            <Box
                sx={{
                    width: 64,
                    height: 64,
                    borderRadius: "50%",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    background: isDark
                        ? "linear-gradient(135deg, rgba(124,58,237,0.1) 0%, rgba(139,92,246,0.06) 100%)"
                        : "linear-gradient(135deg, rgba(124,58,237,0.08) 0%, rgba(124,58,237,0.04) 100%)",
                    border: "1px solid",
                    borderColor: isDark ? "rgba(139,92,246,0.12)" : "rgba(124,58,237,0.08)",
                    mb: 2,
                    position: "relative",
                    "&::before": {
                        content: '""',
                        position: "absolute",
                        inset: -6,
                        borderRadius: "50%",
                        border: "1px dashed",
                        borderColor: isDark ? "rgba(139,92,246,0.12)" : "rgba(124,58,237,0.1)",
                        animation: "rotate 25s linear infinite",
                    },
                    "@keyframes rotate": {
                        from: { transform: "rotate(0deg)" },
                        to: { transform: "rotate(360deg)" },
                    },
                }}
            >
                <Icon
                    sx={{
                        fontSize: 28,
                        color: isDark ? "#a78bfa" : "#7c3aed",
                        opacity: 0.7,
                    }}
                />
            </Box>

            <Typography
                level="title-sm"
                sx={{
                    fontWeight: 600,
                    color: isDark ? "rgba(255,255,255,0.8)" : "rgba(0,0,0,0.75)",
                    mb: 0.5,
                    textAlign: "center",
                }}
            >
                {t.chat.sidebar[config.titleKey]}
            </Typography>
            <Typography
                level="body-xs"
                sx={{
                    color: isDark ? "rgba(255,255,255,0.4)" : "rgba(0,0,0,0.4)",
                    textAlign: "center",
                    maxWidth: 180,
                }}
            >
                {t.chat.sidebar[config.subtitleKey]}
            </Typography>
        </Box>
    );
};

// Component for rendering chat items
const ChatListRenderer = ({
    targetChats,
    virtuosoRef,
    state,
    actions,
    data,
    socket,
    useTEM,
    useUISM,
    useCM,
    useTM,
    isDark,
}: {
    targetChats: AllChatProps[];
    virtuosoRef: React.RefObject<VirtuosoHandle | null>;
    state: ChatListState;
    actions: ChatListActions;
    data: ChatListData;
    socket: Socket | null;
    useUISM: UIStateManagementState;
    useTEM: TeamManagementState;
    useCM: ChatManagementState;
    useTM: TaskManagementState;
    isDark: boolean;
}) => (
    <Virtuoso
        ref={virtuosoRef}
        atBottomThreshold={128}
        atTopThreshold={64}
        className={`custom-scrollbar-${isDark ? "dark" : "light"}`}
        initialTopMostItemIndex={0}
        style={{ height: "100%", flex: 1 }}
        totalCount={targetChats.length}
        itemContent={(index) => {
            const chat = targetChats[index];
            return (
                <Box
                    sx={{
                        animation: "fadeSlideIn 0.25s ease-out forwards",
                        animationDelay: `${Math.min(index * 0.03, 0.15)}s`,
                        opacity: 0,
                        "@keyframes fadeSlideIn": {
                            from: { opacity: 0, transform: "translateX(-4px)" },
                            to: { opacity: 1, transform: "translateX(0)" },
                        },
                    }}
                >
                    <ChatListItem
                        key={`${chat.chatId}-${chat.chatType}-${chat.chatName}`}
                        chat={chat}
                        incompleteTodoCount={state.incompleteTodoCount}
                        isPinnedChat={false}
                        isToDoVisible={state.isToDoVisible}
                        myself={data.myself}
                        setIsToDoVisible={actions.setIsToDoVisible}
                        setMyself={data.setMyself}
                        socket={socket}
                        useCM={useCM}
                        useTEM={useTEM}
                        useTM={useTM}
                        useUISM={useUISM}
                    />
                </Box>
            );
        }}
    />
);

// Component for rendering activity messages
const ActivityListRenderer = ({
    tmpActivityMessages,
    activityMessages,
    virtuosoRef,
    data,
    socket,
    selectedActivityId,
    setSelectedActivityId,
    useCM,
    useUISM,
    useTEM,
    useTM,
    usePM,
    useNM,
    isDark,
}: {
    tmpActivityMessages: ActivityMessageProps[];
    activityMessages: ActivityMessageProps[];
    virtuosoRef: React.RefObject<VirtuosoHandle | null>;
    data: ChatListData;
    socket: Socket | null;
    selectedActivityId: string;
    setSelectedActivityId: (id: string) => void;
    useUISM: UIStateManagementState;
    useTEM: TeamManagementState;
    useCM: ChatManagementState;
    useTM: TaskManagementState;
    usePM: ProjectManagementState;
    useNM?: NoteManagementState;
    isDark: boolean;
}) => (
    <Virtuoso
        ref={virtuosoRef}
        atBottomThreshold={128}
        atTopThreshold={64}
        className={`custom-scrollbar-${isDark ? "dark" : "light"}`}
        initialTopMostItemIndex={0}
        style={{ height: "100%", flex: 1 }}
        totalCount={tmpActivityMessages.length}
        itemContent={(index) => {
            const activityMessage = tmpActivityMessages[index];
            return (
                <Box
                    sx={{
                        animation: "fadeSlideIn 0.25s ease-out forwards",
                        animationDelay: `${Math.min(index * 0.03, 0.15)}s`,
                        opacity: 0,
                        "@keyframes fadeSlideIn": {
                            from: { opacity: 0, transform: "translateX(-4px)" },
                            to: { opacity: 1, transform: "translateX(0)" },
                        },
                    }}
                >
                    <Stack direction="row">
                        <ChatListItemForActivity
                            key={`${activityMessage.activityId}-${activityMessage.isRead}`}
                            activity={activityMessage}
                            activityMessages={activityMessages}
                            myself={data.myself}
                            selectedActivityId={selectedActivityId}
                            setCurrentProject={usePM.setCurrentProject}
                            setMyself={data.setMyself}
                            setSelectedActivityId={setSelectedActivityId}
                            socket={socket}
                            useCM={useCM}
                            useNM={useNM}
                            useTEM={useTEM}
                            useTM={useTM}
                            useUISM={useUISM}
                        />
                    </Stack>
                </Box>
            );
        }}
    />
);

// Component for rendering flagged messages
const FlaggedListRenderer = ({
    tmpFlaggedMessages,
    virtuosoRef,
    data,
    socket,
    selectedFlaggedMessageId,
    setSelectedFlaggedMessageId,
    useUISM,
    useTEM,
    useCM,
    useTM,
    usePM,
    isDark,
}: {
    tmpFlaggedMessages: FlaggedMessageProps[];
    virtuosoRef: React.RefObject<VirtuosoHandle | null>;
    data: ChatListData;
    socket: Socket | null;
    selectedFlaggedMessageId: string;
    setSelectedFlaggedMessageId: (id: string) => void;
    useUISM: UIStateManagementState;
    useTEM: TeamManagementState;
    useCM: ChatManagementState;
    useTM: TaskManagementState;
    usePM: ProjectManagementState;
    isDark: boolean;
}) => (
    <Virtuoso
        ref={virtuosoRef}
        atBottomThreshold={128}
        atTopThreshold={64}
        className={`custom-scrollbar-${isDark ? "dark" : "light"}`}
        initialTopMostItemIndex={0}
        style={{ height: "100%", flex: 1 }}
        totalCount={tmpFlaggedMessages.length}
        itemContent={(index) => {
            const flaggedMessage = tmpFlaggedMessages[index];
            return (
                <Box
                    sx={{
                        animation: "fadeSlideIn 0.25s ease-out forwards",
                        animationDelay: `${Math.min(index * 0.03, 0.15)}s`,
                        opacity: 0,
                        "@keyframes fadeSlideIn": {
                            from: { opacity: 0, transform: "translateX(-4px)" },
                            to: { opacity: 1, transform: "translateX(0)" },
                        },
                    }}
                >
                    <Stack direction="row">
                        <ChatListItemForFlagMessages
                            key={`${flaggedMessage.flaggedMessageId}`}
                            flaggedMessage={flaggedMessage}
                            myself={data.myself}
                            selectedFlaggedMessageId={selectedFlaggedMessageId}
                            setCurrentProject={usePM.setCurrentProject}
                            setMyself={data.setMyself}
                            setSelectedFlaggedMessageId={setSelectedFlaggedMessageId}
                            socket={socket}
                            useCM={useCM}
                            useTEM={useTEM}
                            useTM={useTM}
                            useUISM={useUISM}
                        />
                    </Stack>
                </Box>
            );
        }}
    />
);

export const ChatList = (props: ChatListProps) => {
    const {
        socket,
        targetChatType,
        includeMDM = false,
        currentActivityMessageType,
        selectedActivityChipIds,
        state,
        actions,
        data,
        useUISM,
        useTEM,
        useCM,
        useTM,
        usePM,
        useNM,
        chatRouting,
    } = props;

    const { mode } = useColorScheme();
    const isDark = mode === "dark";

    // Refs for different chat types
    const virtuosoDMRef = useRef<VirtuosoHandle | null>(null);
    const virtuosoGMRef = useRef<VirtuosoHandle | null>(null);
    const virtuosoPMRef = useRef<VirtuosoHandle | null>(null);
    const virtuosoPinnedRef = useRef<VirtuosoHandle | null>(null);
    const virtuosoFlaggedRef = useRef<VirtuosoHandle | null>(null);
    const virtuosoActivityRef = useRef<VirtuosoHandle | null>(null);

    // Chat type lookup for refs
    const chatTypeLookup: { [key: number]: React.RefObject<VirtuosoHandle | null> } = {
        [CHAT_TYPES.DM]: virtuosoDMRef,
        [CHAT_TYPES.GM]: virtuosoGMRef,
        [CHAT_TYPES.PM]: virtuosoPMRef,
        [CHAT_TYPES.PINNED]: virtuosoPinnedRef,
    };

    // Custom hooks for filtered data
    const targetChats = useFilteredChats(
        useCM.allChats,
        targetChatType,
        state.showOnlyUnreadItems,
        includeMDM
    );
    const tmpActivityMessages = useFilteredActivityMessages(
        useCM.activityMessages,
        currentActivityMessageType,
        selectedActivityChipIds,
        state.showOnlyUnreadItems
    );
    const [tmpFlaggedMessages, setTmpFlaggedMessages] = useState<FlaggedMessageProps[]>(
        useCM.flaggedMessages
    );
    const [selectedActivityId, setSelectedActivityId] = useState<string>("");
    const [selectedFlaggedMessageId, setSelectedFlaggedMessageId] = useState<string>("");

    // Scroll to top when a non-pinned chat reorders to the top (e.g., new message sent/received)
    const prevFirstNonPinnedKeyRef = useRef<string>("");
    useEffect(() => {
        if (targetChats.length === 0) return;
        const firstNonPinned = targetChats.find((c) => !c.isPinned);
        if (!firstNonPinned) return;
        const key = `${firstNonPinned.chatId}-${firstNonPinned.chatType}`;
        if (prevFirstNonPinnedKeyRef.current && prevFirstNonPinnedKeyRef.current !== key) {
            const ref = chatTypeLookup[targetChatType];
            requestAnimationFrame(() => {
                ref?.current?.scrollTo({ top: 0, behavior: "smooth" });
            });
        }
        prevFirstNonPinnedKeyRef.current = key;
    }, [targetChats]);

    // Scroll hooks
    useScrollToBottomOnNewActivity(
        virtuosoActivityRef as React.RefObject<VirtuosoHandle>,
        useCM.activityMessages,
        true
    );

    // Update flagged messages when props change
    useEffect(() => {
        setTmpFlaggedMessages(useCM.flaggedMessages);
    }, [useCM.flaggedMessages]);

    // Cmd/Alt+Shift+ArrowUp/Down moves the selection within the list.
    //
    // For DM/GM/PM the URL is the source of truth, so we just hand the
    // next chat to `chatRouting.navigateToChat(...)` — the existing URL
    // sync effect in `useChatRouting` handles loading + focusing the
    // chat. For Activity / Flagged the click handlers in
    // `chatListItemForActivity.tsx` / `chatListItemForFlagMessages.tsx`
    // are intricate (thread / task-comment / project-mapping branches
    // and per-item hooks like `useActivityStatus`); reproducing them
    // here would mean lifting a non-trivial amount of logic out of those
    // components. Instead we let the rendered item own its click and
    // dispatch a programmatic click via a `data-chat-list-key` attribute
    // — the rendered onClick remains the single source of truth, and we
    // only need to make sure the next item is mounted (Virtuoso
    // virtualizes off-screen rows) before clicking.
    //
    // The bail-out on editable targets is required so the platform
    // Cmd+Shift+Arrow text-selection shortcut keeps working in the
    // composer / search box / inline-edit fields.
    const targetChatsRef = useRef(targetChats);
    const tmpActivityMessagesRef = useRef(tmpActivityMessages);
    const tmpFlaggedMessagesRef = useRef(tmpFlaggedMessages);
    const selectedActivityIdRef = useRef(selectedActivityId);
    const selectedFlaggedMessageIdRef = useRef(selectedFlaggedMessageId);

    useEffect(() => {
        targetChatsRef.current = targetChats;
    }, [targetChats]);
    useEffect(() => {
        tmpActivityMessagesRef.current = tmpActivityMessages;
    }, [tmpActivityMessages]);
    useEffect(() => {
        tmpFlaggedMessagesRef.current = tmpFlaggedMessages;
    }, [tmpFlaggedMessages]);
    useEffect(() => {
        selectedActivityIdRef.current = selectedActivityId;
    }, [selectedActivityId]);
    useEffect(() => {
        selectedFlaggedMessageIdRef.current = selectedFlaggedMessageId;
    }, [selectedFlaggedMessageId]);

    useEffect(() => {
        const mac = isMac();

        const clickByKey = (
            virtuosoRef: React.RefObject<VirtuosoHandle | null>,
            nextIdx: number,
            dataKey: string
        ) => {
            virtuosoRef.current?.scrollToIndex({
                index: nextIdx,
                behavior: "smooth",
                align: "center",
            });
            // Wait for Virtuoso to mount the row before synthesising the
            // click. One rAF is usually enough, but Virtuoso may need a
            // second tick on a long jump — so we retry once on miss.
            requestAnimationFrame(() => {
                const click = () => {
                    const el = document.querySelector<HTMLElement>(
                        `[data-chat-list-key="${dataKey}"]`
                    );
                    if (el) {
                        el.click();
                        return true;
                    }
                    return false;
                };
                if (!click()) {
                    requestAnimationFrame(() => {
                        click();
                    });
                }
            });
        };

        const handleKeyDown = (e: KeyboardEvent) => {
            const holdHeld = mac ? e.metaKey : e.altKey;
            const wrongModifierHeld = mac ? e.altKey : e.metaKey;
            if (!holdHeld || !e.shiftKey || wrongModifierHeld || e.ctrlKey) return;
            if (e.key !== "ArrowUp" && e.key !== "ArrowDown") return;

            const target = e.target as HTMLElement | null;
            if (
                target &&
                (target.matches?.("input, textarea, [contenteditable=true]") ||
                    target.closest?.("[contenteditable=true]"))
            ) {
                return;
            }

            const delta = e.key === "ArrowDown" ? 1 : -1;

            // DM / GM / PM
            if (targetChatType < CHAT_TYPES.ACTIVITY) {
                const list = targetChatsRef.current;
                if (list.length === 0) return;
                e.preventDefault();

                const currentChat = useCM.currentMainChat;
                const currentIdx =
                    currentChat && currentChat.chatId !== -1
                        ? list.findIndex(
                              (c) =>
                                  c.chatId === currentChat.chatId &&
                                  c.chatType === currentChat.chatType
                          )
                        : -1;

                let nextIdx: number;
                if (currentIdx === -1) {
                    nextIdx = delta === 1 ? 0 : list.length - 1;
                } else {
                    nextIdx = Math.max(0, Math.min(list.length - 1, currentIdx + delta));
                    if (nextIdx === currentIdx) return;
                }

                const next = list[nextIdx];
                chatRouting.navigateToChat(next.chatType, next.chatId);
                chatTypeLookup[targetChatType]?.current?.scrollToIndex({
                    index: nextIdx,
                    behavior: "smooth",
                    align: "center",
                });
                return;
            }

            // Activity
            if (targetChatType === CHAT_TYPES.ACTIVITY) {
                const list = tmpActivityMessagesRef.current;
                if (list.length === 0) return;
                e.preventDefault();

                const currentId = selectedActivityIdRef.current;
                const currentIdx = currentId
                    ? list.findIndex((a) => a.activityId === currentId)
                    : -1;

                let nextIdx: number;
                if (currentIdx === -1) {
                    nextIdx = delta === 1 ? 0 : list.length - 1;
                } else {
                    nextIdx = Math.max(0, Math.min(list.length - 1, currentIdx + delta));
                    if (nextIdx === currentIdx) return;
                }

                const next = list[nextIdx];
                clickByKey(virtuosoActivityRef, nextIdx, `activity-${next.activityId}`);
                return;
            }

            // Flagged
            if (targetChatType === CHAT_TYPES.FLAGGED) {
                const list = tmpFlaggedMessagesRef.current;
                if (list.length === 0) return;
                e.preventDefault();

                const currentId = selectedFlaggedMessageIdRef.current;
                const currentIdx = currentId
                    ? list.findIndex((f) => f.flaggedMessageId === currentId)
                    : -1;

                let nextIdx: number;
                if (currentIdx === -1) {
                    nextIdx = delta === 1 ? 0 : list.length - 1;
                } else {
                    nextIdx = Math.max(0, Math.min(list.length - 1, currentIdx + delta));
                    if (nextIdx === currentIdx) return;
                }

                const next = list[nextIdx];
                clickByKey(virtuosoFlaggedRef, nextIdx, `flagged-${next.flaggedMessageId}`);
                return;
            }
        };

        document.addEventListener("keydown", handleKeyDown);
        return () => document.removeEventListener("keydown", handleKeyDown);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [targetChatType, useCM.currentMainChat?.chatId, useCM.currentMainChat?.chatType]);

    const renderChatList = () => {
        if (targetChatType < CHAT_TYPES.ACTIVITY) {
            if (targetChats.length === 0) {
                return <EmptyState chatType={targetChatType} />;
            }
            const virtuosoRef = chatTypeLookup[targetChatType];
            return (
                <ChatListRenderer
                    actions={actions}
                    data={data}
                    isDark={isDark}
                    socket={socket}
                    state={state}
                    targetChats={targetChats}
                    useCM={useCM}
                    useTEM={useTEM}
                    useTM={useTM}
                    useUISM={useUISM}
                    virtuosoRef={virtuosoRef}
                />
            );
        }
        return null;
    };

    const renderActivityList = () => {
        if (targetChatType === CHAT_TYPES.ACTIVITY) {
            if (tmpActivityMessages.length === 0) {
                return <EmptyState chatType={CHAT_TYPES.ACTIVITY} />;
            }
            return (
                <ActivityListRenderer
                    activityMessages={useCM.activityMessages}
                    data={data}
                    isDark={isDark}
                    selectedActivityId={selectedActivityId}
                    setSelectedActivityId={setSelectedActivityId}
                    socket={socket}
                    tmpActivityMessages={tmpActivityMessages}
                    useCM={useCM}
                    useNM={useNM}
                    usePM={usePM}
                    useTEM={useTEM}
                    useTM={useTM}
                    useUISM={useUISM}
                    virtuosoRef={virtuosoActivityRef}
                />
            );
        }
        return null;
    };

    const renderFlaggedList = () => {
        if (targetChatType === CHAT_TYPES.FLAGGED) {
            if (tmpFlaggedMessages.length === 0) {
                return <EmptyState chatType={CHAT_TYPES.FLAGGED} />;
            }
            return (
                <FlaggedListRenderer
                    data={data}
                    isDark={isDark}
                    selectedFlaggedMessageId={selectedFlaggedMessageId}
                    setSelectedFlaggedMessageId={setSelectedFlaggedMessageId}
                    socket={socket}
                    tmpFlaggedMessages={tmpFlaggedMessages}
                    useCM={useCM}
                    usePM={usePM}
                    useTEM={useTEM}
                    useTM={useTM}
                    useUISM={useUISM}
                    virtuosoRef={virtuosoFlaggedRef}
                />
            );
        }
        return null;
    };

    return (
        <List
            className="custom-scrollbar"
            size="sm"
            sx={{
                p: 0,
                flex: 1,
                display: "flex",
                flexDirection: "column",
                overflow: "hidden",
                "--ListItem-paddingY": "0",
                "--ListItem-paddingX": "0",
            }}
        >
            {renderChatList()}
            {renderActivityList()}
            {renderFlaggedList()}
        </List>
    );
};
