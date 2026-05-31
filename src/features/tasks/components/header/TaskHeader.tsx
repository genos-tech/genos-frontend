import { useEffect, useState } from "react";
import AddIcon from "@mui/icons-material/Add";
import CancelIcon from "@mui/icons-material/Cancel";
import DeleteIcon from "@mui/icons-material/Delete";
import FlagRoundedIcon from "@mui/icons-material/FlagRounded";
import LocalOfferIcon from "@mui/icons-material/LocalOffer";
import LockOutlineIcon from "@mui/icons-material/LockOutline";
import RefreshRoundedIcon from "@mui/icons-material/RefreshRounded";
import { Box, IconButton, Typography } from "@mui/joy";
import { useColorScheme } from "@mui/joy/styles";

import { AppTooltip } from "../../../../components/ui/AppTooltip";
import { ProjectAvatar } from "../../../../components/ui/avatars/ProjectAvatar";
import { MoreMenu, MoreMenuItem } from "../../../../components/ui/MoreMenu";
import { TaskHeaderStyles } from "../../../../components/ui/styles/commonStyle";
import { useAuth } from "../../../../context/AuthContext";
import { ChatManagementState } from "../../../../hooks/chats/useChatManagement";
import { ProjectManagementState } from "../../../../hooks/common/useProjectManagement";
import { TeamManagementState } from "../../../../hooks/common/useTeamManagement";
import { UIStateManagementState } from "../../../../hooks/common/useUIStateManagement";
import { TaskManagementState } from "../../../../hooks/tasks/useTaskManagement";
import { useTranslation } from "../../../../i18n";
import { UserProps } from "../../../../types/admin";
import { SearchTeamTasksResponse } from "../../../../types/tasks";
import { isMac } from "../../../../utils/platform";
import { loadTeamTaskList } from "../../services/loadTaskSearchList";
import { TaskSidebarSearchBox } from "../sidebar/SearchBox";

