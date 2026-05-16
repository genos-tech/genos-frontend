import { useState } from "react";
import AllInboxRoundedIcon from "@mui/icons-material/AllInboxRounded";
import AssignmentRoundedIcon from "@mui/icons-material/AssignmentRounded";
import LogoutRoundedIcon from "@mui/icons-material/LogoutRounded";
import NoteAltRoundedIcon from "@mui/icons-material/NoteAltRounded";
import QuestionAnswerRoundedIcon from "@mui/icons-material/QuestionAnswerRounded";
import SearchRoundedIcon from "@mui/icons-material/SearchRounded";
import SettingsRoundedIcon from "@mui/icons-material/SettingsRounded";
import {
    Avatar,
    Badge,
    Box,
    Divider,
    GlobalStyles,
    List,
    ListItem,
    Sheet,
    Tooltip,
    Typography,
} from "@mui/joy";
import ListItemButton, { listItemButtonClasses } from "@mui/joy/ListItemButton";
import { useColorScheme } from "@mui/joy/styles";
import { useLocation, useNavigate } from "react-router-dom";
import { Socket } from "socket.io-client";

import { useAuth } from "../../context/AuthContext";
import { UserProfile } from "../../features/admin/components/modals/ModalUserProfile";
import { TeamDropdown } from "../../features/admin/components/teamDropdown";
import { ChatManagementState } from "../../hooks/chats/useChatManagement";
import { TeamManagementState } from "../../hooks/common/useTeamManagement";
import { UIStateManagementState } from "../../hooks/common/useUIStateManagement";
import { InboxManagementState } from "../../hooks/inbox/useInboxManagement";
import { analytics } from "../../services/analytics";
import { purplePalette } from "../../theme/purplePalette";
import { UserProps } from "../../types/admin";
import { isMac } from "../../utils/platform";
import { ColorSchemeToggle } from "./colorSchemeToggle";
import { SettingsModal } from "./SettingsModal";

const base_url = import.meta.env.VITE_API_BASE_URL;
const media_url = import.meta.env.VITE_MEDIA_ROOT_DJANGO;

// Navigation item configuration. `shortcutKey` mirrors `SERVICE_BY_KEY` in
// `hooks/common/useGlobalServiceShortcut.ts` — keep them in sync so the
// tooltip displays the combo the listener actually responds to.
const NAV_ACCENT = {
    dark: purplePalette.dark.accentSoft,
    light: purplePalette.light.accent,
};

const NAV_ITEMS = [
    {
        id: 0,
        icon: AllInboxRoundedIcon,
        label: "Inbox",
        path: "/workspace/inbox",
        shortcutKey: "I",
        colorScheme: NAV_ACCENT,
    },
    {
        id: 1,
        icon: QuestionAnswerRoundedIcon,
        label: "Chats",
        path: "/workspace/chat",
        shortcutKey: "C",
        colorScheme: NAV_ACCENT,
    },
    {
        id: 2,
        icon: AssignmentRoundedIcon,
        label: "Tasks",
        path: "/workspace/tasks",
        shortcutKey: "T",
        colorScheme: NAV_ACCENT,
    },
    {
        id: 3,
        icon: NoteAltRoundedIcon,
        label: "Notes",
        path: "/workspace/notes",
        shortcutKey: "N",
        colorScheme: NAV_ACCENT,
    },
];

type SidebarProps = {
    useTEM: TeamManagementState;
    socket: Socket | null;
    myself: UserProps;
    setMyself: (me: UserProps) => void;
    useIM: InboxManagementState;
    useCM: ChatManagementState;
    useUISM: UIStateManagementState;
    onOpenSpotlight: () => void;
};

