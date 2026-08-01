// `sort-keys` + `simple-import-sort/imports` disabled file-wide: this
// legacy chat sidebar list carries Joy UI `sx` prop objects whose visual
// grouping (positioning → sizing → typography → colors) is intentional,
// and the file is slated for replacement by the v3 channel sidebar.

import { useEffect, useMemo, useRef, useState } from "react";
import AddRoundedIcon from "@mui/icons-material/AddRounded";
import ChatBubbleOutlineRoundedIcon from "@mui/icons-material/ChatBubbleOutlineRounded";
import FlagOutlinedIcon from "@mui/icons-material/FlagOutlined";
import NotificationsNoneRoundedIcon from "@mui/icons-material/NotificationsNoneRounded";
import { Box, Button, List, Stack, Typography } from "@mui/joy";
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
import { ChatListItemLive } from "../../hooks/useChatListItem";
import { useChatRouting } from "../../hooks/useChatRouting";
import { ChipId, selectVisibleActivityMessages } from "../../utils/activityChipFilters";
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
        // Coalesce invalid/empty timestamps to 0 — `new Date("").getTime()`
        // is NaN, and returning NaN from a comparator makes the sort order
        // unstable (freshly-created channels with no messages would jump
        // around between renders).
        const tb = new Date(b.TSLastMessage).getTime() || 0;
        const ta = new Date(a.TSLastMessage).getTime() || 0;
        return tb - ta;
    });
};

type ChatListProps = {
    socket: Socket | null;
    targetChatType: number;
    // Only meaningful for the FLAGGED pane: "active" (default) renders
    // outstanding flags, "past" renders completed ("done") flags.
    flaggedViewMode?: "active" | "past";
    includeMDM?: boolean; // When true, include MDM (type 4) chats along with DM (type 1)
    currentActivityMessageType: number;
    // Multi-select chip refinement that AND-composes with the
    // single-select above. Only the Activity-tab consumer threads a
    // live set; non-Activity consumers pass `EMPTY_CHIP_SET` to keep
    // a stable identity across renders.
    selectedActivityChipIds: ReadonlySet<ChipId>;
    // Instance-name refinement set ("${chatType}-${chatId}" keys).
    // Composes as AND with the chip set; empty passes through.
    selectedActivityInstanceIds: ReadonlySet<string>;
    // Mention-group refinement set (MentionGroup.groupId values).
    // Composes as AND with chip + instance filters; empty passes through.
    // Only meaningful when the `mention` chip is also in
    // `selectedActivityChipIds`; the parent auto-clears this when the
    // gating chip is deselected.
    selectedActivityMentionGroupIds: ReadonlySet<number>;
    // Optional per-chat predicate composed after the chatType filter.
    // The GM pane threads the personal-tag filter here; undefined (the
    // stable "no filter" value — never pass a fresh always-true fn)
    // passes everything.
    chatTagFilter?: (chat: AllChatProps) => boolean;
    // Empty-state overrides for when `chatTagFilter` is active — a tag
    // filter with zero matches must not claim "No group messages".
    emptyTitleKey?: keyof Messages["chat"]["sidebar"];
    emptySubtitleKey?: keyof Messages["chat"]["sidebar"];
    // Optional empty-state call-to-action (e.g. the GM pane's "New
    // Group Message" — the modal state lives in ChatSidebar).
    emptyActionLabelKey?: keyof Messages["chat"]["sidebar"];
    onEmptyAction?: () => void;
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
    includeMDM: boolean = false,
    chatTagFilter?: (chat: AllChatProps) => boolean
) => {
    return useMemo(() => {
        const chatTypeFilter = (chat: AllChatProps) => {
            if (includeMDM && targetChatType === 1) {
                return chat.chatType === 1 || chat.chatType === 4;
            }
            return chat.chatType === targetChatType;
        };

        let filtered = allChats.filter(chatTypeFilter);
        if (chatTagFilter) {
            filtered = filtered.filter(chatTagFilter);
        }
        if (showOnlyUnreadItems) {
            // `lastReadMessageId` is a string (the adapter writes "0" when
            // the channel has unread per the v3 `unreadCount`, else
            // `String(latestSeq)`); `latestMessage.messageId` is the numeric
            // seq. The old `string < number` comparison relied on implicit
            // coercion and the `: item.lastReadMessageId + 1` fallback did
            // string concatenation ("0" + 1 → "01"). Coerce explicitly with
            // `Number(... || "0")` — identical to `countUnreadChats`, so the
            // per-row filter and the unread badge agree.
            filtered = filtered.filter((item) => {
                const lastRead = Number(item.lastReadMessageId || "0");
                const latestSeq = item.latestMessage ? item.latestMessage.messageId : 0;
                return lastRead < latestSeq;
            });
        }
        return sortAllChatByPinned([...filtered]);
    }, [allChats, targetChatType, showOnlyUnreadItems, includeMDM, chatTagFilter]);
};