interface TaskHeaderProps {
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

export const TaskHeader = ({
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
}: TaskHeaderProps) => {
    const { accessToken } = useAuth();
    const { mode } = useColorScheme();
    const isDark = mode === "dark";
    const styles = isDark ? TaskHeaderStyles.dark : TaskHeaderStyles.light;
    const { t } = useTranslation();

    // =======================================================================
    const [openSearch, setOpenSearch] = useState(false);
    const [teamTaskSearchOptions, setTeamTaskSearchOptions] = useState<SearchTeamTasksResponse[]>(
        []
    );
    const loading = openSearch && teamTaskSearchOptions.length === 0;
    const currentProjectId = usePM.currentProject?.projectId;
    // Drop the cached search results whenever the focused project changes so
    // the next open-search reloads scoped to the new project. Without this,
    // `loading` stays false (cache is non-empty) and the user would keep
    // seeing the previous project's tasks.
    useEffect(() => {
        setTeamTaskSearchOptions([]);
    }, [currentProjectId]);
    useEffect(() => {
        let active = true;

        if (!loading) {
            return undefined;
        }

        (async () => {
            // Pass the current project id (falling back to -1 = "no filter"
            // when no project is selected) so the header search only surfaces
            // tasks from the project the user is looking at.
            const loadedTeamTasks: SearchTeamTasksResponse[] = await loadTeamTaskList(
                myself,
                currentProjectId ?? -1,
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
    }, [loading, currentProjectId]);
    // =======================================================================

    // PUNCH LIST (v3 chatId migration): `AllChatProps.chatId` is `string`
    // post-flip; `projectId` is still `number`. Legacy PM chats used the
    // numeric project id as their chatId, so stringifying preserves the
    // intended match.
    const pmChat = useCM.allChats.find(
        (chat) =>
            chat.chatType === 3 &&
            usePM.currentProject &&
            chat.chatId === String(usePM.currentProject.projectId)
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
                    : "0 4px 20px rgba(124,58,237,0.08)",
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
                                myself={myself}
                                pmChat={pmChat}
                                setMyself={setMyself}
                                socket={null}
                                useCM={useCM}
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
                        <AppTooltip title={t.tasks.header.privateProject}>
                            <LockOutlineIcon
                                sx={{
                                    fontSize: "18px",
                                    color: styles.lockColor,
                                    filter: `drop-shadow(0 0 4px ${styles.lockColor})`,
                                }}
                            />
                        </AppTooltip>
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
                <AppTooltip
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
                                ? "0 2px 8px rgba(124,58,237,0.4)"
                                : "0 2px 8px rgba(124,58,237,0.3)",
                            transition: "all 0.2s ease",
                            "&:hover": {
                                background: styles.createButtonHover,
                                transform: "translateY(-1px)",
                                boxShadow: isDark
                                    ? "0 4px 12px rgba(124,58,237,0.5)"
                                    : "0 4px 12px rgba(124,58,237,0.4)",
                            },
                        }}
                        onClick={useTM.handleCreateTask}
                    >
                        <AddIcon sx={{ fontSize: "18px" }} />
                        {t.tasks.header.taskButton}
                    </IconButton>
                </AppTooltip>

                {/* Refresh Button to re-load task list */}
                {usePM.currentProject?.projectId && (
                    <AppTooltip title={t.tasks.header.refreshTasks}>
                        <IconButton
                            size="sm"
                            sx={{
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
                            }}
                            onClick={async () => {
                                if (usePM.currentProject?.projectId) {
                                    await usePM.refreshProjectTasks(
                                        usePM.currentProject.projectId
                                    );
                                }
                            }}
                        >
                            <RefreshRoundedIcon sx={{ fontSize: "18px" }} />
                        </IconButton>
                    </AppTooltip>
                )}

                {/* More Options Dropdown */}
                {(() => {
                    const items: MoreMenuItem[] = [
                        {
                            // Mirrors the sidebar's "Add milestone" row
                            // in `MilestonesListItem` — same payload
                            // (`creationKind: "milestone"`, null parent
                            // / root / milestone fk) and the same
                            // teardown of the task table view.
                            id: "newMilestone",
                            label: t.tasks.header.newMilestoneMenuItem,
                            icon: <FlagRoundedIcon sx={{ fontSize: 18, color: "#f97316" }} />,
                            onClick: () => {
                                useTM.setIsCreatingTask({
                                    flag: true,
                                    parentTaskId: null,
                                    rootTaskId: null,
                                    creationKind: "milestone",
                                    milestoneId: null,
                                });
                                useTM.setIsTaskTableVisible(false);
                            },
                        },
                        {
                            id: "newTag",
                            label: t.tasks.header.newTagMenuItem,
                            icon: <LocalOfferIcon sx={{ fontSize: 18 }} />,
                            onClick: onCreateTag,
                        },
                        {
                            id: "newProject",
                            label: t.tasks.header.newProjectMenuItem,
                            icon: <AddIcon sx={{ fontSize: 18 }} />,
                            onClick: onCreateProject,
                        },
                        {
                            id: "deleteProject",
                            label: t.tasks.header.deleteProjectMenuItem,
                            icon: <DeleteIcon sx={{ fontSize: 18 }} />,
                            danger: true,
                            onClick: onDeleteProject,
                        },
                    ];
                    return (
                        <MoreMenu
                            iconFontSize={20}
                            items={items}
                            placement="bottom-end"
                            triggerSize={36}
                            triggerSx={{
                                background: styles.buttonBg,
                                border: `1px solid ${styles.buttonBorder}`,
                                borderRadius: "10px",
                            }}
                        />
                    );
                })()}

                {/* Close Button */}
                {(useTM.isTaskPreviewVisible === true || useTM.isCreatingTask.flag === true) && (
                    <AppTooltip title={t.tasks.header.closePanel}>
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
                    </AppTooltip>
                )}
            </Box>
        </Box>
    );
};
