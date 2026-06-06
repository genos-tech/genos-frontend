import { useEffect, useState } from "react";
import AccountTreeRoundedIcon from "@mui/icons-material/AccountTreeRounded";
import DoneAllRoundedIcon from "@mui/icons-material/DoneAllRounded";
import FlagRoundedIcon from "@mui/icons-material/FlagRounded";
import GroupsIcon from "@mui/icons-material/Groups";
import GroupsRoundedIcon from "@mui/icons-material/GroupsRounded";
import MoreHorizRoundedIcon from "@mui/icons-material/MoreHorizRounded";
import NotificationsActiveRoundedIcon from "@mui/icons-material/NotificationsActiveRounded";
import PeopleRoundedIcon from "@mui/icons-material/PeopleRounded";
import PersonRoundedIcon from "@mui/icons-material/PersonRounded";
import {
    Badge,
    Box,
    Chip,
    Divider,
    Dropdown,
    IconButton,
    Menu,
    MenuButton,
    MenuItem,
    Sheet,
    Stack,
    Tooltip,
    Typography,
} from "@mui/joy";
import { useColorScheme } from "@mui/joy/styles";
import { Socket } from "socket.io-client";

import { ChatManagementState } from "../../../../hooks/chats/useChatManagement";
import { ProjectManagementState } from "../../../../hooks/common/useProjectManagement";
import { TeamManagementState } from "../../../../hooks/common/useTeamManagement";
import { UIStateManagementState } from "../../../../hooks/common/useUIStateManagement";
import { NoteManagementState } from "../../../../hooks/notes/useNoteManagement";
import { TaskManagementState } from "../../../../hooks/tasks/useTaskManagement";
import { fmt, useTranslation } from "../../../../i18n";
import { UserProps } from "../../../../types/admin";
import { isMac } from "../../../../utils/platform";
import { useChatRouting } from "../../hooks/useChatRouting";
import { useMarkFilteredActivityRead } from "../../hooks/useMarkFilteredActivityRead";
import {
    ChipId,
    EMPTY_CHIP_SET,
    EMPTY_GROUP_ID_SET,
    EMPTY_INSTANCE_SET,
    hasGatingChip,
    hasMentionGatingChip,
    selectVisibleActivityMessages,
} from "../../utils/activityChipFilters";
import { ModalCreateGM } from "../modals/ModalCreateGM";
import { ModalCreateMDM } from "../modals/ModalCreateMDM";
import { ModalJoinGM } from "../modals/ModalJoinGM";
import { ChatList } from "./ChatList";
import { ChatSearch } from "./ChatSearch";
import { ActivityDivider } from "./ChatSidebarDividers";

// Chat type constants
const CHAT_PANE_TYPES = {
    DM: 1,
    GM: 2,
    PM: 3,
    MDM: 4,
    ACTIVITY: 5,
    FLAGGED: 6,
} as const;

// Navigation item configuration
// Note: MDM (Multi-user DM) is now integrated into DM section, not shown as separate nav item
// Exported so the chat list keyboard-shortcut handler in `ChatList.tsx`
// shares the same tab order — keep them in sync.
export const NAV_ITEMS = [
    {
        type: CHAT_PANE_TYPES.DM,
        icon: PersonRoundedIcon,
        labelKey: "navDM" as const,
        shortLabelKey: "navDMShort" as const,
        colorScheme: { dark: "#a78bfa", light: "#7c3aed" },
    },
    {
        type: CHAT_PANE_TYPES.GM,
        icon: GroupsRoundedIcon,
        labelKey: "navGM" as const,
        shortLabelKey: "navGMShort" as const,
        colorScheme: { dark: "#a78bfa", light: "#7c3aed" },
    },
    {
        type: CHAT_PANE_TYPES.PM,
        icon: AccountTreeRoundedIcon,
        labelKey: "navPM" as const,
        shortLabelKey: "navPMShort" as const,
        colorScheme: { dark: "#a78bfa", light: "#7c3aed" },
    },
    {
        type: CHAT_PANE_TYPES.FLAGGED,
        icon: FlagRoundedIcon,
        labelKey: "navFlagged" as const,
        shortLabelKey: "navFlaggedShort" as const,
        colorScheme: { dark: "#a78bfa", light: "#7c3aed" },
    },
    {
        type: CHAT_PANE_TYPES.ACTIVITY,
        icon: NotificationsActiveRoundedIcon,
        labelKey: "navActivity" as const,
        shortLabelKey: "navActivityShort" as const,
        colorScheme: { dark: "#a78bfa", light: "#7c3aed" },
    },
];