// Custom hook for managing filtered activity messages
const useFilteredActivityMessages = (
    activityMessages: ActivityMessageProps[],
    currentActivityMessageType: number,
    selectedActivityChipIds: ReadonlySet<ChipId>,
    selectedActivityInstanceIds: ReadonlySet<string>,
    selectedActivityMentionGroupIds: ReadonlySet<number>,
    myUserId: string,
    showOnlyUnreadItems: boolean
) => {
    const [tmpActivityMessages, setTmpActivityMessages] = useState<ActivityMessageProps[]>(
        activityMessages.filter((item) => !(item.isThread === true && item.messageId === 1))
    );

    useEffect(() => {
        // Shared selector — keeps the rendered set identical to the set
        // the "mark all filtered as read" action in `ChatSidebar` targets.
        setTmpActivityMessages(
            selectVisibleActivityMessages(
                activityMessages,
                currentActivityMessageType,
                selectedActivityChipIds,
                selectedActivityInstanceIds,
                selectedActivityMentionGroupIds,
                myUserId,
                showOnlyUnreadItems
            )
        );
    }, [
        activityMessages,
        currentActivityMessageType,
        selectedActivityChipIds,
        selectedActivityInstanceIds,
        selectedActivityMentionGroupIds,
        myUserId,
        showOnlyUnreadItems,
    ]);

    return tmpActivityMessages;
};

