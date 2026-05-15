import { useEffect, useState } from "react";
import AccountTreeRoundedIcon from "@mui/icons-material/AccountTreeRounded";
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
import { TaskManagementState } from "../../../../hooks/tasks/useTaskManagement";
import { UserProps } from "../../../../types/admin";
import { isMac } from "../../../../utils/platform";
import { useChatRouting } from "../../hooks/useChatRouting";
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
        label: "Direct Messages",
        shortLabel: "DMs",
        colorScheme: { dark: "#a78bfa", light: "#7c3aed" },
    },
    {
        type: CHAT_PANE_TYPES.GM,
        icon: GroupsRoundedIcon,
        label: "Group Messages",
        shortLabel: "Groups",
        colorScheme: { dark: "#a78bfa", light: "#7c3aed" },
    },
    {
        type: CHAT_PANE_TYPES.PM,
        icon: AccountTreeRoundedIcon,
        label: "Project Updates",
        shortLabel: "Projects",
        colorScheme: { dark: "#a78bfa", light: "#7c3aed" },
    },
    {
        type: CHAT_PANE_TYPES.FLAGGED,
        icon: FlagRoundedIcon,
        label: "Flagged Messages",
        shortLabel: "Flagged",
        colorScheme: { dark: "#a78bfa", light: "#7c3aed" },
    },
    {
        type: CHAT_PANE_TYPES.ACTIVITY,
        icon: NotificationsActiveRoundedIcon,
        label: "Recent Activities (last 30 days)",
        shortLabel: "Activity",
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
        chatRouting,
    } = props;
    const { mode } = useColorScheme();
    const isDark = mode === "dark";

    const [openSearchBox, setOpenSearchBox] = useState(false);
    const [openCreateGM, setOpenCreateGM] = useState(false);
    const [openCreateMDM, setOpenCreateMDM] = useState(false);
    const [showOnlyUnreadItems, setShowOnlyUnreadItems] = useState(false);
    const [openJoinGM, setOpenJoinGM] = useState({
        flag: false,
        chatId: -1,
        chatName: "",
    });

    // 0: none, 1: thread, 2: task, 3: mention, 4: reaction
    const [currentActivityMessageType, setCurrentActivityMessageType] = useState<number>(0);

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
        <Box sx={{ display: "flex", height: "100dvh" }}>
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
                    useCM={useCM}
                    myself={myself}
                    openSearchBox={openSearchBox}
                    setMyself={setMyself}
                    setOpenJoinGM={setOpenJoinGM}
                    setOpenSearchBox={setOpenSearchBox}
                    socket={socket}
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
                        direction="row"
                        alignItems="center"
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
                                        title={item.label}
                                        size="sm"
                                        placement="top"
                                        variant="outlined"
                                        sx={{ zIndex: 10020 }}
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
                                                onClick={() => handleNavClick(item.type)}
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
                        <Stack direction="row" spacing={0.5} alignItems="center">
                            {/* Unread Filter Toggle */}
                            <Chip
                                size="sm"
                                variant={showOnlyUnreadItems ? "solid" : "soft"}
                                color={showOnlyUnreadItems ? "primary" : "neutral"}
                                onClick={() => setShowOnlyUnreadItems(!showOnlyUnreadItems)}
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
                                    size="sm"
                                    placement="bottom-end"
                                    sx={{
                                        borderRadius: "12px",
                                        boxShadow: isDark
                                            ? "0 8px 32px rgba(0,0,0,0.5)"
                                            : "0 8px 32px rgba(0,0,0,0.12)",
                                    }}
                                >
                                    <MenuItem
                                        onClick={() => setOpenCreateGM(true)}
                                        sx={{
                                            borderRadius: "8px",
                                            gap: 1.5,
                                            fontSize: "0.85rem",
                                        }}
                                    >
                                        <GroupsIcon
                                            sx={{
                                                fontSize: 18,
                                                color: isDark ? "#a78bfa" : "#7c3aed",
                                            }}
                                        />
                                        New Group Message
                                    </MenuItem>
                                    <MenuItem
                                        onClick={() => setOpenCreateMDM(true)}
                                        sx={{
                                            borderRadius: "8px",
                                            gap: 1.5,
                                            fontSize: "0.85rem",
                                        }}
                                    >
                                        <PeopleRoundedIcon
                                            sx={{
                                                fontSize: 18,
                                                color: isDark ? "#a78bfa" : "#7c3aed",
                                            }}
                                        />
                                        New DM with friends
                                    </MenuItem>
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
                        {NAV_ITEMS.find((item) => item.type === useCM.currentChatPaneType)
                            ?.label || "Messages"}
                    </Typography>
                </Box>

                {/* Activity Filter (only shown for Activity tab) */}
                {useCM.currentChatPaneType === CHAT_PANE_TYPES.ACTIVITY && (
                    <ActivityDivider
                        currentActivityMessageType={currentActivityMessageType}
                        setCurrentActivityMessageType={setCurrentActivityMessageType}
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
                            usePM={usePM}
                            targetChatType={1}
                            includeMDM={true}
                            useCM={useCM}
                            currentActivityMessageType={-1}
                            socket={socket}
                            useTEM={useTEM}
                            useUISM={useUISM}
                            useTM={useTM}
                            actions={{ setIsToDoVisible }}
                            data={{ myself, setMyself }}
                            state={{ showOnlyUnreadItems, incompleteTodoCount, isToDoVisible }}
                            chatRouting={chatRouting}
                        />
                    )}

                    {/* Group Messages */}
                    {useCM.currentChatPaneType === CHAT_PANE_TYPES.GM && (
                        <ChatList
                            usePM={usePM}
                            targetChatType={2}
                            useCM={useCM}
                            currentActivityMessageType={-1}
                            socket={socket}
                            useTEM={useTEM}
                            useUISM={useUISM}
                            useTM={useTM}
                            actions={{ setIsToDoVisible }}
                            data={{ myself, setMyself }}
                            state={{ showOnlyUnreadItems, incompleteTodoCount, isToDoVisible }}
                            chatRouting={chatRouting}
                        />
                    )}

                    {/* Project Messages */}
                    {useCM.currentChatPaneType === CHAT_PANE_TYPES.PM && (
                        <ChatList
                            usePM={usePM}
                            targetChatType={3}
                            useCM={useCM}
                            currentActivityMessageType={-1}
                            socket={socket}
                            useTEM={useTEM}
                            useUISM={useUISM}
                            useTM={useTM}
                            actions={{ setIsToDoVisible }}
                            data={{ myself, setMyself }}
                            state={{ showOnlyUnreadItems, incompleteTodoCount, isToDoVisible }}
                            chatRouting={chatRouting}
                        />
                    )}

                    {/* Activity Messages */}
                    {useCM.currentChatPaneType === CHAT_PANE_TYPES.ACTIVITY && (
                        <ChatList
                            usePM={usePM}
                            targetChatType={5}
                            useCM={useCM}
                            currentActivityMessageType={currentActivityMessageType}
                            socket={socket}
                            useTEM={useTEM}
                            useUISM={useUISM}
                            useTM={useTM}
                            actions={{ setIsToDoVisible }}
                            data={{ myself, setMyself }}
                            state={{ showOnlyUnreadItems, incompleteTodoCount, isToDoVisible }}
                            chatRouting={chatRouting}
                        />
                    )}

                    {/* Flagged Messages */}
                    {useCM.currentChatPaneType === CHAT_PANE_TYPES.FLAGGED && (
                        <ChatList
                            usePM={usePM}
                            targetChatType={6}
                            useCM={useCM}
                            currentActivityMessageType={currentActivityMessageType}
                            socket={socket}
                            useTEM={useTEM}
                            useUISM={useUISM}
                            useTM={useTM}
                            actions={{ setIsToDoVisible }}
                            data={{ myself, setMyself }}
                            state={{ showOnlyUnreadItems, incompleteTodoCount, isToDoVisible }}
                            chatRouting={chatRouting}
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
                            ? `${totalUnread} unread message${totalUnread > 1 ? "s" : ""}`
                            : "All caught up"}
                    </Typography>
                </Box>
            </Sheet>

            <ModalCreateGM
                useCM={useCM}
                useTEM={useTEM}
                useUISM={useUISM}
                setMyself={setMyself}
                myself={myself}
                open={openCreateGM}
                setOpen={setOpenCreateGM}
                socket={socket}
            />
            <ModalCreateMDM
                useCM={useCM}
                useUISM={useUISM}
                useTEM={useTEM}
                myself={myself}
                setMyself={setMyself}
                open={openCreateMDM}
                setOpen={setOpenCreateMDM}
                socket={socket}
            />
        </Box>
    );
};