type ChatSidebarProps = {
    incompleteTodoCount: number;
    myself: UserProps;
    setIsToDoVisible: (value: boolean) => void;
    isToDoVisible: boolean;
    setMyself: (value: UserProps) => void;
    useUISM: UIStateManagementState;
    socket: Socket | null;
    useTEM: TeamManagementState;
    useCM: ChatManagementState;
    useTM: TaskManagementState;
    usePM: ProjectManagementState;
    useNM?: NoteManagementState;
    chatRouting: ReturnType<typeof useChatRouting>;
};

export const ChatSidebar = (props: ChatSidebarProps) => {
    const {
        incompleteTodoCount,
        myself,
        setIsToDoVisible,
        isToDoVisible,
        setMyself,
        useUISM,
        socket,
        useTEM,
        useCM,
        useTM,
        usePM,
        useNM,
        chatRouting,
    } = props;
    const { mode } = useColorScheme();
    const { t } = useTranslation();
    const isDark = mode === "dark";

    const [openSearchBox, setOpenSearchBox] = useState(false);
    const [openCreateGM, setOpenCreateGM] = useState(false);
    const [openCreateMDM, setOpenCreateMDM] = useState(false);
    const [showOnlyUnreadItems, setShowOnlyUnreadItems] = useState(false);
    const [openJoinGM, setOpenJoinGM] = useState({
        flag: false,
        chatId: "",
        chatName: "",
    });

    // 0: none, 1: thread, 2: task, 3: mention, 4: reaction
    const [currentActivityMessageType, setCurrentActivityMessageType] = useState<number>(0);

    // Multi-select chip refinement that AND-composes with the
    // single-select above. Empty set = pass-through (no narrowing).
    // Ephemeral — resets on reload, matching `currentActivityMessageType`.
    const [selectedActivityChipIds, setSelectedActivityChipIds] =
        useState<ReadonlySet<ChipId>>(EMPTY_CHIP_SET);

    // Instance-name refinement set keyed by "${chatType}-${chatId}".
    // Only engaged when at least one of project / dm / gm / mdm is in
    // `selectedActivityChipIds` — the effect below wipes it whenever
    // every gating chip is deselected so the filter can't leak into
    // unrelated contexts.
    const [selectedActivityInstanceIds, setSelectedActivityInstanceIds] =
        useState<ReadonlySet<string>>(EMPTY_INSTANCE_SET);

    // Mention-group refinement set keyed by `MentionGroup.groupId`. Only
    // engaged when the `mention` chip is in `selectedActivityChipIds`;
    // the effect below auto-clears it whenever the gating chip is off so
    // a stale selection can't leak across toggles.
    const [selectedActivityMentionGroupIds, setSelectedActivityMentionGroupIds] =
        useState<ReadonlySet<number>>(EMPTY_GROUP_ID_SET);

    useEffect(() => {
        if (!hasGatingChip(selectedActivityChipIds) && selectedActivityInstanceIds.size > 0) {
            setSelectedActivityInstanceIds(EMPTY_INSTANCE_SET);
        }
    }, [selectedActivityChipIds, selectedActivityInstanceIds.size]);

    useEffect(() => {
        if (
            !hasMentionGatingChip(selectedActivityChipIds) &&
            selectedActivityMentionGroupIds.size > 0
        ) {
            setSelectedActivityMentionGroupIds(EMPTY_GROUP_ID_SET);
        }
    }, [selectedActivityChipIds, selectedActivityMentionGroupIds.size]);

    const { markFilteredAsRead } = useMarkFilteredActivityRead({ useCM });

    // Mark every activity currently visible in the feed as read. Recomputes
    // the visible set at click time from the live filter state so it always
    // matches exactly what `ChatList` is rendering — change a filter and the
    // target set changes with it.
    const handleMarkFilteredActivityRead = () => {
        const visible = selectVisibleActivityMessages(
            useCM.activityMessages,
            currentActivityMessageType,
            selectedActivityChipIds,
            selectedActivityInstanceIds,
            selectedActivityMentionGroupIds,
            myself.userId,
            showOnlyUnreadItems
        );
        markFilteredAsRead(visible);
    };

    // Get unread count for a specific chat type
    const getUnreadCount = (chatType: number): number => {
        if (chatType === CHAT_PANE_TYPES.FLAGGED) {
            return useCM.flaggedMessages.length;
        }
        if (chatType === CHAT_PANE_TYPES.ACTIVITY) {
            return useCM.unReadActivityMessageCounts;
        }
        // DM tab includes both DM and MDM unread counts
        if (chatType === CHAT_PANE_TYPES.DM) {
            return (useCM.unReadChatCounts?.[1] || 0) + (useCM.unReadChatCounts?.[4] || 0);
        }
        return useCM.unReadChatCounts?.[chatType] || 0;
    };

    // Calculate total unread count
    const totalUnread =
        (useCM.unReadChatCounts?.[1] || 0) +
        (useCM.unReadChatCounts?.[2] || 0) +
        (useCM.unReadChatCounts?.[3] || 0) +
        (useCM.unReadChatCounts?.[4] || 0);

    const handleNavClick = (type: number) => {
        // Navigate via URL - the useChatRouting hook will sync state
        chatRouting.navigateToChatType(type);
        localStorage.setItem("currentChatPaneType", type.toString());
        localStorage.setItem("lastChatType", type.toString());
    };

    // Cmd/Alt + Shift + ArrowLeft/Right cycles between NAV_ITEMS tabs.
    // The matching ArrowUp/Down (next/prev chat list item) lives in
    // `ChatList.tsx` because that component owns the per-tab list state.
    // We deliberately bail out when the event target is an editable
    // element so the platform Cmd+Shift+Arrow text-selection shortcut
    // keeps working in the composer / search box.
    useEffect(() => {
        const mac = isMac();

        const handleKeyDown = (e: KeyboardEvent) => {
            const holdHeld = mac ? e.metaKey : e.altKey;
            const wrongModifierHeld = mac ? e.altKey : e.metaKey;
            if (!holdHeld || !e.shiftKey || wrongModifierHeld || e.ctrlKey) return;
            if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;

            const target = e.target as HTMLElement | null;
            if (
                target &&
                (target.matches?.("input, textarea, [contenteditable=true]") ||
                    target.closest?.("[contenteditable=true]"))
            ) {
                return;
            }

            const currentIdx = NAV_ITEMS.findIndex(
                (item) => item.type === useCM.currentChatPaneType
            );
            if (currentIdx === -1) return;

            e.preventDefault();
            const delta = e.key === "ArrowRight" ? 1 : -1;
            const nextIdx = (currentIdx + delta + NAV_ITEMS.length) % NAV_ITEMS.length;
            handleNavClick(NAV_ITEMS[nextIdx].type);
        };

        document.addEventListener("keydown", handleKeyDown);
        return () => document.removeEventListener("keydown", handleKeyDown);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [useCM.currentChatPaneType]);

    return (
        <Box
            sx={{
                display: "flex",
                // On desktop the sticky Sheet parent has no explicit
                // height, so use 100dvh to size against the viewport.
                // On mobile the parent (MobileChatHome) is a constrained
                // flex column, so 100% fills it correctly.
                height: { xs: "100%", md: "100dvh" },
                minHeight: 0,
            }}
        >
            <Sheet
                sx={{
                    width: "100%",
                    display: "flex",
                    flexDirection: "column",
                    borderRight: "1px solid",
                    borderColor: isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)",
                    background: isDark
                        ? "linear-gradient(180deg, rgba(18,18,22,1) 0%, rgba(14,14,18,1) 100%)"
                        : "linear-gradient(180deg, rgba(252,252,255,1) 0%, rgba(248,248,252,1) 100%)",
                    position: "relative",
                    overflow: "hidden",
                }}
            >
                {/* Subtle background decoration */}
                <Box
                    sx={{
                        position: "absolute",
                        top: 0,
                        right: 0,
                        width: "60%",
                        height: "40%",
                        background: isDark
                            ? "radial-gradient(ellipse at top right, rgba(124,58,237,0.04) 0%, transparent 60%)"
                            : "radial-gradient(ellipse at top right, rgba(124,58,237,0.03) 0%, transparent 60%)",
                        pointerEvents: "none",
                    }}
                />

                {/* Search Box */}
                <ChatSearch
                    myself={myself}
                    openSearchBox={openSearchBox}
                    setMyself={setMyself}
                    setOpenJoinGM={setOpenJoinGM}
                    setOpenSearchBox={setOpenSearchBox}
                    socket={socket}
                    useCM={useCM}
                    useTEM={useTEM}
                    useUISM={useUISM}
                />

                <ModalJoinGM
                    myself={myself}
                    openJoinGM={openJoinGM}
                    setOpenJoinGM={setOpenJoinGM}
                    socket={socket}
                />

                {/* Navigation Tabs */}
                <Box
                    sx={{
                        px: 1.5,
                        py: 1,
                        borderBottom: "1px solid",
                        borderColor: isDark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.04)",
                    }}
                >
                    <Stack
                        alignItems="center"
                        direction="row"
                        justifyContent="space-between"
                        sx={{ mb: 1 }}
                    >
                        <Stack
                            direction="row"
                            spacing={0.5}
                            sx={{
                                gap: 0.5,
                                overflow: "visible", // let Stack overflow remain visible
                                position: "relative", // ensure context for absolute positioning
                                "& > .MuiBadge-root": {
                                    overflow: "visible", // make sure Badge overflow is visible if used directly inside
                                },
                                // child container to enable scroll, but let Badge overflow
                                "& > .scroll-container": {
                                    display: "flex",
                                    overflowX: "auto",
                                    overflowY: "hidden",
                                    gap: 0.5,
                                    pb: 0.5, // optional: add space to prevent clipping at top
                                    position: "relative",
                                },
                            }}
                        >
                            {NAV_ITEMS.map((item) => {
                                const Icon = item.icon;
                                const isActive = useCM.currentChatPaneType === item.type;
                                const unreadCount = getUnreadCount(item.type);

                                return (
                                    <Tooltip
                                        key={item.type}
                                        placement="top"
                                        size="sm"
                                        sx={{ zIndex: 10020 }}
                                        title={t.chat.sidebar[item.labelKey]}
                                        variant="outlined"
                                    >
                                        <Badge
                                            badgeContent={unreadCount > 0 ? unreadCount : 0}
                                            invisible={unreadCount === 0}
                                            size="sm"
                                            sx={{
                                                "& .MuiBadge-badge": {
                                                    background: isDark
                                                        ? `linear-gradient(135deg, ${item.colorScheme.dark} 0%, ${item.colorScheme.dark}cc 100%)`
                                                        : `linear-gradient(135deg, ${item.colorScheme.light} 0%, ${item.colorScheme.light}cc 100%)`,
                                                    color: "#fff",
                                                    fontWeight: 700,
                                                    fontSize: "0.65rem",
                                                    minWidth: 16,
                                                    height: 16,
                                                    boxShadow: isDark
                                                        ? `0 2px 6px ${item.colorScheme.dark}40`
                                                        : `0 2px 6px ${item.colorScheme.light}35`,
                                                },
                                            }}
                                        >
                                            <Box
                                                sx={{
                                                    width: 36,
                                                    height: 36,
                                                    borderRadius: "10px",
                                                    display: "flex",
                                                    alignItems: "center",
                                                    justifyContent: "center",
                                                    cursor: "pointer",
                                                    transition:
                                                        "all 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
                                                    background: isActive
                                                        ? isDark
                                                            ? `linear-gradient(135deg, ${item.colorScheme.dark}20 0%, ${item.colorScheme.dark}10 100%)`
                                                            : `linear-gradient(135deg, ${item.colorScheme.light}15 0%, ${item.colorScheme.light}08 100%)`
                                                        : "transparent",
                                                    border: "1px solid",
                                                    borderColor: isActive
                                                        ? isDark
                                                            ? `${item.colorScheme.dark}35`
                                                            : `${item.colorScheme.light}25`
                                                        : "transparent",
                                                    "&:hover": {
                                                        background: isActive
                                                            ? isDark
                                                                ? `linear-gradient(135deg, ${item.colorScheme.dark}25 0%, ${item.colorScheme.dark}15 100%)`
                                                                : `linear-gradient(135deg, ${item.colorScheme.light}20 0%, ${item.colorScheme.light}12 100%)`
                                                            : isDark
                                                              ? "rgba(255,255,255,0.06)"
                                                              : "rgba(0,0,0,0.04)",
                                                        transform: "translateY(-1px)",
                                                    },
                                                    "&:active": {
                                                        transform: "translateY(0)",
                                                    },
                                                }}
                                                onClick={() => handleNavClick(item.type)}
                                            >
                                                <Icon
                                                    sx={{
                                                        fontSize: 18,
                                                        color: isActive
                                                            ? isDark
                                                                ? item.colorScheme.dark
                                                                : item.colorScheme.light
                                                            : isDark
                                                              ? "rgba(255,255,255,0.5)"
                                                              : "rgba(0,0,0,0.45)",
                                                        transition: "color 0.2s ease",
                                                    }}
                                                />
                                            </Box>
                                        </Badge>
                                    </Tooltip>
                                );
                            })}
                        </Stack>

                        {/* Actions */}
                        <Stack alignItems="center" direction="row" spacing={0.5}>
                            {/* Unread Filter Toggle */}
                            <Chip
                                color={showOnlyUnreadItems ? "primary" : "neutral"}
                                size="sm"
                                variant={showOnlyUnreadItems ? "solid" : "soft"}
                                sx={{
                                    cursor: "pointer",
                                    fontWeight: 600,
                                    fontSize: "0.7rem",
                                    px: 1,
                                    height: 26,
                                    borderRadius: "8px",
                                    transition: "all 0.2s ease",
                                    background: showOnlyUnreadItems
                                        ? isDark
                                            ? "linear-gradient(135deg, #7c3aed 0%, #6d28d9 100%)"
                                            : "linear-gradient(135deg, #7c3aed 0%, #6d28d9 100%)"
                                        : isDark
                                          ? "rgba(255,255,255,0.06)"
                                          : "rgba(0,0,0,0.04)",
                                    border: "1px solid",
                                    borderColor: showOnlyUnreadItems
                                        ? "transparent"
                                        : isDark
                                          ? "rgba(255,255,255,0.08)"
                                          : "rgba(0,0,0,0.06)",
                                    "&:hover": {
                                        background: showOnlyUnreadItems
                                            ? isDark
                                                ? "linear-gradient(135deg, #a78bfa 0%, #c084fc 100%)"
                                                : "linear-gradient(135deg, #7c3aed 0%, #6d28d9 100%)"
                                            : isDark
                                              ? "rgba(255,255,255,0.1)"
                                              : "rgba(0,0,0,0.06)",
                                    },
                                }}
                                onClick={() => setShowOnlyUnreadItems(!showOnlyUnreadItems)}
                            >
                                Unread
                            </Chip>

                            {/* Menu */}
                            <Dropdown>
                                <MenuButton
                                    slots={{ root: IconButton }}
                                    slotProps={{
                                        root: {
                                            size: "sm",
                                            sx: {
                                                borderRadius: "8px",
                                                color: isDark
                                                    ? "rgba(255,255,255,0.5)"
                                                    : "rgba(0,0,0,0.45)",
                                                "&:hover": {
                                                    background: isDark
                                                        ? "rgba(255,255,255,0.06)"
                                                        : "rgba(0,0,0,0.04)",
                                                },
                                            },
                                        },
                                    }}
                                >
                                    <MoreHorizRoundedIcon sx={{ fontSize: 18 }} />
                                </MenuButton>
                                <Menu
                                    placement="bottom-end"
                                    size="sm"
                                    sx={{
                                        borderRadius: "12px",
                                        boxShadow: isDark
                                            ? "0 8px 32px rgba(0,0,0,0.5)"
                                            : "0 8px 32px rgba(0,0,0,0.12)",
                                    }}
                                >
                                    <MenuItem
                                        sx={{
                                            borderRadius: "8px",
                                            gap: 1.5,
                                            fontSize: "0.85rem",
                                        }}
                                        onClick={() => setOpenCreateGM(true)}
                                    >
                                        <GroupsIcon
                                            sx={{
                                                fontSize: 18,
                                                color: isDark ? "#a78bfa" : "#7c3aed",
                                            }}
                                        />
                                        {t.chat.sidebar.newGroupMessageMenu}
                                    </MenuItem>
                                    <MenuItem
                                        sx={{
                                            borderRadius: "8px",
                                            gap: 1.5,
                                            fontSize: "0.85rem",
                                        }}
                                        onClick={() => setOpenCreateMDM(true)}
                                    >
                                        <PeopleRoundedIcon
                                            sx={{
                                                fontSize: 18,
                                                color: isDark ? "#a78bfa" : "#7c3aed",
                                            }}
                                        />
                                        {t.chat.sidebar.newDmWithFriendsMenu}
                                    </MenuItem>
                                    {/* Mark all currently-filtered activities
                                        as read. Only meaningful on the
                                        Activity tab — the visible feed is what
                                        gets cleared. Rendered as two separate
                                        direct children (not a Fragment) so Joy's
                                        Menu registers the MenuItem for roving
                                        keyboard focus. */}
                                    {useCM.currentChatPaneType === CHAT_PANE_TYPES.ACTIVITY && (
                                        <Divider sx={{ my: 0.5 }} />
                                    )}
                                    {useCM.currentChatPaneType === CHAT_PANE_TYPES.ACTIVITY && (
                                        <MenuItem
                                            sx={{
                                                borderRadius: "8px",
                                                gap: 1.5,
                                                fontSize: "0.85rem",
                                            }}
                                            onClick={handleMarkFilteredActivityRead}
                                        >
                                            <DoneAllRoundedIcon
                                                sx={{
                                                    fontSize: 18,
                                                    color: isDark ? "#a78bfa" : "#7c3aed",
                                                }}
                                            />
                                            {t.chat.sidebar.markFilteredActivitiesReadMenu}
                                        </MenuItem>
                                    )}
                                </Menu>
                            </Dropdown>
                        </Stack>
                    </Stack>

                    {/* Current Section Label */}
                    <Typography
                        level="body-xs"
                        sx={{
                            fontWeight: 600,
                            textTransform: "uppercase",
                            letterSpacing: "0.08em",
                            fontSize: 10,
                            color: isDark ? "rgba(255,255,255,0.4)" : "rgba(0,0,0,0.4)",
                            px: 0.5,
                        }}
                    >
                        {(() => {
                            const navItem = NAV_ITEMS.find(
                                (item) => item.type === useCM.currentChatPaneType
                            );
                            return navItem
                                ? t.chat.sidebar[navItem.labelKey]
                                : t.chat.sidebar.currentSectionFallback;
                        })()}
                    </Typography>
                </Box>

                {/* Activity Filter (only shown for Activity tab).
                    `ActivityDivider` owns BOTH the single-select chip
                    row AND the trailing "Custom" multi-select menu
                    trigger; we thread the chip-set state in here so
                    the same row exposes both filters. */}
                {useCM.currentChatPaneType === CHAT_PANE_TYPES.ACTIVITY && (
                    <ActivityDivider
                        currentActivityMessageType={currentActivityMessageType}
                        selectedChipIds={selectedActivityChipIds}
                        selectedInstanceIds={selectedActivityInstanceIds}
                        selectedMentionGroupIds={selectedActivityMentionGroupIds}
                        setCurrentActivityMessageType={setCurrentActivityMessageType}
                        setSelectedChipIds={setSelectedActivityChipIds}
                        setSelectedInstanceIds={setSelectedActivityInstanceIds}
                        setSelectedMentionGroupIds={setSelectedActivityMentionGroupIds}
                        useCM={useCM}
                    />
                )}

                {/* Chat Lists */}
                <Box
                    sx={{
                        flex: 1,
                        overflow: "hidden",
                        display: "flex",
                        flexDirection: "column",
                    }}
                >
                    {/* Direct Messages (includes both DM and MDM) */}
                    {useCM.currentChatPaneType === CHAT_PANE_TYPES.DM && (
                        <ChatList
                            actions={{ setIsToDoVisible }}
                            chatRouting={chatRouting}
                            currentActivityMessageType={-1}
                            data={{ myself, setMyself }}
                            includeMDM={true}
                            selectedActivityChipIds={EMPTY_CHIP_SET}
                            selectedActivityInstanceIds={EMPTY_INSTANCE_SET}
                            selectedActivityMentionGroupIds={EMPTY_GROUP_ID_SET}
                            socket={socket}
                            state={{ showOnlyUnreadItems, incompleteTodoCount, isToDoVisible }}
                            targetChatType={1}
                            useCM={useCM}
                            usePM={usePM}
                            useTEM={useTEM}
                            useTM={useTM}
                            useUISM={useUISM}
                        />
                    )}

                    {/* Group Messages */}
                    {useCM.currentChatPaneType === CHAT_PANE_TYPES.GM && (
                        <ChatList
                            actions={{ setIsToDoVisible }}
                            chatRouting={chatRouting}
                            currentActivityMessageType={-1}
                            data={{ myself, setMyself }}
                            selectedActivityChipIds={EMPTY_CHIP_SET}
                            selectedActivityInstanceIds={EMPTY_INSTANCE_SET}
                            selectedActivityMentionGroupIds={EMPTY_GROUP_ID_SET}
                            socket={socket}
                            state={{ showOnlyUnreadItems, incompleteTodoCount, isToDoVisible }}
                            targetChatType={2}
                            useCM={useCM}
                            usePM={usePM}
                            useTEM={useTEM}
                            useTM={useTM}
                            useUISM={useUISM}
                        />
                    )}

                    {/* Project Messages */}
                    {useCM.currentChatPaneType === CHAT_PANE_TYPES.PM && (
                        <ChatList
                            actions={{ setIsToDoVisible }}
                            chatRouting={chatRouting}
                            currentActivityMessageType={-1}
                            data={{ myself, setMyself }}
                            selectedActivityChipIds={EMPTY_CHIP_SET}
                            selectedActivityInstanceIds={EMPTY_INSTANCE_SET}
                            selectedActivityMentionGroupIds={EMPTY_GROUP_ID_SET}
                            socket={socket}
                            state={{ showOnlyUnreadItems, incompleteTodoCount, isToDoVisible }}
                            targetChatType={3}
                            useCM={useCM}
                            usePM={usePM}
                            useTEM={useTEM}
                            useTM={useTM}
                            useUISM={useUISM}
                        />
                    )}

                    {/* Activity Messages */}
                    {useCM.currentChatPaneType === CHAT_PANE_TYPES.ACTIVITY && (
                        <ChatList
                            actions={{ setIsToDoVisible }}
                            chatRouting={chatRouting}
                            currentActivityMessageType={currentActivityMessageType}
                            data={{ myself, setMyself }}
                            selectedActivityChipIds={selectedActivityChipIds}
                            selectedActivityInstanceIds={selectedActivityInstanceIds}
                            selectedActivityMentionGroupIds={selectedActivityMentionGroupIds}
                            socket={socket}
                            state={{ showOnlyUnreadItems, incompleteTodoCount, isToDoVisible }}
                            targetChatType={5}
                            useCM={useCM}
                            useNM={useNM}
                            usePM={usePM}
                            useTEM={useTEM}
                            useTM={useTM}
                            useUISM={useUISM}
                        />
                    )}

                    {/* Flagged Messages */}
                    {useCM.currentChatPaneType === CHAT_PANE_TYPES.FLAGGED && (
                        <ChatList
                            actions={{ setIsToDoVisible }}
                            chatRouting={chatRouting}
                            currentActivityMessageType={currentActivityMessageType}
                            data={{ myself, setMyself }}
                            selectedActivityChipIds={EMPTY_CHIP_SET}
                            selectedActivityInstanceIds={EMPTY_INSTANCE_SET}
                            selectedActivityMentionGroupIds={EMPTY_GROUP_ID_SET}
                            socket={socket}
                            state={{ showOnlyUnreadItems, incompleteTodoCount, isToDoVisible }}
                            targetChatType={6}
                            useCM={useCM}
                            usePM={usePM}
                            useTEM={useTEM}
                            useTM={useTM}
                            useUISM={useUISM}
                        />
                    )}
                </Box>

                {/* Footer */}
                <Divider sx={{ opacity: isDark ? 0.06 : 0.08 }} />
                <Box
                    sx={{
                        px: 2,
                        py: 1.5,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                    }}
                >
                    <Typography
                        level="body-xs"
                        sx={{
                            color: isDark ? "rgba(255,255,255,0.25)" : "rgba(0,0,0,0.25)",
                            fontSize: 10,
                        }}
                    >
                        {totalUnread > 0
                            ? fmt(t.chat.sidebar.unreadCount, { count: totalUnread })
                            : t.chat.sidebar.allCaughtUp}
                    </Typography>
                </Box>
            </Sheet>

            <ModalCreateGM
                myself={myself}
                open={openCreateGM}
                setMyself={setMyself}
                setOpen={setOpenCreateGM}
                socket={socket}
                useCM={useCM}
                useTEM={useTEM}
                useUISM={useUISM}
            />
            <ModalCreateMDM
                myself={myself}
                open={openCreateMDM}
                setMyself={setMyself}
                setOpen={setOpenCreateMDM}
                socket={socket}
                useCM={useCM}
                useTEM={useTEM}
                useUISM={useUISM}
            />
        </Box>
    );
};
