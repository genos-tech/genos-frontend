import { useState } from "react";
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
import { UserProps } from "../../../../types/admin";
import { AllChatProps, ChatProps } from "../../../../types/chat";
import { SearchTeamTasksResponse, TaskType, TaskTypesProps } from "../../../../types/tasks";

const taskTypes: TaskTypesProps = {
    ongoing: { id: 1, statuses: ["Open", "WIP", "Pending"], name: "Ongoing" },
    closed: { id: 2, statuses: ["Closed"], name: "Closed" },
    deleted: { id: 3, statuses: ["Deleted"], name: "Deleted" },
};

interface TaskHomeHeaderProps {
    myself: UserProps;
    setMyself: (me: UserProps) => void;
    allChats: AllChatProps[];
    setCurrentMainChat: (chat: ChatProps) => void;
    setOpeningService: (service: number) => void;
    openingService: number;
    teamMemberProfiles: Record<string, UserProps>;
    funcSetAllChats: () => Promise<void>;
    currentProject: any;
    displayTaskType: TaskType;
    setDisplayTaskType: (type: TaskType) => void;
    teamTaskSearchOptions: SearchTeamTasksResponse[];
    loading: boolean;
    openSearch: boolean;
    setOpenSearch: (open: boolean) => void;
    onSearchChange: (value: any) => void;
    onCreateTask: () => void;
    onCreateProject: () => void;
    onCreateTag: () => void;
    onDeleteProject: () => void;
    onCloseTaskHome: () => void;
    isTaskPreviewVisible: boolean;
    isCreatingTask: boolean;
}

