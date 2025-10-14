import { alpha } from "@mui/system";
import { useEffect, useState } from "react";
import { Socket } from "socket.io-client";
import { useColorScheme } from "@mui/joy/styles";
import {
    IconButton,
    CssBaseline,
    Box,
    Typography,
    Dropdown,
    Menu,
    MenuButton,
    MenuItem,
    Autocomplete,
    AutocompleteOption,
    CircularProgress,
    ListItemContent,
    Chip,
    Tooltip,
} from "@mui/joy";
import { CssVarsProvider } from "@mui/joy/styles";
import AddIcon from "@mui/icons-material/Add";
import DeleteIcon from "@mui/icons-material/Delete";
import CancelIcon from "@mui/icons-material/Cancel";
import MoreVert from "@mui/icons-material/MoreVert";
import { PanelGroup, Panel, PanelResizeHandle } from "react-resizable-panels";
import SearchRoundedIcon from "@mui/icons-material/SearchRounded";
import LockOutlineIcon from "@mui/icons-material/LockOutline";

import { TaskSidebar } from "./components/sidebar/TaskSidebarMain";
import { TaskDashboard } from "./components/dashboard//TaskDashboard";
import { TaskPreview } from "./components/contents/TaskPreview";
import { ProjectTaskTable } from "./components/table/TaskTable";
import { CreateTaskForm } from "./components/contents/CreateTaskForm";
import { loadTeamTaskList } from "./services/loadTaskSearchList";
import { ModalCreateTag } from "./components/modals/ModalCreateTag";
import { ModalCreateProject } from "./components/modals/ModalCreateProject";
import { ModalJoinProject } from "./components/modals/ModalJoinProject";
import { ModalDeleteProject } from "./components/modals/ModalDeleteProject";
import { Sidebar } from "../../components/layout/sidebar";
import { UserProps } from "../../types/admin";
import { AllChatProps, ChatProps } from "../../types/chat";
import { TaskType, TaskTypesProps, SearchTeamTasksResponse } from "../../types/tasks";
import { useAuth } from "../../context/AuthContext";
import { TaskNoteMain } from "../notes/components/TaskNoteMain";
import { ProjectAvatar } from "../../components/common/ProjectAvatar";
import { NoteManagementState } from "../../hooks/notes/useNoteManagement";
import { ProjectManagementState } from "../../hooks/common/useProjectManagement";
import { TaskManagementState } from "../../hooks/tasks/useTaskManagement";
import { TeamManagementState } from "../../hooks/common/useTeamManagement";

const taskTypes: TaskTypesProps = {
    ongoing: { id: 1, statuses: ["Open", "WIP", "Pending"], name: "Ongoing" },
    closed: { id: 2, statuses: ["Closed"], name: "Closed" },
    deleted: { id: 3, statuses: ["Deleted"], name: "Deleted" },
};

