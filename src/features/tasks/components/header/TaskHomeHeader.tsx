import { useEffect, useState } from "react";
import AddIcon from "@mui/icons-material/Add";
import CancelIcon from "@mui/icons-material/Cancel";
import DeleteIcon from "@mui/icons-material/Delete";
import LocalOfferIcon from "@mui/icons-material/LocalOffer";
import LockOutlineIcon from "@mui/icons-material/LockOutline";
import MoreVert from "@mui/icons-material/MoreVert";
import {
    Box,
    Dropdown,
    IconButton,
    Menu,
    MenuButton,
    MenuItem,
    Tooltip,
    Typography,
} from "@mui/joy";
import { useColorScheme } from "@mui/joy/styles";

import { ProjectAvatar } from "../../../../components/ui/avatars/ProjectAvatar";
import { useAuth } from "../../../../context/AuthContext";
import { ChatManagementState } from "../../../../hooks/chats/useChatManagement";
import { ProjectManagementState } from "../../../../hooks/common/useProjectManagement";
import { TeamManagementState } from "../../../../hooks/common/useTeamManagement";
import { UIStateManagementState } from "../../../../hooks/common/useUIStateManagement";
import { TaskManagementState } from "../../../../hooks/tasks/useTaskManagement";
import { UserProps } from "../../../../types/admin";
import { SearchTeamTasksResponse } from "../../../../types/tasks";
import { isMac } from "../../../../utils/platform";
import { loadTeamTaskList } from "../../services/loadTaskSearchList";
import { TaskSidebarSearchBox } from "../sidebar/SearchBox";

// Modern theme-aware styling
const HEADER_STYLES = {
    dark: {
        containerBg: "linear-gradient(135deg, rgba(30,32,44,0.9) 0%, rgba(20,22,34,0.95) 100%)",
        containerBorder: "rgba(99,102,241,0.2)",
        titleGradient: "linear-gradient(90deg, #818cf8 0%, #a78bfa 50%, #c084fc 100%)",
        buttonBg: "linear-gradient(135deg, rgba(99,102,241,0.2) 0%, rgba(139,92,246,0.2) 100%)",
        buttonHover:
            "linear-gradient(135deg, rgba(99,102,241,0.35) 0%, rgba(139,92,246,0.35) 100%)",
        buttonBorder: "rgba(99,102,241,0.3)",
        createButtonBg: "linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)",
        createButtonHover: "linear-gradient(135deg, #818cf8 0%, #a78bfa 100%)",
        dangerBg: "linear-gradient(135deg, rgba(239,68,68,0.15) 0%, rgba(220,38,38,0.15) 100%)",
        dangerHover: "linear-gradient(135deg, rgba(239,68,68,0.25) 0%, rgba(220,38,38,0.25) 100%)",
        dangerBorder: "rgba(239,68,68,0.3)",
        menuBg: "linear-gradient(180deg, rgba(30,32,44,0.98) 0%, rgba(20,22,34,0.99) 100%)",
        menuBorder: "rgba(99,102,241,0.15)",
        textColor: "#f1f5f9",
        mutedText: "rgba(148,163,184,0.9)",
        lockColor: "#fbbf24",
    },
    light: {
        containerBg:
            "linear-gradient(135deg, rgba(255,255,255,0.95) 0%, rgba(248,250,252,0.98) 100%)",
        containerBorder: "rgba(99,102,241,0.12)",
        titleGradient: "linear-gradient(90deg, #4f46e5 0%, #7c3aed 50%, #a855f7 100%)",
        buttonBg: "linear-gradient(135deg, rgba(99,102,241,0.08) 0%, rgba(139,92,246,0.08) 100%)",
        buttonHover:
            "linear-gradient(135deg, rgba(99,102,241,0.15) 0%, rgba(139,92,246,0.15) 100%)",
        buttonBorder: "rgba(99,102,241,0.2)",
        createButtonBg: "linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)",
        createButtonHover: "linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)",
        dangerBg: "linear-gradient(135deg, rgba(239,68,68,0.08) 0%, rgba(220,38,38,0.08) 100%)",
        dangerHover: "linear-gradient(135deg, rgba(239,68,68,0.15) 0%, rgba(220,38,38,0.15) 100%)",
        dangerBorder: "rgba(239,68,68,0.2)",
        menuBg: "linear-gradient(180deg, rgba(255,255,255,0.98) 0%, rgba(248,250,252,0.99) 100%)",
        menuBorder: "rgba(99,102,241,0.1)",
        textColor: "#1e293b",
        mutedText: "rgba(71,85,105,0.9)",
        lockColor: "#d97706",
    },
};

interface TaskHomeHeaderProps {
    myself: UserProps;
    setMyself: (me: UserProps) => void;
    useCM: ChatManagementState;
    useUISM: UIStateManagementState;
    useTEM: TeamManagementState;
    usePM: ProjectManagementState;
    onCreateProject: () => void;
    onCreateTag: () => void;
    onDeleteProject: () => void;
    onCloseTaskHome: () => void;
    useTM: TaskManagementState;
}

