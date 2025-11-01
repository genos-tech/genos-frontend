import { useEffect, useState } from "react";
import AddIcon from "@mui/icons-material/Add";
import CancelIcon from "@mui/icons-material/Cancel";
import DeleteIcon from "@mui/icons-material/Delete";
import LockOutlineIcon from "@mui/icons-material/LockOutline";
import MoreVert from "@mui/icons-material/MoreVert";
import SearchRoundedIcon from "@mui/icons-material/SearchRounded";
import {
    Autocomplete,
    AutocompleteOption,
    Box,
    Chip,
    CircularProgress,
    Dropdown,
    IconButton,
    ListItemContent,
    Menu,
    MenuButton,
    MenuItem,
    Tooltip,
    Typography,
} from "@mui/joy";
import { useColorScheme } from "@mui/joy/styles";
import { alpha } from "@mui/system";

import { ProjectAvatar } from "../../../../components/common/ProjectAvatar";
import { useAuth } from "../../../../context/AuthContext";
import { TaskManagementState } from "../../../../hooks/tasks/useTaskManagement";
import { UserProps } from "../../../../types/admin";
import { AllChatProps, ChatProps } from "../../../../types/chat";
import { SearchTeamTasksResponse } from "../../../../types/tasks";
import { loadTeamTaskList } from "../../services/loadTaskSearchList";
import { TaskSidebarSearchBox } from "../sidebar/SearchBox";

interface TaskHomeHeaderProps {
    myself: UserProps;
    setMyself: (me: UserProps) => void;
    allChats: AllChatProps[];
    setCurrentMainChat: (chat: ChatProps) => void;
    setOpeningService: (service: number) => void;
    teamMemberProfiles: Record<string, UserProps>;
    funcSetAllChats: () => Promise<void>;
    currentProject: any;
    onCreateProject: () => void;
    onCreateTag: () => void;
    onDeleteProject: () => void;
    onCloseTaskHome: () => void;
    TM: TaskManagementState;
}

export const TaskHomeHeader = ({
    myself,
    setMyself,
    allChats,
    setCurrentMainChat,
    setOpeningService,
    teamMemberProfiles,
    funcSetAllChats,
    currentProject,
    onCreateProject,
    onCreateTag,
    onDeleteProject,
    onCloseTaskHome,
    TM,
}: TaskHomeHeaderProps) => {
    const { accessToken } = useAuth();

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

    const pmChat = allChats.find(
        (chat) => chat.chatType === 3 && currentProject && chat.chatId === currentProject.projectId
    );

    return (
        <Box
            sx={{
                display: "flex",
                mb: 1,
                gap: 1,
                flexDirection: {
                    xs: "column",
                    sm: "row",
                },
                alignItems: {
                    xs: "start",
                    sm: "center",
                },
                flexWrap: "wrap",
                justifyContent: "space-between",
            }}
        >
            <Typography
                component="h1"
                level="h2"
                startDecorator={
                    <>
                        {pmChat && (
                            <ProjectAvatar
                                avatarSize={40}
                                funcSetAllChats={funcSetAllChats}
                                myself={myself}
                                pmChat={pmChat}
                                setCurrentMainChat={setCurrentMainChat}
                                setMyself={setMyself}
                                setOpeningService={setOpeningService}
                                socket={null}
                                teamMemberProfiles={teamMemberProfiles}
                            />
                        )}
                        {currentProject?.isPrivate === true ? (
                            <LockOutlineIcon
                                sx={{
                                    ml: "5px",
                                    mr: "-10px",
                                    mt: "8px",
                                    fontSize: "26px",
                                }}
                            />
                        ) : null}
                    </>
                }
                sx={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                }}
            >
                {currentProject?.projectName}
            </Typography>

            <Box sx={{ width: "40%" }}>
                <TaskSidebarSearchBox
                    currentPreviewTaskId={TM.currentPreviewTaskId}
                    loading={loading}
                    openSearch={openSearch}
                    setCurrentPreviewTaskId={TM.setCurrentPreviewTaskId}
                    setIsTaskPreviewVisible={TM.setIsTaskPreviewVisible}
                    setOpenSearch={setOpenSearch}
                    setTeamTaskSearchOptions={setTeamTaskSearchOptions}
                    teamTaskSearchOptions={teamTaskSearchOptions}
                />
            </Box>

            <Box>
                <Tooltip size="sm" title="Create New Task" variant="outlined">
                    <IconButton
                        component="p"
                        size="sm"
                        variant="outlined"
                        sx={{
                            fontSize: "15px",
                            paddingRight: "10px",
                        }}
                        onClick={TM.handleCreateTask}
                    >
                        <AddIcon />
                        Task
                    </IconButton>
                </Tooltip>
                <Dropdown>
                    <MenuButton
                        slots={{ root: IconButton }}
                        slotProps={{
                            root: { color: "neutral" },
                        }}
                    >
                        <MoreVert />
                    </MenuButton>
                    <Menu size="sm">
                        <MenuItem onClick={onCreateTag}>
                            <AddIcon />
                            New Tag
                        </MenuItem>
                        <MenuItem onClick={onCreateProject}>
                            <AddIcon />
                            New Project
                        </MenuItem>
                        <MenuItem
                            sx={{
                                color: "red",
                                fontWeight: "bold",
                            }}
                            onClick={onDeleteProject}
                        >
                            <DeleteIcon sx={{ color: "red" }} />
                            Delete Project
                        </MenuItem>
                    </Menu>
                </Dropdown>
                {(TM.isTaskPreviewVisible === true || TM.isCreatingTask.flag === true) && (
                    <Tooltip size="sm" title="Close" variant="outlined">
                        <IconButton
                            color="neutral"
                            size="sm"
                            variant="plain"
                            onClick={onCloseTaskHome}
                        >
                            <CancelIcon />
                        </IconButton>
                    </Tooltip>
                )}
            </Box>
        </Box>
    );
};