export const Sidebar = (props: SidebarProps) => {
    const { useTEM, socket, myself, setMyself, useIM, useCM, useUISM, onOpenSpotlight } = props;
    const { setAccessToken } = useAuth();
    const { mode } = useColorScheme();
    const isDark = mode === "dark";
    const palette = isDark ? purplePalette.dark : purplePalette.light;
    // Solid bg color used to "cut out" badges and avatar borders against
    // the sidebar gradient — must match the gradient's start color so the
    // ring blends seamlessly into the surface behind it.
    const sidebarBg = isDark ? "rgba(20,14,34,1)" : "rgba(252,250,255,1)";
    const navigate = useNavigate();
    const location = useLocation();

    const [openUserProfile, setOpenUserProfile] = useState<boolean>(false);
    const [avatarUserId, setAvatarUserId] = useState<string | undefined>(undefined);
    const [openSettings, setOpenSettings] = useState<boolean>(false);

    const handleLogout = async () => {
        try {
            const response = await fetch(`${base_url}/user/signout/`, {
                method: "POST",
                credentials: "include",
            });

            if (response.ok) {
                // Clear all localStorage items
                const keysToRemove = [
                    "isSigningIn",
                    "userEmail",
                    "userName",
                    "userId",
                    "avatarImgPath",
                    "teamId",
                    "tsJoined",
                    "isOfflineForced",
                    "role",
                    "baseCountry",
                    "customStatus",
                    "teamName",
                    "lastOpenMyNoteId",
                    "lastOpenNoteType",
                    "lastChatType",
                    "lastDMChatId",
                    "lastGMChatId",
                    "lastPMChatId",
                    "lastPinnedChatId",
                    "lastPinnedChatType",
                    "lastProjectId",
                    "lastOpenChatNoteId",
                    "lastOpenTaskNoteId",
                    "currentMainChatId",
                ];
                keysToRemove.forEach((key) => localStorage.setItem(key, ""));
                localStorage.setItem("isOfflineForced", "false");
                analytics.reset();

                setAccessToken(null);
                navigate("/");
            } else {
                console.error("Logout failed");
            }
        } catch (error) {
            console.error("Error logging out:", error);
        }
    };

    const handleNavClick = (path: string) => {
        navigate(path);
    };

    // Get badge count for a service
    const getBadgeCount = (serviceId: number): number => {
        switch (serviceId) {
            case 0:
                return useIM.unReadInboxItemCount;
            case 1:
                return useCM.unReadChatAndActivityCounts;
            default:
                return 0;
        }
    };

    return (
        <Sheet
            className="Sidebar"
            sx={{
                position: { xs: "fixed", md: "sticky" },
                transform: {
                    xs: "translateX(calc(100% * (var(--SideNavigation-slideIn, 0) - 1)))",
                    md: "none",
                },
                transition: "transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
                height: "100dvh",
                width: "var(--Sidebar-width)",
                display: "flex",
                flexDirection: "column",
                borderRight: "1px solid",
                borderColor: palette.divider,
                background: isDark
                    ? "linear-gradient(180deg, rgba(20,14,34,1) 0%, rgba(11,10,22,1) 100%)"
                    : "linear-gradient(180deg, rgba(252,250,255,1) 0%, rgba(248,245,255,1) 100%)",
                overflow: "hidden",
            }}
        >
            <GlobalStyles
                styles={(theme) => ({
                    ":root": {
                        "--Sidebar-width": "68px",
                        [theme.breakpoints.up("lg")]: {
                            "--Sidebar-width": "68px",
                        },
                    },
                })}
            />

            {/* Header - Team & Theme Toggle */}
            <Box
                sx={{
                    display: "flex",
                    flexDirection: "column",
                    gap: 1,
                    alignItems: "center",
                    pt: 2,
                    pb: 1.5,
                }}
            >
                <TeamDropdown
                    myself={myself}
                    setAvatarUserId={setAvatarUserId}
                    setMyself={setMyself}
                    setOpenUserProfile={setOpenUserProfile}
                    socket={socket}
                    useCM={useCM}
                    useTEM={useTEM}
                    useUISM={useUISM}
                />
                <ColorSchemeToggle />
            </Box>

            <Divider sx={{ opacity: isDark ? 0.06 : 0.08, mx: 1.5 }} />

            {/* Navigation Items */}
            <Box
                sx={{
                    minHeight: 0,
                    overflow: "hidden auto",
                    flexGrow: 1,
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    py: 1.5,
                    [`& .${listItemButtonClasses.root}`]: {
                        gap: 0.5,
                    },
                }}
            >
                <List
                    size="sm"
                    sx={{
                        gap: 0.75,
                        "--ListItem-radius": "12px",
                        px: 1,
                    }}
                >
                    {/* Spotlight search — overlay, not a route, so no
                        active state. Shortcut hint in the tooltip
                        mirrors the binding in `useSpotlight.ts`. */}
                    <ListItem>
                        <Tooltip
                            placement="right"
                            size="sm"
                            sx={{ zIndex: 10020 }}
                            title={isMac() ? "Search · ⌘ K" : "Search · Ctrl + K"}
                            variant="outlined"
                        >
                            <ListItemButton
                                sx={{
                                    flexDirection: "column",
                                    alignItems: "center",
                                    py: 1,
                                    px: 1.25,
                                    borderRadius: "12px",
                                    transition: "all 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
                                    background: "transparent",
                                    border: "1px solid transparent",
                                    "&:hover": {
                                        background: isDark
                                            ? "rgba(255,255,255,0.04)"
                                            : "rgba(0,0,0,0.03)",
                                        transform: "translateY(-1px)",
                                    },
                                    "&:active": {
                                        transform: "translateY(0)",
                                    },
                                }}
                                onClick={onOpenSpotlight}
                            >
                                <Box
                                    sx={{
                                        width: 32,
                                        height: 32,
                                        borderRadius: "10px",
                                        display: "flex",
                                        alignItems: "center",
                                        justifyContent: "center",
                                        background: isDark
                                            ? "rgba(255,255,255,0.04)"
                                            : "rgba(0,0,0,0.03)",
                                        transition: "all 0.2s ease",
                                    }}
                                >
                                    <SearchRoundedIcon
                                        sx={{
                                            fontSize: 20,
                                            color: isDark
                                                ? "rgba(255,255,255,0.55)"
                                                : "rgba(0,0,0,0.5)",
                                            transition: "color 0.2s ease",
                                        }}
                                    />
                                </Box>
                                <Typography
                                    level="body-xs"
                                    sx={{
                                        mt: 0.5,
                                        fontSize: "0.65rem",
                                        fontWeight: 500,
                                        color: isDark
                                            ? "rgba(255,255,255,0.55)"
                                            : "rgba(0,0,0,0.5)",
                                        transition: "all 0.2s ease",
                                    }}
                                >
                                    Search
                                </Typography>
                            </ListItemButton>
                        </Tooltip>
                    </ListItem>

                    {NAV_ITEMS.map((item) => {
                        const Icon = item.icon;
                        const isActive = location.pathname.includes(item.path);
                        const badgeCount = getBadgeCount(item.id);
                        const color = isDark ? item.colorScheme.dark : item.colorScheme.light;

                        return (
                            <ListItem key={item.id}>
                                <Tooltip
                                    placement="right"
                                    size="sm"
                                    sx={{ zIndex: 10020 }}
                                    title={isMac() ? "Hold ⌘ + tap Ctrl" : "Hold Ctrl + tap Alt"}
                                    variant="outlined"
                                >
                                    <ListItemButton
                                        sx={{
                                            flexDirection: "column",
                                            alignItems: "center",
                                            py: 1,
                                            px: 1.25,
                                            borderRadius: "12px",
                                            transition: "all 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
                                            background: isActive
                                                ? isDark
                                                    ? `linear-gradient(135deg, ${color}20 0%, ${color}10 100%)`
                                                    : `linear-gradient(135deg, ${color}15 0%, ${color}08 100%)`
                                                : "transparent",
                                            border: "1px solid",
                                            borderColor: isActive
                                                ? isDark
                                                    ? `${color}35`
                                                    : `${color}25`
                                                : "transparent",
                                            "&:hover": {
                                                background: isActive
                                                    ? isDark
                                                        ? `linear-gradient(135deg, ${color}25 0%, ${color}15 100%)`
                                                        : `linear-gradient(135deg, ${color}20 0%, ${color}12 100%)`
                                                    : isDark
                                                      ? "rgba(255,255,255,0.04)"
                                                      : "rgba(0,0,0,0.03)",
                                                transform: "translateY(-1px)",
                                            },
                                            "&:active": {
                                                transform: "translateY(0)",
                                            },
                                        }}
                                        onClick={() => handleNavClick(item.path)}
                                    >
                                        <Badge
                                            badgeContent={badgeCount > 0 ? badgeCount : 0}
                                            invisible={badgeCount === 0}
                                            size="sm"
                                            sx={{
                                                "& .MuiBadge-badge": {
                                                    background: isDark
                                                        ? `linear-gradient(135deg, ${color} 0%, ${color}cc 100%)`
                                                        : `linear-gradient(135deg, ${color} 0%, ${color}cc 100%)`,
                                                    color: "#fff",
                                                    fontWeight: 700,
                                                    fontSize: "0.6rem",
                                                    minWidth: 20,
                                                    height: 20,
                                                    pt: 0.25,
                                                    boxShadow: `0 2px 6px ${color}40`,
                                                    border: "2px solid",
                                                    borderColor: isDark
                                                        ? "rgba(18,18,22,1)"
                                                        : "rgba(252,252,255,1)",
                                                },
                                            }}
                                        >
                                            <Box
                                                sx={{
                                                    width: 32,
                                                    height: 32,
                                                    borderRadius: "10px",
                                                    display: "flex",
                                                    alignItems: "center",
                                                    justifyContent: "center",
                                                    background: isActive
                                                        ? isDark
                                                            ? `linear-gradient(135deg, ${color}25 0%, ${color}15 100%)`
                                                            : `linear-gradient(135deg, ${color}18 0%, ${color}10 100%)`
                                                        : isDark
                                                          ? "rgba(255,255,255,0.04)"
                                                          : "rgba(0,0,0,0.03)",
                                                    transition: "all 0.2s ease",
                                                }}
                                            >
                                                <Icon
                                                    sx={{
                                                        fontSize: 20,
                                                        color: isActive
                                                            ? color
                                                            : isDark
                                                              ? "rgba(255,255,255,0.45)"
                                                              : "rgba(0,0,0,0.4)",
                                                        transition: "color 0.2s ease",
                                                    }}
                                                />
                                            </Box>
                                        </Badge>
                                        <Typography
                                            level="body-xs"
                                            sx={{
                                                mt: 0.5,
                                                fontSize: "0.65rem",
                                                fontWeight: isActive ? 600 : 500,
                                                color: isActive
                                                    ? color
                                                    : isDark
                                                      ? "rgba(255,255,255,0.55)"
                                                      : "rgba(0,0,0,0.5)",
                                                transition: "all 0.2s ease",
                                            }}
                                        >
                                            {item.label}
                                        </Typography>
                                    </ListItemButton>
                                </Tooltip>
                            </ListItem>
                        );
                    })}
                </List>

                {/* Bottom Actions */}
                <List
                    size="sm"
                    sx={{
                        mt: "auto",
                        flexGrow: 0,
                        "--ListItem-radius": "12px",
                        px: 1,
                    }}
                >
                    <ListItem>
                        <Tooltip
                            placement="right"
                            size="sm"
                            sx={{ zIndex: 10020 }}
                            title="Settings"
                            variant="outlined"
                        >
                            <ListItemButton
                                sx={{
                                    flexDirection: "column",
                                    alignItems: "center",
                                    py: 1,
                                    px: 1.25,
                                    borderRadius: "12px",
                                    transition: "all 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
                                    "&:hover": {
                                        background: isDark
                                            ? "rgba(255,255,255,0.06)"
                                            : "rgba(0,0,0,0.04)",
                                        "& .settings-icon": {
                                            color: isDark
                                                ? "rgba(255,255,255,0.85)"
                                                : "rgba(0,0,0,0.75)",
                                        },
                                    },
                                }}
                                onClick={() => setOpenSettings(true)}
                            >
                                <Box
                                    sx={{
                                        width: 32,
                                        height: 32,
                                        borderRadius: "10px",
                                        display: "flex",
                                        alignItems: "center",
                                        justifyContent: "center",
                                        background: isDark
                                            ? "rgba(255,255,255,0.04)"
                                            : "rgba(0,0,0,0.03)",
                                        transition: "all 0.2s ease",
                                    }}
                                >
                                    <SettingsRoundedIcon
                                        className="settings-icon"
                                        sx={{
                                            fontSize: 18,
                                            color: isDark
                                                ? "rgba(255,255,255,0.45)"
                                                : "rgba(0,0,0,0.4)",
                                            transition: "color 0.2s ease",
                                        }}
                                    />
                                </Box>
                            </ListItemButton>
                        </Tooltip>
                    </ListItem>
                    <ListItem>
                        <Tooltip
                            placement="right"
                            size="sm"
                            sx={{ zIndex: 10020 }}
                            title="Sign out"
                            variant="outlined"
                        >
                            <ListItemButton
                                sx={{
                                    flexDirection: "column",
                                    alignItems: "center",
                                    py: 1,
                                    px: 1.25,
                                    borderRadius: "12px",
                                    transition: "all 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
                                    "&:hover": {
                                        background: palette.dangerTintBg,
                                        "& .logout-icon": {
                                            color: palette.dangerTint,
                                        },
                                    },
                                }}
                                onClick={handleLogout}
                            >
                                <Box
                                    sx={{
                                        width: 32,
                                        height: 32,
                                        borderRadius: "10px",
                                        display: "flex",
                                        alignItems: "center",
                                        justifyContent: "center",
                                        background: isDark
                                            ? "rgba(255,255,255,0.04)"
                                            : "rgba(0,0,0,0.03)",
                                        transition: "all 0.2s ease",
                                    }}
                                >
                                    <LogoutRoundedIcon
                                        className="logout-icon"
                                        sx={{
                                            fontSize: 18,
                                            color: isDark
                                                ? "rgba(255,255,255,0.45)"
                                                : "rgba(0,0,0,0.4)",
                                            transition: "color 0.2s ease",
                                        }}
                                    />
                                </Box>
                            </ListItemButton>
                        </Tooltip>
                    </ListItem>
                </List>
            </Box>

            <Divider sx={{ opacity: isDark ? 0.06 : 0.08, mx: 1.5 }} />

            {/* User Avatar Section */}
            <Box
                sx={{
                    display: "flex",
                    justifyContent: "center",
                    py: 1.5,
                    cursor: "pointer",
                    position: "relative",
                }}
                onClick={() => setOpenUserProfile(true)}
            >
                <Tooltip
                    placement="right"
                    size="sm"
                    sx={{ zIndex: 10020 }}
                    title="Open My Profile"
                    variant="outlined"
                >
                    <Box
                        sx={{
                            position: "relative",
                            borderRadius: "50%",
                            p: 0.25,
                            background:
                                myself?.isOfflineForced !== "true"
                                    ? isDark
                                        ? "linear-gradient(135deg, #4ade80 0%, #22c55e 100%)"
                                        : "linear-gradient(135deg, #22c55e 0%, #16a34a 100%)"
                                    : isDark
                                      ? "rgba(255,255,255,0.15)"
                                      : "rgba(0,0,0,0.1)",
                            transition: "all 0.3s ease",
                            "&:hover": {
                                transform: "scale(1.05)",
                                boxShadow:
                                    myself?.isOfflineForced !== "true"
                                        ? isDark
                                            ? "0 4px 16px rgba(74,222,128,0.35)"
                                            : "0 4px 16px rgba(34,197,94,0.3)"
                                        : "none",
                            },
                        }}
                    >
                        <Avatar
                            size="sm"
                            src={`${media_url}/${myself.avatarImgPath}`}
                            variant="solid"
                            sx={{
                                width: 34,
                                height: 34,
                                border: "2px solid",
                                borderColor: sidebarBg,
                            }}
                        >
                            {myself.userName[0].toUpperCase()}
                        </Avatar>
                    </Box>
                </Tooltip>

                {/* Online status indicator */}
                <Box
                    sx={{
                        position: "absolute",
                        bottom: 12,
                        right: 12,
                        width: 12,
                        height: 12,
                        borderRadius: "50%",
                        background:
                            myself?.isOfflineForced !== "true"
                                ? isDark
                                    ? "linear-gradient(135deg, #4ade80 0%, #22c55e 100%)"
                                    : "linear-gradient(135deg, #22c55e 0%, #16a34a 100%)"
                                : isDark
                                  ? "#6b7280"
                                  : "#9ca3af",
                        border: "2px solid",
                        borderColor: sidebarBg,
                        boxShadow:
                            myself?.isOfflineForced !== "true"
                                ? isDark
                                    ? "0 2px 8px rgba(74,222,128,0.4)"
                                    : "0 2px 8px rgba(34,197,94,0.35)"
                                : "none",
                    }}
                />
            </Box>

            <UserProfile
                isYou={true}
                myself={myself}
                openUserProfile={openUserProfile}
                setMyself={setMyself}
                setOpenUserProfile={setOpenUserProfile}
                socket={socket}
                useCM={useCM}
                user={useTEM.teamMemberProfiles[myself.userId]}
                useUISM={useUISM}
            />

            {/* User profile for team members */}
            {avatarUserId && (
                <UserProfile
                    isYou={false}
                    myself={myself}
                    openUserProfile={openUserProfile}
                    setMyself={setMyself}
                    setOpenUserProfile={setOpenUserProfile}
                    socket={socket}
                    useCM={useCM}
                    user={useTEM.teamMemberProfiles[avatarUserId]}
                    useUISM={useUISM}
                />
            )}

            <SettingsModal open={openSettings} onClose={() => setOpenSettings(false)} />
        </Sheet>
    );
};