type TaskHomeProps = {
    TEM: TeamManagementState;
    socket: Socket | null;
    myself: UserProps;
    setMyself: (me: UserProps) => void;
    setCurrentMainChat: (chat: ChatProps) => void;
    openingService: number;
    setOpeningService: (service: number) => void;
    unReadInboxItemCount: number;
    allChats: AllChatProps[];
    setAllChats: (value: AllChatProps[]) => void;
    funcSetAllChats: () => Promise<void>;
    moveToSpecificChat: (
        chatType: number,
        chatId: number,
        threadId: number,
        openTaskNoteInChat: boolean,
        openThreadTaskPreview: boolean,
        setOpeningService: (service: number) => void,
        setCurrentPreviewTaskId: (id: number) => void,
        setCurrentProject: (project: any) => void
    ) => void;
    unReadChatAndActivityCounts: number;
    NM: NoteManagementState;
    PM: ProjectManagementState;
    TM: TaskManagementState;
};
export const TaskHome = (props: TaskHomeProps) => {
    const {
        TEM,
        socket,
        myself,
        setMyself,
        setCurrentMainChat,
        openingService,
        setOpeningService,
        unReadInboxItemCount,
        unReadChatAndActivityCounts,
        allChats,
        setAllChats,
        funcSetAllChats,
        moveToSpecificChat,
        NM,
        PM,
        TM,
    } = props;

    // Common
    const { accessToken } = useAuth();
    const { mode } = useColorScheme();

    // Task Related
    const [isTaskHomeVisible, setIsTaskHomeVisible] = useState(true);
    const [isDashboardVisible, setIsDashboardVisible] = useState(false);
    const [isTaskTableVisible, setTaskTableVisible] = useState(true);

    const [currentFilterName, setCurrentFilterName] = useState<string>("");
    const [filterBy, setFilterBy] = useState<number>(1); // 1: status, 2: tag
    const [selectedTagForFiltering, setSelectedTagForFiltering] = useState<string>();
    const [displayTaskType, setDisplayTaskType] = useState<TaskType>(taskTypes.ongoing);
    const [openJoinProject, setOpenJoinProject] = useState<{
        flag: boolean;
        projectId: number;
        projectName: string;
        isPrivate: boolean;
        systemUserId: string;
    }>({ flag: false, projectId: -1, projectName: "", isPrivate: true, systemUserId: "" });
    const [openDeleteProject, setOpenDeleteProject] = useState<{
        flag: boolean;
        projectId: number;
        projectName: string;
    }>({ flag: false, projectId: -1, projectName: "" });

    // =======================================================================
    const [openSearch, setOpenSearch] = useState(false);
    const [teamTaskSearchOptions, setTeamTaskOptions] = useState<SearchTeamTasksResponse[]>([]);
    const loading = openSearch && teamTaskSearchOptions.length === 0;
    const updateTeamTaskSearchOptions = async (active: boolean) => {
        if (PM.currentProject && PM.currentProject.projectId) {
            const loadedTeamTasks: SearchTeamTasksResponse[] = await loadTeamTaskList(
                myself,
                PM.currentProject?.projectId || -1,
                displayTaskType.statuses.join(","),
                -1,
                accessToken
            );

            if (active) {
                setTeamTaskOptions([...loadedTeamTasks]);
            }
        }
    };
    useEffect(() => {
        let active = true;

        if (!loading) {
            return undefined;
        }

        updateTeamTaskSearchOptions(active);

        return () => {
            active = false;
        };
    }, [loading]);

    useEffect(() => {
        updateTeamTaskSearchOptions(true);
    }, [displayTaskType]);

    function onChangeHandler(value: any) {
        if (value !== null) {
            setOpenSearch(false);
            TM.setCurrentPreviewTaskId(value.taskId);
            TM.setIsTaskPreviewVisible(true);
        }
    }
    // =======================================================================

    const pmChat = allChats.find(
        (chat) =>
            chat.chatType === 3 && PM.currentProject && chat.chatId === PM.currentProject.projectId
    );

    return (
        <CssVarsProvider disableTransitionOnChange>
            <CssBaseline />

            <Box sx={{ display: "flex", minHeight: "100dvh", width: "100vw" }}>
                <Sidebar
                    currentTeam={TEM.currentTeam}
                    setCurrentTeam={TEM.setCurrentTeam}
                    teamMemberProfiles={TEM.teamMemberProfiles}
                    socket={socket}
                    myself={myself}
                    setMyself={setMyself}
                    openingService={openingService}
                    setCurrentMainChat={setCurrentMainChat}
                    setOpeningService={setOpeningService}
                    unReadInboxItemCount={unReadInboxItemCount}
                    unReadChatAndActivityCounts={unReadChatAndActivityCounts}
                />

                <PanelGroup autoSaveId="conditional" direction="horizontal">
                    <>
                        <Panel id={"1"} order={1} defaultSize={10} minSize={10} maxSize={30}>
                            <TaskSidebar
                                myself={myself}
                                setIsDashboardVisible={setIsDashboardVisible}
                                taskTableVisible={isTaskTableVisible}
                                setTaskTableVisible={setTaskTableVisible}
                                setOpenJoinProject={setOpenJoinProject}
                                setIsTaskHomeVisible={setIsTaskHomeVisible}
                                setFilterBy={setFilterBy}
                                setSelectedTagForFiltering={setSelectedTagForFiltering}
                                setCurrentFilterName={setCurrentFilterName}
                                PM={PM}
                                TM={TM}
                            />
                        </Panel>

                        {PM.currentProject && PM.currentProject.projectId && (
                            <>
                                {/* left pane (task-home) */}
                                {isTaskHomeVisible === true && (
                                    <>
                                        {/* Resizable Handle with MUI sx Styling */}
                                        <PanelResizeHandle
                                            style={{
                                                width: "1px",
                                                backgroundColor:
                                                    mode === "dark" ? "grey" : "lightgrey",
                                                transition: "all 0.3s ease-in-out",
                                                cursor: "col-resize",
                                            }}
                                            className="resize-handle"
                                        />

                                        <Panel id={"2"} order={2} minSize={30} maxSize={80}>
                                            <Box
                                                component="main"
                                                className="MainContent"
                                                sx={{
                                                    px: { xs: 1, md: 2 },
                                                    pt: {
                                                        xs: "calc(12px + var(--Header-height))",
                                                        sm: "calc(12px + var(--Header-height))",
                                                        md: 3,
                                                    },
                                                    pb: { xs: 2, sm: 2, md: 3 },
                                                    flex: 1,
                                                    display: "flex",
                                                    flexDirection: "column",
                                                    minWidth: 0,
                                                    height: "100dvh",
                                                    overflow: "hidden",
                                                    gap: 1,
                                                }}
                                            >
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
                                                        level="h2"
                                                        component="h1"
                                                        sx={{
                                                            display: "flex",
                                                            alignItems: "center", // vertical centering
                                                            justifyContent: "center", // horizontal centering
                                                        }}
                                                        startDecorator={
                                                            <>
                                                                {pmChat && (
                                                                    <ProjectAvatar
                                                                        avatarSize={40}
                                                                        teamMemberProfiles={
                                                                            TEM.teamMemberProfiles
                                                                        }
                                                                        myself={myself}
                                                                        setMyself={setMyself}
                                                                        socket={socket}
                                                                        pmChat={pmChat}
                                                                        setOpeningService={
                                                                            setOpeningService
                                                                        }
                                                                        setCurrentMainChat={
                                                                            setCurrentMainChat
                                                                        }
                                                                        funcSetAllChats={
                                                                            funcSetAllChats
                                                                        }
                                                                    />
                                                                )}
                                                                {PM.currentProject.isPrivate ===
                                                                true ? (
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
                                                    >
                                                        {PM.currentProject.projectName}
                                                        <Dropdown>
                                                            <MenuButton
                                                                slots={{ root: IconButton }}
                                                                slotProps={{
                                                                    root: { color: "neutral" },
                                                                }}
                                                            >
                                                                <Chip
                                                                    variant="outlined"
                                                                    color={
                                                                        displayTaskType.id === 1
                                                                            ? "primary"
                                                                            : displayTaskType.id ===
                                                                              2
                                                                            ? "success"
                                                                            : displayTaskType.id ===
                                                                              3
                                                                            ? "danger"
                                                                            : "neutral"
                                                                    }
                                                                    sx={{
                                                                        mx: "8px",
                                                                        fontWeight: "bold",
                                                                        borderRadius: "5px",
                                                                    }}
                                                                    size="lg"
                                                                >
                                                                    {displayTaskType.name}
                                                                </Chip>
                                                            </MenuButton>
                                                            <Menu size="sm">
                                                                <MenuItem
                                                                    onClick={() => {
                                                                        setDisplayTaskType(
                                                                            taskTypes.ongoing
                                                                        );
                                                                    }}
                                                                >
                                                                    <Chip
                                                                        variant="outlined"
                                                                        color="primary"
                                                                        sx={{
                                                                            borderRadius: "5px",
                                                                        }}
                                                                        size="lg"
                                                                    >
                                                                        {taskTypes.ongoing.name}
                                                                    </Chip>
                                                                </MenuItem>
                                                                <MenuItem
                                                                    onClick={() => {
                                                                        setDisplayTaskType(
                                                                            taskTypes.closed
                                                                        );
                                                                    }}
                                                                >
                                                                    <Chip
                                                                        variant="outlined"
                                                                        color="success"
                                                                        sx={{
                                                                            borderRadius: "5px",
                                                                        }}
                                                                        size="lg"
                                                                    >
                                                                        {taskTypes.closed.name}
                                                                    </Chip>
                                                                </MenuItem>
                                                                <MenuItem
                                                                    onClick={() => {
                                                                        setDisplayTaskType(
                                                                            taskTypes.deleted
                                                                        );
                                                                    }}
                                                                >
                                                                    <Chip
                                                                        variant="outlined"
                                                                        color="danger"
                                                                        sx={{
                                                                            borderRadius: "5px",
                                                                        }}
                                                                        size="lg"
                                                                    >
                                                                        {taskTypes.deleted.name}
                                                                    </Chip>
                                                                </MenuItem>
                                                            </Menu>
                                                        </Dropdown>
                                                    </Typography>

                                                    <Box sx={{ width: "40%" }}>
                                                        <Autocomplete
                                                            key={`ac-project-tags-${TM.currentPreviewTaskId}`}
                                                            sx={{ width: "100%" }}
                                                            placeholder={"Search"}
                                                            variant="soft"
                                                            open={openSearch}
                                                            onOpen={() => {
                                                                setOpenSearch(true);
                                                                // Reset the team task search options to load them again
                                                                setTeamTaskOptions([]);
                                                            }}
                                                            onClose={() => {
                                                                setOpenSearch(false);
                                                            }}
                                                            isOptionEqualToValue={(
                                                                option,
                                                                value
                                                            ) => option.taskId === value.taskId}
                                                            getOptionLabel={(option) =>
                                                                option.title
                                                            }
                                                            renderTags={(tags, getTagProps) =>
                                                                tags.map((item, index) => {
                                                                    const { key, ...tagProps } =
                                                                        getTagProps({ index }); // spread the 'key'
                                                                    return (
                                                                        <Chip
                                                                            key={`ac-taskhome-search-task-chip-${key}`}
                                                                            variant="soft"
                                                                            sx={{
                                                                                backgroundColor:
                                                                                    alpha(
                                                                                        item.status
                                                                                            .color ||
                                                                                            "#0044c2",
                                                                                        mode ===
                                                                                            "dark"
                                                                                            ? 0.5
                                                                                            : 0.75
                                                                                    ),
                                                                                color: item.status
                                                                                    .textColor,
                                                                                fontWeight: "bold",
                                                                                borderRadius:
                                                                                    "5px",
                                                                            }}
                                                                            size="sm"
                                                                        >
                                                                            {item.status.status}
                                                                        </Chip>
                                                                    );
                                                                })
                                                            }
                                                            renderOption={(props, option) => (
                                                                <AutocompleteOption
                                                                    {...props}
                                                                    key={`ac-taskhome-search-task-${option.taskId}`}
                                                                >
                                                                    <ListItemContent
                                                                        sx={{
                                                                            fontSize: "sm",
                                                                            overflow: "hidden",
                                                                            textOverflow:
                                                                                "ellipsis",
                                                                            whiteSpace: "nowrap",
                                                                            width: "100%", // take full width of button
                                                                        }}
                                                                    >
                                                                        <Chip
                                                                            key={`ac-taskhome-search-task-id-chip-${option.taskId}`}
                                                                            variant="outlined"
                                                                            color="neutral"
                                                                            size="sm"
                                                                        >
                                                                            ID:{option.taskId}
                                                                        </Chip>
                                                                        <Chip
                                                                            key={`ac-taskhome-search-task-chip-${option.taskId}`}
                                                                            variant="soft"
                                                                            sx={{
                                                                                backgroundColor:
                                                                                    alpha(
                                                                                        option
                                                                                            .status
                                                                                            .color ||
                                                                                            "#0044c2",
                                                                                        mode ===
                                                                                            "dark"
                                                                                            ? 0.5
                                                                                            : 0.75
                                                                                    ),
                                                                                color: option
                                                                                    .status
                                                                                    .textColor,
                                                                                fontWeight: "bold",
                                                                                borderRadius:
                                                                                    "5px",
                                                                                m: "3px",
                                                                            }}
                                                                            size="sm"
                                                                        >
                                                                            {option.status.status}
                                                                        </Chip>
                                                                        {option.title}
                                                                    </ListItemContent>
                                                                </AutocompleteOption>
                                                            )}
                                                            options={teamTaskSearchOptions}
                                                            loading={loading}
                                                            endDecorator={
                                                                loading ? (
                                                                    <CircularProgress
                                                                        size="sm"
                                                                        sx={{
                                                                            bgcolor:
                                                                                "background.surface",
                                                                        }}
                                                                    />
                                                                ) : null
                                                            }
                                                            slotProps={{
                                                                listbox: {
                                                                    sx: {
                                                                        zIndex: 10020,
                                                                    },
                                                                },
                                                            }}
                                                            onChange={(event, value) =>
                                                                onChangeHandler(value)
                                                            }
                                                            size="sm"
                                                            startDecorator={<SearchRoundedIcon />}
                                                            aria-label="Search"
                                                            groupBy={(option) =>
                                                                option.status.status || "N/A"
                                                            }
                                                        />
                                                    </Box>

                                                    <Box>
                                                        <Tooltip title="Create New Task">
                                                            <IconButton
                                                                component="p"
                                                                variant="outlined"
                                                                size="sm"
                                                                sx={{
                                                                    fontSize: "15px",
                                                                    paddingRight: "10px",
                                                                }}
                                                                onClick={() => {
                                                                    TM.setIsCreatingTask({
                                                                        flag: true,
                                                                        parentTaskId: null,
                                                                        rootTaskId: null,
                                                                    });
                                                                }}
                                                            >
                                                                <AddIcon />
                                                                Task
                                                            </IconButton>
                                                        </Tooltip>
                                                        <Dropdown>
                                                            <Tooltip title="More Options">
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
                                                                <MenuItem
                                                                    onClick={() => {
                                                                        PM.setOpenCreateProject(
                                                                            true
                                                                        );
                                                                    }}
                                                                >
                                                                    <AddIcon />
                                                                    New Project
                                                                </MenuItem>
                                                                <MenuItem
                                                                    onClick={() => {
                                                                        TM.setOpenCreateTag(true);
                                                                    }}
                                                                >
                                                                    <AddIcon />
                                                                    New Tag
                                                                </MenuItem>
                                                                <MenuItem
                                                                    onClick={() => {
                                                                        if (PM.currentProject) {
                                                                            setOpenDeleteProject({
                                                                                flag: true,
                                                                                projectId:
                                                                                    PM
                                                                                        .currentProject
                                                                                        .projectId,
                                                                                projectName:
                                                                                    PM
                                                                                        .currentProject
                                                                                        .projectName,
                                                                            });
                                                                        }
                                                                    }}
                                                                    sx={{
                                                                        color: "red",
                                                                        fontWeight: "bold",
                                                                    }}
                                                                >
                                                                    <DeleteIcon
                                                                        sx={{ color: "red" }}
                                                                    />
                                                                    Delete Project
                                                                </MenuItem>
                                                            </Menu>
                                                        </Dropdown>
                                                        {(TM.isTaskPreviewVisible === true ||
                                                            TM.isCreatingTask.flag === true) && (
                                                            <Tooltip title="Close">
                                                                <IconButton
                                                                    size="sm"
                                                                    variant="plain"
                                                                    color="neutral"
                                                                    onClick={() => {
                                                                        setIsTaskHomeVisible(
                                                                            false
                                                                        );
                                                                    }}
                                                                >
                                                                    <CancelIcon />
                                                                </IconButton>
                                                            </Tooltip>
                                                        )}
                                                    </Box>
                                                </Box>

                                                {isDashboardVisible === true && (
                                                    <>
                                                        <TaskDashboard />
                                                    </>
                                                )}
                                                {isTaskTableVisible === true && (
                                                    <>
                                                        <ProjectTaskTable
                                                            teamMembers={TEM.teamMembers}
                                                            setTeamMembers={TEM.setTeamMembers}
                                                            teamMemberProfiles={
                                                                TEM.teamMemberProfiles
                                                            }
                                                            myself={myself}
                                                            currentProject={PM.currentProject}
                                                            displayTaskType={displayTaskType}
                                                            setFilterBy={setFilterBy}
                                                            filterBy={filterBy}
                                                            setSelectedTagForFiltering={
                                                                setSelectedTagForFiltering
                                                            }
                                                            selectedTagForFiltering={
                                                                selectedTagForFiltering
                                                            }
                                                            currentFilterName={currentFilterName}
                                                            setCurrentFilterName={
                                                                setCurrentFilterName
                                                            }
                                                            TM={TM}
                                                        />
                                                    </>
                                                )}
                                            </Box>
                                        </Panel>
                                    </>
                                )}

                                {TM.isCreatingTask.flag === true && (
                                    <>
                                        {/* Resizable Handle with MUI sx Styling */}
                                        <PanelResizeHandle
                                            style={{
                                                width: "1px",
                                                backgroundColor:
                                                    mode === "dark" ? "grey" : "lightgrey",
                                                transition: "all 0.3s ease-in-out",
                                                cursor: "col-resize",
                                            }}
                                            className="resize-handle"
                                        />

                                        {/* right pane */}
                                        <Panel id={"4"} order={4} minSize={30} maxSize={80}>
                                            <Box
                                                sx={{
                                                    px: { xs: 1, md: 2 },
                                                    pt: {
                                                        xs: "calc(12px + var(--Header-height))",
                                                        sm: "calc(12px + var(--Header-height))",
                                                        md: 2,
                                                    },
                                                    pb: { xs: 2, sm: 2, md: 3 },
                                                    flex: 1,
                                                    display: "flex",
                                                    flexDirection: "column",
                                                    minWidth: 0,
                                                    height: "100dvh",
                                                    gap: 1,
                                                }}
                                            >
                                                <CreateTaskForm
                                                    teamMembers={TEM.teamMembers}
                                                    setTeamMembers={TEM.setTeamMembers}
                                                    teamMemberProfiles={TEM.teamMemberProfiles}
                                                    socket={socket}
                                                    myself={myself}
                                                    setMyself={setMyself}
                                                    currentMainChat={undefined}
                                                    currentThreadChat={undefined}
                                                    chatType={-1}
                                                    setCurrentMainChat={setCurrentMainChat}
                                                    setOpeningService={setOpeningService}
                                                    parentTaskId={TM.isCreatingTask.parentTaskId}
                                                    rootTaskId={TM.isCreatingTask.rootTaskId}
                                                    setIsTaskHomeVisible={setIsTaskHomeVisible}
                                                    moveToSpecificChat={moveToSpecificChat}
                                                    openingService={openingService}
                                                    PM={PM}
                                                    TM={TM}
                                                />
                                            </Box>
                                        </Panel>
                                    </>
                                )}

                                {TM.isTaskPreviewVisible && TM.currentPreviewTask && (
                                    <>
                                        {/* Resizable Handle with MUI sx Styling */}
                                        <PanelResizeHandle
                                            style={{
                                                width: "1px",
                                                backgroundColor:
                                                    mode === "dark" ? "grey" : "lightgrey",
                                                transition: "all 0.3s ease-in-out",
                                                cursor: "col-resize",
                                            }}
                                            className="resize-handle"
                                        />

                                        {/* right pane */}
                                        <Panel
                                            id={"3"}
                                            order={3}
                                            defaultSize={50}
                                            minSize={30}
                                            maxSize={80}
                                        >
                                            <Box
                                                sx={{
                                                    px: { xs: 1, md: 2 },
                                                    pt: {
                                                        xs: "calc(12px + var(--Header-height))",
                                                        sm: "calc(12px + var(--Header-height))",
                                                        md: 2,
                                                    },
                                                    pb: { xs: 2, sm: 2, md: 3 },
                                                    flex: 1,
                                                    display: "flex",
                                                    flexDirection: "column",
                                                    minWidth: 0,
                                                    height: "100dvh",
                                                    gap: 1,
                                                }}
                                            >
                                                <TaskPreview
                                                    teamMembers={TEM.teamMembers}
                                                    setTeamMembers={TEM.setTeamMembers}
                                                    teamMemberProfiles={TEM.teamMemberProfiles}
                                                    socket={socket}
                                                    myself={myself}
                                                    setMyself={setMyself}
                                                    setCurrentProject={PM.setCurrentProject}
                                                    setOpenCreateProject={PM.setOpenCreateProject}
                                                    setCurrentMainChat={setCurrentMainChat}
                                                    setOpeningService={setOpeningService}
                                                    setIsTaskHomeVisible={setIsTaskHomeVisible}
                                                    setIsTaskNoteVisible={NM.setIsTaskNoteVisible}
                                                    handleCreateNewTaskNote={
                                                        NM.handleCreateNewTaskNote
                                                    }
                                                    setCurrentTaskNote={NM.setCurrentTaskNote}
                                                    isTaskNoteVisible={NM.isTaskNoteVisible}
                                                    teamProjects={PM.teamProjects}
                                                    setTeamProjects={PM.setTeamProjects}
                                                    taskNoteMeta={NM.taskNoteMeta}
                                                    moveToSpecificChat={moveToSpecificChat}
                                                    openingService={openingService}
                                                    TM={TM}
                                                />
                                            </Box>
                                        </Panel>
                                    </>
                                )}

                                {NM.isTaskNoteVisible && NM.currentTaskNoteChain && (
                                    <>
                                        <PanelResizeHandle
                                            style={{
                                                width: "1px",
                                                backgroundColor:
                                                    mode === "dark" ? "grey" : "lightgrey",
                                                transition: "all 0.3s ease-in-out",
                                                cursor: "col-resize",
                                            }}
                                            className="resize-handle"
                                        />

                                        <Panel
                                            id={"7"}
                                            order={7}
                                            defaultSize={50}
                                            minSize={50}
                                            maxSize={100}
                                        >
                                            <Box
                                                sx={{
                                                    px: { xs: 1, md: 2 },
                                                    pt: {
                                                        xs: "calc(12px + var(--Header-height))",
                                                        sm: "calc(12px + var(--Header-height))",
                                                        md: 2,
                                                    },
                                                    pb: { xs: 2, sm: 2, md: 3 },
                                                    flex: 1,
                                                    display: "flex",
                                                    flexDirection: "column",
                                                    minWidth: 0,
                                                    height: "100dvh",
                                                    gap: 1,
                                                }}
                                            >
                                                <TaskNoteMain
                                                    teamMemberProfiles={TEM.teamMemberProfiles}
                                                    socket={socket}
                                                    teamMembers={TEM.teamMembers}
                                                    myself={myself}
                                                    setMyself={setMyself}
                                                    setOpeningService={setOpeningService}
                                                    setCurrentChat={setCurrentMainChat}
                                                    isInTaskPage={true}
                                                    setIsTaskHomeVisible={setIsTaskHomeVisible}
                                                    allChats={allChats}
                                                    setCurrentMainChat={setCurrentMainChat}
                                                    funcSetAllChats={funcSetAllChats}
                                                    NM={NM}
                                                    TM={TM}
                                                />
                                            </Box>
                                        </Panel>
                                    </>
                                )}
                            </>
                        )}
                    </>

                    {!PM.currentProject ||
                        PM.currentProject.projectId === null ||
                        (PM.currentProject.projectId === undefined && (
                            <>
                                <Panel id={"5"} order={5} minSize={5} maxSize={30}>
                                    <TaskSidebar
                                        myself={myself}
                                        setIsDashboardVisible={setIsDashboardVisible}
                                        taskTableVisible={isTaskTableVisible}
                                        setTaskTableVisible={setTaskTableVisible}
                                        setOpenJoinProject={setOpenJoinProject}
                                        setIsTaskHomeVisible={setIsTaskHomeVisible}
                                        setFilterBy={setFilterBy}
                                        setSelectedTagForFiltering={setSelectedTagForFiltering}
                                        setCurrentFilterName={setCurrentFilterName}
                                        PM={PM}
                                        TM={TM}
                                    />
                                </Panel>

                                {/* Resizable Handle with MUI sx Styling */}
                                <PanelResizeHandle
                                    style={{
                                        width: "1px",
                                        backgroundColor: mode === "dark" ? "grey" : "lightgrey",
                                        transition: "all 0.3s ease-in-out",
                                        cursor: "col-resize",
                                    }}
                                    className="resize-handle"
                                />

                                <Panel id={"6"} order={6} minSize={80} maxSize={100}>
                                    <Box
                                        sx={{
                                            height: "100%",
                                            display: "flex",
                                            justifyContent: "center",
                                            alignItems: "center",
                                            width: "100%",
                                        }}
                                    >
                                        <IconButton
                                            component="button"
                                            variant="soft"
                                            color="neutral"
                                            sx={{
                                                fontSize: "15px",
                                                paddingRight: "10px",
                                            }}
                                            onClick={() => {
                                                PM.setOpenCreateProject(true);
                                            }}
                                        >
                                            <AddIcon />
                                            New Project / Choose Project
                                        </IconButton>
                                    </Box>
                                </Panel>
                            </>
                        ))}

                    {/* Modal for creating a new project */}
                    <ModalCreateProject myself={myself} PM={PM} />

                    {/* Modal for creating a new project */}
                    <ModalJoinProject
                        socket={socket}
                        myself={myself}
                        openJoinProject={openJoinProject}
                        setOpenJoinProject={setOpenJoinProject}
                        setCurrentProject={PM.setCurrentProject}
                        loadProjectsAndTasks={PM.loadProjectsAndTasks}
                        allChats={allChats}
                        setAllChats={setAllChats}
                    />

                    {/* Modal for deleting a project */}
                    <ModalDeleteProject
                        myself={myself}
                        openDeleteProject={openDeleteProject}
                        setOpenDeleteProject={setOpenDeleteProject}
                        PM={PM}
                    />

                    {/* Modal for creating a new tag */}
                    <ModalCreateTag myself={myself} currentProject={PM.currentProject} TM={TM} />
                </PanelGroup>

                {/* Hover Animation with CSS */}
                <style>
                    {`
                .resize-handle {
                    transition: all 0.3s ease-in-out;
                }
                .resize-handle:hover {
                    background-color: lightgray !important;
                    width: 8px !important;
                }
                `}
                </style>
            </Box>
        </CssVarsProvider>
    );
};