// Empty state component. `titleKey`/`subtitleKey` optionally override the
// per-chatType config — used by the past-flagged view, which has no
// chatType code of its own. Exported for its unit test only.
export const EmptyState = ({
    chatType,
    titleKey,
    subtitleKey,
    actionLabelKey,
    onAction,
}: {
    chatType: number;
    titleKey?: keyof Messages["chat"]["sidebar"];
    subtitleKey?: keyof Messages["chat"]["sidebar"];
    /** Optional call-to-action under the subtitle — an empty list that
     *  only says "things will appear here" leaves a new team stuck. */
    actionLabelKey?: keyof Messages["chat"]["sidebar"];
    onAction?: () => void;
}) => {
    const { mode } = useColorScheme();
    const { t } = useTranslation();
    const isDark = mode === "dark";
    const config = EMPTY_STATES[chatType] || EMPTY_STATES[CHAT_TYPES.DM];
    const Icon = config.icon;
    const resolvedTitleKey = titleKey ?? config.titleKey;
    const resolvedSubtitleKey = subtitleKey ?? config.subtitleKey;

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
                        ? "linear-gradient(135deg, rgba(var(--gp-brand-700-rgb), 0.1) 0%, rgba(var(--gp-brandalt-500-rgb), 0.06) 100%)"
                        : "linear-gradient(135deg, rgba(var(--gp-brand-700-rgb), 0.08) 0%, rgba(var(--gp-brand-700-rgb), 0.04) 100%)",
                    border: "1px solid",
                    borderColor: isDark
                        ? "rgba(var(--gp-brandalt-500-rgb), 0.12)"
                        : "rgba(var(--gp-brand-700-rgb), 0.08)",
                    mb: 2,
                    position: "relative",
                    "&::before": {
                        content: '""',
                        position: "absolute",
                        inset: -6,
                        borderRadius: "50%",
                        border: "1px dashed",
                        borderColor: isDark
                            ? "rgba(var(--gp-brandalt-500-rgb), 0.12)"
                            : "rgba(var(--gp-brand-700-rgb), 0.1)",
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
                        color: isDark ? "var(--gp-brandalt-400)" : "var(--gp-brand-700)",
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
                {t.chat.sidebar[resolvedTitleKey]}
            </Typography>
            <Typography
                level="body-xs"
                sx={{
                    color: isDark ? "rgba(255,255,255,0.4)" : "rgba(0,0,0,0.4)",
                    textAlign: "center",
                    maxWidth: 180,
                }}
            >
                {t.chat.sidebar[resolvedSubtitleKey]}
            </Typography>
            {actionLabelKey && onAction && (
                <Button
                    size="sm"
                    startDecorator={<AddRoundedIcon />}
                    sx={{ mt: 2 }}
                    variant="soft"
                    onClick={onAction}
                >
                    {t.chat.sidebar[actionLabelKey]}
                </Button>
            )}
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
}) => {
    // Live managers for the rows' click handlers. The rows are memoized,
    // so their captured props go stale; a stable ref lets a handler read
    // the current values at click time. See `ChatListItemProps.liveRef`.
    const liveRef = useRef<ChatListItemLive>({ useCM, useTM });
    liveRef.current = { useCM, useTM };

    // Selection is derived HERE, not in the row, because it depends on
    // live `useCM` state. Computing it once per render and passing a
    // boolean is what lets the row memoize against everything else.
    const rowKey = (c: { chatType: number; chatName: string; chatId: string }) =>
        `${c.chatType}-${c.chatName}-${c.chatId}`;
    const mainKey = useCM.currentMainChat ? rowKey(useCM.currentMainChat) : null;
    const subKey =
        useCM.isSubChatVisible && useCM.currentSubChat ? rowKey(useCM.currentSubChat) : null;

    return (
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
                const key = rowKey(chat);
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
                            liveRef={liveRef}
                            myself={data.myself}
                            selected={key === mainKey || (subKey !== null && key === subKey)}
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
};

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
    viewMode,
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
    viewMode: "active" | "past";
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
                            viewMode={viewMode}
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
        flaggedViewMode = "active",
        includeMDM = false,
        currentActivityMessageType,
        selectedActivityChipIds,
        selectedActivityInstanceIds,
        selectedActivityMentionGroupIds,
        chatTagFilter,
        emptyTitleKey,
        emptySubtitleKey,
        emptyActionLabelKey,
        onEmptyAction,
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
        includeMDM,
        chatTagFilter
    );
    const tmpActivityMessages = useFilteredActivityMessages(
        useCM.activityMessages,
        currentActivityMessageType,
        selectedActivityChipIds,
        selectedActivityInstanceIds,
        selectedActivityMentionGroupIds,
        data.myself.userId,
        state.showOnlyUnreadItems
    );
    const [tmpFlaggedMessages, setTmpFlaggedMessages] = useState<FlaggedMessageProps[]>(
        useCM.flaggedMessages
    );
    const [tmpPastFlaggedMessages, setTmpPastFlaggedMessages] = useState<FlaggedMessageProps[]>(
        useCM.pastFlaggedMessages
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
        // Effect is keyed to `targetChats` reordering. `chatTypeLookup` /
        // `targetChatType` are stable for a given tab; including them
        // would cause unrelated re-scrolls on tab switches.
        // eslint-disable-next-line react-hooks/exhaustive-deps
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
    useEffect(() => {
        setTmpPastFlaggedMessages(useCM.pastFlaggedMessages);
    }, [useCM.pastFlaggedMessages]);

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
                // PUNCH LIST (v3 chatId migration): `chatId` is `string`
                // post-flip; the legacy "no chat selected" sentinel was
                // `-1`, now `""` (see `defaultChat` in `utils/defaults.ts`).
                const currentIdx =
                    currentChat && currentChat.chatId !== ""
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
                // PUNCH LIST (v3 chatId migration): `next.chatId` is
                // `string` post-flip; `navigateToChat` still takes
                // `chatId: number` because the route builder (`buildChatPath`)
                // hasn't been migrated. Cast once at the boundary.
                chatRouting.navigateToChat(next.chatType, next.chatId as unknown as number);
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
                return (
                    <EmptyState
                        actionLabelKey={emptyActionLabelKey}
                        chatType={targetChatType}
                        subtitleKey={emptySubtitleKey}
                        titleKey={emptyTitleKey}
                        onAction={onEmptyAction}
                    />
                );
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
            const isPast = flaggedViewMode === "past";
            const list = isPast ? tmpPastFlaggedMessages : tmpFlaggedMessages;
            if (list.length === 0) {
                return isPast ? (
                    <EmptyState
                        chatType={CHAT_TYPES.FLAGGED}
                        subtitleKey="emptyPastFlaggedSubtitle"
                        titleKey="emptyPastFlaggedTitle"
                    />
                ) : (
                    <EmptyState chatType={CHAT_TYPES.FLAGGED} />
                );
            }
            return (
                <FlaggedListRenderer
                    data={data}
                    isDark={isDark}
                    selectedFlaggedMessageId={selectedFlaggedMessageId}
                    setSelectedFlaggedMessageId={setSelectedFlaggedMessageId}
                    socket={socket}
                    tmpFlaggedMessages={list}
                    useCM={useCM}
                    usePM={usePM}
                    useTEM={useTEM}
                    useTM={useTM}
                    useUISM={useUISM}
                    viewMode={isPast ? "past" : "active"}
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