export const TaskHomeHeader = ({
    myself,
    setMyself,
    allChats,
    setCurrentMainChat,
    setOpeningService,
    openingService,
    teamMemberProfiles,
    funcSetAllChats,
    currentProject,
    displayTaskType,
    setDisplayTaskType,
    teamTaskSearchOptions,
    loading,
    openSearch,
    setOpenSearch,
    onSearchChange,
    onCreateTask,
    onCreateProject,
    onCreateTag,
    onDeleteProject,
    onCloseTaskHome,
    isTaskPreviewVisible,
    isCreatingTask,
}: TaskHomeHeaderProps) => {
    const { mode } = useColorScheme();

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
                                myself={myself}
                                pmChat={pmChat}
                                setMyself={setMyself}
                                socket={null}
                                funcSetAllChats={funcSetAllChats}
                                setCurrentMainChat={setCurrentMainChat}
                                setOpeningService={setOpeningService}
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
                <Dropdown>
                    <MenuButton
                        slots={{ root: IconButton }}
                        slotProps={{
                            root: { color: "neutral" },
                        }}
                    >
                        <Chip
                            size="lg"
                            variant="outlined"
                            color={
                                displayTaskType.id === 1
                                    ? "primary"
                                    : displayTaskType.id === 2
                                      ? "success"
                                      : displayTaskType.id === 3
                                        ? "danger"
                                        : "neutral"
                            }
                            sx={{
                                mx: "8px",
                                fontWeight: "bold",
                                borderRadius: "5px",
                            }}
                        >
                            {displayTaskType.name}
                        </Chip>
                    </MenuButton>
                    <Menu size="sm">
                        <MenuItem onClick={() => setDisplayTaskType(taskTypes.ongoing)}>
                            <Chip
                                color="primary"
                                size="lg"
                                variant="outlined"
                                sx={{ borderRadius: "5px" }}
                            >
                                {taskTypes.ongoing.name}
                            </Chip>
                        </MenuItem>
                        <MenuItem onClick={() => setDisplayTaskType(taskTypes.closed)}>
                            <Chip
                                color="success"
                                size="lg"
                                variant="outlined"
                                sx={{ borderRadius: "5px" }}
                            >
                                {taskTypes.closed.name}
                            </Chip>
                        </MenuItem>
                        <MenuItem onClick={() => setDisplayTaskType(taskTypes.deleted)}>
                            <Chip
                                color="danger"
                                size="lg"
                                variant="outlined"
                                sx={{ borderRadius: "5px" }}
                            >
                                {taskTypes.deleted.name}
                            </Chip>
                        </MenuItem>
                    </Menu>
                </Dropdown>
            </Typography>

            <Box sx={{ width: "40%" }}>
                <Autocomplete
                    key={`ac-project-tags-${currentProject?.projectId}`}
                    aria-label="Search"
                    loading={loading}
                    open={openSearch}
                    options={teamTaskSearchOptions}
                    placeholder={"Search"}
                    size="sm"
                    startDecorator={<SearchRoundedIcon />}
                    sx={{ width: "100%" }}
                    variant="soft"
                    endDecorator={
                        loading ? (
                            <CircularProgress
                                size="sm"
                                sx={{
                                    bgcolor: "background.surface",
                                }}
                            />
                        ) : null
                    }
                    getOptionLabel={(option) => option.title}
                    groupBy={(option) => option.status.status || "N/A"}
                    isOptionEqualToValue={(option, value) => option.taskId === value.taskId}
                    renderOption={(props, option) => (
                        <AutocompleteOption
                            {...props}
                            key={`ac-taskhome-search-task-${option.taskId}`}
                        >
                            <ListItemContent
                                sx={{
                                    fontSize: "sm",
                                    overflow: "hidden",
                                    textOverflow: "ellipsis",
                                    whiteSpace: "nowrap",
                                    width: "100%",
                                }}
                            >
                                <Chip
                                    key={`ac-taskhome-search-task-id-chip-${option.taskId}`}
                                    color="neutral"
                                    size="sm"
                                    variant="outlined"
                                >
                                    ID:{option.taskId}
                                </Chip>
                                <Chip
                                    key={`ac-taskhome-search-task-chip-${option.taskId}`}
                                    size="sm"
                                    variant="soft"
                                    sx={{
                                        backgroundColor: alpha(
                                            option.status.color || "#0044c2",
                                            mode === "dark" ? 0.5 : 0.75
                                        ),
                                        color: option.status.textColor,
                                        fontWeight: "bold",
                                        borderRadius: "5px",
                                        m: "3px",
                                    }}
                                >
                                    {option.status.status}
                                </Chip>
                                {option.title}
                            </ListItemContent>
                        </AutocompleteOption>
                    )}
                    renderTags={(tags, getTagProps) =>
                        tags.map((item, index) => {
                            const { key, ...tagProps } = getTagProps({ index });
                            return (
                                <Chip
                                    key={`ac-taskhome-search-task-chip-${key}`}
                                    size="sm"
                                    variant="soft"
                                    sx={{
                                        backgroundColor: alpha(
                                            item.status.color || "#0044c2",
                                            mode === "dark" ? 0.5 : 0.75
                                        ),
                                        color: item.status.textColor,
                                        fontWeight: "bold",
                                        borderRadius: "5px",
                                    }}
                                >
                                    {item.status.status}
                                </Chip>
                            );
                        })
                    }
                    slotProps={{
                        listbox: {
                            sx: {
                                zIndex: 10020,
                            },
                        },
                    }}
                    onChange={(event, value) => onSearchChange(value)}
                    onClose={() => setOpenSearch(false)}
                    onOpen={() => {
                        setOpenSearch(true);
                    }}
                />
            </Box>

            <Box>
                <Tooltip title="Create New Task">
                    <IconButton
                        component="p"
                        size="sm"
                        variant="outlined"
                        sx={{
                            fontSize: "15px",
                            paddingRight: "10px",
                        }}
                        onClick={onCreateTask}
                    >
                        <AddIcon />
                        Task
                    </IconButton>
                </Tooltip>
                <Dropdown>
                    <Tooltip title="More Options" placement="left-start">
                        <MenuButton
                            slots={{ root: IconButton }}
                            slotProps={{
                                root: { color: "neutral" },
                            }}
                        >
                            <MoreVert />
                        </MenuButton>
                    </Tooltip>
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
                {(isTaskPreviewVisible === true || isCreatingTask === true) && (
                    <Tooltip title="Close">
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