export const TaskHomeHeader = ({
    myself,
    setMyself,
    useCM,
    useUISM,
    useTEM,
    usePM,
    onCreateProject,
    onCreateTag,
    onDeleteProject,
    onCloseTaskHome,
    useTM,
}: TaskHomeHeaderProps) => {
    const { accessToken } = useAuth();
    const { mode } = useColorScheme();
    const isDark = mode === "dark";
    const styles = isDark ? HEADER_STYLES.dark : HEADER_STYLES.light;

    // =======================================================================
    const [openSearch, setOpenSearch] = useState(false);
    const [teamTaskSearchOptions, setTeamTaskSearchOptions] = useState<SearchTeamTasksResponse[]>(
        []
    );
    const loading = openSearch && teamTaskSearchOptions.length === 0;
    useEffect(() => {
        let active = true;

        if (!loading) {
            return undefined;
        }

        (async () => {
            const loadedTeamTasks: SearchTeamTasksResponse[] = await loadTeamTaskList(
                myself,
                -1,
                "open,wip,pending",
                -1,
                accessToken,
                true
            );

            if (active) {
                setTeamTaskSearchOptions([...loadedTeamTasks]);
            }
        })();

        return () => {
            active = false;
        };
    }, [loading]);
    // =======================================================================

    const pmChat = useCM.allChats.find(
        (chat) =>
            chat.chatType === 3 &&
            usePM.currentProject &&
            chat.chatId === usePM.currentProject.projectId
    );

    return (
        <Box
            sx={{
                display: "flex",
                gap: 2,
                flexDirection: { xs: "column", sm: "row" },
                alignItems: { xs: "stretch", sm: "center" },
                flexWrap: "wrap",
                justifyContent: "space-between",
                background: styles.containerBg,
                border: `1px solid ${styles.containerBorder}`,
                borderRadius: "16px",
                px: 3,
                py: 2,
                boxShadow: isDark
                    ? "0 4px 20px rgba(0,0,0,0.3)"
                    : "0 4px 20px rgba(99,102,241,0.08)",
            }}
        >
            {/* Project Title Section */}
            <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
                {pmChat && (
                    <Box
                        sx={{
                            position: "relative",
                            display: "flex",
                            alignItems: "center",
                        }}
                    >
                        <Box
                            sx={{
                                borderRadius: "12px",
                                p: 0.5,
                                background: styles.buttonBg,
                                border: `1px solid ${styles.buttonBorder}`,
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                            }}
                        >
                            <ProjectAvatar
                                avatarSize={36}
                                useCM={useCM}
                                myself={myself}
                                pmChat={pmChat}
                                setMyself={setMyself}
                                socket={null}
                                useTEM={useTEM}
                                useUISM={useUISM}
                            />
                        </Box>
                    </Box>
                )}
                <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                    <Typography
                        component="h1"
                        level="h3"
                        sx={{
                            background: styles.titleGradient,
                            backgroundClip: "text",
                            WebkitBackgroundClip: "text",
                            WebkitTextFillColor: "transparent",
                            fontWeight: 700,
                            letterSpacing: "-0.02em",
                        }}
                    >
                        {usePM.currentProject?.projectName}
                    </Typography>
                    {usePM.currentProject?.isPrivate === true && (
                        <Tooltip title="Private Project" size="sm" variant="soft">
                            <LockOutlineIcon
                                sx={{
                                    fontSize: "18px",
                                    color: styles.lockColor,
                                    filter: `drop-shadow(0 0 4px ${styles.lockColor})`,
                                }}
                            />
                        </Tooltip>
                    )}
                </Box>
            </Box>

            {/* Search Box */}
            <Box sx={{ flex: 1, minWidth: "200px", maxWidth: "600px" }}>
                <TaskSidebarSearchBox
                    loading={loading}
                    openSearch={openSearch}
                    setOpenSearch={setOpenSearch}
                    setTeamTaskSearchOptions={setTeamTaskSearchOptions}
                    teamTaskSearchOptions={teamTaskSearchOptions}
                    useTM={useTM}
                />
            </Box>

            {/* Action Buttons */}
            <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                {/* Create Task Button */}
                <Tooltip
                    size="sm"
                    title={
                        <Box
                            sx={{
                                display: "flex",
                                alignItems: "center",
                                gap: 1,
                            }}
                        >
                            <Typography
                                level="body-xs"
                                sx={{
                                    fontFamily: "monospace",
                                    opacity: 0.7,
                                    color: "inherit",
                                    whiteSpace: "nowrap",
                                }}
                            >
                                {isMac() ? "⌘ + Ctrl + T" : "Alt + Ctrl + T"}
                            </Typography>
                        </Box>
                    }
                    variant="soft"
                    sx={{
                        background: styles.menuBg,
                        border: `1px solid ${styles.menuBorder}`,
                        borderRadius: "8px",
                    }}
                >
                    <IconButton
                        size="sm"
                        sx={{
                            background: styles.createButtonBg,
                            color: "#fff",
                            borderRadius: "10px",
                            px: 1.5,
                            py: 0.75,
                            fontSize: "13px",
                            fontWeight: 600,
                            gap: 0.5,
                            boxShadow: isDark
                                ? "0 2px 8px rgba(99,102,241,0.4)"
                                : "0 2px 8px rgba(79,70,229,0.3)",
                            transition: "all 0.2s ease",
                            "&:hover": {
                                background: styles.createButtonHover,
                                transform: "translateY(-1px)",
                                boxShadow: isDark
                                    ? "0 4px 12px rgba(99,102,241,0.5)"
                                    : "0 4px 12px rgba(79,70,229,0.4)",
                            },
                        }}
                        onClick={useTM.handleCreateTask}
                    >
                        <AddIcon sx={{ fontSize: "18px" }} />
                        Task
                    </IconButton>
                </Tooltip>

                {/* More Options Dropdown */}
                <Dropdown>
                    <MenuButton
                        slots={{ root: IconButton }}
                        slotProps={{
                            root: {
                                sx: {
                                    background: styles.buttonBg,
                                    border: `1px solid ${styles.buttonBorder}`,
                                    borderRadius: "10px",
                                    width: "36px",
                                    height: "36px",
                                    transition: "all 0.2s ease",
                                    "&:hover": {
                                        background: styles.buttonHover,
                                        transform: "translateY(-1px)",
                                    },
                                },
                            },
                        }}
                    >
                        <MoreVert sx={{ color: styles.textColor }} />
                    </MenuButton>
                    <Menu
                        size="sm"
                        sx={{
                            background: styles.menuBg,
                            border: `1px solid ${styles.menuBorder}`,
                            borderRadius: "12px",
                            boxShadow: isDark
                                ? "0 8px 32px rgba(0,0,0,0.5)"
                                : "0 8px 32px rgba(0,0,0,0.15)",
                            p: 0.5,
                        }}
                    >
                        <MenuItem
                            onClick={onCreateTag}
                            sx={{
                                borderRadius: "8px",
                                gap: 1,
                                transition: "all 0.2s ease",
                                "&:hover": {
                                    background: styles.buttonHover,
                                },
                            }}
                        >
                            <LocalOfferIcon
                                sx={{
                                    fontSize: "18px",
                                    color: isDark ? "#fbbf24" : "#d97706",
                                }}
                            />
                            <Typography
                                level="body-sm"
                                sx={{ color: styles.textColor, fontWeight: 500 }}
                            >
                                New Tag
                            </Typography>
                        </MenuItem>
                        <MenuItem
                            onClick={onCreateProject}
                            sx={{
                                borderRadius: "8px",
                                gap: 1,
                                transition: "all 0.2s ease",
                                "&:hover": {
                                    background: styles.buttonHover,
                                },
                            }}
                        >
                            <AddIcon
                                sx={{
                                    fontSize: "18px",
                                    color: isDark ? "#4ade80" : "#16a34a",
                                }}
                            />
                            <Typography
                                level="body-sm"
                                sx={{ color: styles.textColor, fontWeight: 500 }}
                            >
                                New Project
                            </Typography>
                        </MenuItem>
                        <Box
                            sx={{
                                height: "1px",
                                background: styles.containerBorder,
                                my: 0.5,
                                mx: 1,
                            }}
                        />
                        <MenuItem
                            onClick={onDeleteProject}
                            sx={{
                                borderRadius: "8px",
                                gap: 1,
                                background: styles.dangerBg,
                                transition: "all 0.2s ease",
                                "&:hover": {
                                    background: styles.dangerHover,
                                },
                            }}
                        >
                            <DeleteIcon
                                sx={{
                                    fontSize: "18px",
                                    color: isDark ? "#f87171" : "#dc2626",
                                }}
                            />
                            <Typography
                                level="body-sm"
                                sx={{
                                    color: isDark ? "#f87171" : "#dc2626",
                                    fontWeight: 600,
                                }}
                            >
                                Delete Project
                            </Typography>
                        </MenuItem>
                    </Menu>
                </Dropdown>

                {/* Close Button */}
                {(useTM.isTaskPreviewVisible === true || useTM.isCreatingTask.flag === true) && (
                    <Tooltip
                        size="sm"
                        title="Close Panel"
                        variant="soft"
                        sx={{
                            background: styles.menuBg,
                            border: `1px solid ${styles.menuBorder}`,
                            borderRadius: "8px",
                        }}
                    >
                        <IconButton
                            size="sm"
                            sx={{
                                background: styles.dangerBg,
                                border: `1px solid ${styles.dangerBorder}`,
                                borderRadius: "10px",
                                width: "36px",
                                height: "36px",
                                transition: "all 0.2s ease",
                                "&:hover": {
                                    background: styles.dangerHover,
                                    transform: "translateY(-1px)",
                                },
                            }}
                            onClick={onCloseTaskHome}
                        >
                            <CancelIcon
                                sx={{
                                    fontSize: "20px",
                                    color: isDark ? "#f87171" : "#dc2626",
                                }}
                            />
                        </IconButton>
                    </Tooltip>
                )}
            </Box>
        </Box>
    );
};
