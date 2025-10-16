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
    CssBaseline,
    Dropdown,
    IconButton,
    ListItemContent,
    Menu,
    MenuButton,
    MenuItem,
    Tooltip,
    Typography,
} from "@mui/joy";
import { CssVarsProvider, useColorScheme } from "@mui/joy/styles";
import { alpha } from "@mui/system";
import { Panel, PanelGroup, PanelResizeHandle } from "react-resizable-panels";
import { Socket } from "socket.io-client";

import { CreateTaskForm } from "./components/contents/CreateTaskForm";
import { TaskPreview } from "./components/contents/TaskPreview";
import { TaskDashboard } from "./components/dashboard//TaskDashboard";
import { ModalCreateProject } from "./components/modals/ModalCreateProject";
import { ModalCreateTag } from "./components/modals/ModalCreateTag";
import { ModalDeleteProject } from "./components/modals/ModalDeleteProject";
import { ModalJoinProject } from "./components/modals/ModalJoinProject";
import { TaskSidebar } from "./components/sidebar/TaskSidebarMain";
import { ProjectTaskTable } from "./components/table/TaskTable";
import { loadTeamTaskList } from "./services/loadTaskSearchList";

import { ProjectAvatar } from "../../components/common/ProjectAvatar";
import { Sidebar } from "../../components/layout/sidebar";
import { useAuth } from "../../context/AuthContext";
import { ProjectManagementState } from "../../hooks/common/useProjectManagement";
import { TeamManagementState } from "../../hooks/common/useTeamManagement";
import { NoteManagementState } from "../../hooks/notes/useNoteManagement";
import { TaskManagementState } from "../../hooks/tasks/useTaskManagement";
import { UserProps } from "../../types/admin";
import { AllChatProps, ChatProps } from "../../types/chat";
import { SearchTeamTasksResponse, TaskType, TaskTypesProps } from "../../types/tasks";
import { TaskNoteMain } from "../notes/task-notes/components/TaskNoteMain";

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
    }>({
        flag: false,
        projectId: -1,
        projectName: "",
        isPrivate: true,
        systemUserId: "",
    });
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
                    myself={myself}
                    openingService={openingService}
                    setCurrentMainChat={setCurrentMainChat}
                    setCurrentTeam={TEM.setCurrentTeam}
                    setMyself={setMyself}
                    setOpeningService={setOpeningService}
                    socket={socket}
                    teamMemberProfiles={TEM.teamMemberProfiles}
                    unReadChatAndActivityCounts={unReadChatAndActivityCounts}
                    unReadInboxItemCount={unReadInboxItemCount}
                />

                <PanelGroup autoSaveId="conditional" direction="horizontal">
                    <>
                        <Panel defaultSize={10} id={"1"} maxSize={30} minSize={10} order={1}>
                            <TaskSidebar
                                myself={myself}
                                PM={PM}
                                setCurrentFilterName={setCurrentFilterName}
                                setFilterBy={setFilterBy}
                                setIsDashboardVisible={setIsDashboardVisible}
                                setIsTaskHomeVisible={setIsTaskHomeVisible}
                                setOpenJoinProject={setOpenJoinProject}
                                setSelectedTagForFiltering={setSelectedTagForFiltering}
                                setTaskTableVisible={setTaskTableVisible}
                                taskTableVisible={isTaskTableVisible}
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
                                            className="resize-handle"
                                            style={{
                                                width: "1px",
                                                backgroundColor:
                                                    mode === "dark" ? "grey" : "lightgrey",
                                                transition: "all 0.3s ease-in-out",
                                                cursor: "col-resize",
                                            }}
                                        />

                                        <Panel id={"2"} maxSize={80} minSize={30} order={2}>
                                            <Box
                                                className="MainContent"
                                                component="main"
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
                                                                        socket={socket}
                                                                        funcSetAllChats={
                                                                            funcSetAllChats
                                                                        }
                                                                        setCurrentMainChat={
                                                                            setCurrentMainChat
                                                                        }
                                                                        setOpeningService={
                                                                            setOpeningService
                                                                        }
                                                                        teamMemberProfiles={
                                                                            TEM.teamMemberProfiles
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
                                                        sx={{
                                                            display: "flex",
                                                            alignItems: "center", // vertical centering
                                                            justifyContent: "center", // horizontal centering
                                                        }}
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
                                                                    size="lg"
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
                                                                        color="primary"
                                                                        size="lg"
                                                                        variant="outlined"
                                                                        sx={{
                                                                            borderRadius: "5px",
                                                                        }}
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
                                                                        color="success"
                                                                        size="lg"
                                                                        variant="outlined"
                                                                        sx={{
                                                                            borderRadius: "5px",
                                                                        }}
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
                                                                        color="danger"
                                                                        size="lg"
                                                                        variant="outlined"
                                                                        sx={{
                                                                            borderRadius: "5px",
                                                                        }}
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
                                                                            bgcolor:
                                                                                "background.surface",
                                                                        }}
                                                                    />
                                                                ) : null
                                                            }
                                                            getOptionLabel={(option) =>
                                                                option.title
                                                            }
                                                            groupBy={(option) =>
                                                                option.status.status || "N/A"
                                                            }
                                                            isOptionEqualToValue={(
                                                                option,
                                                                value
                                                            ) => option.taskId === value.taskId}
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
                                                                        >
                                                                            {option.status.status}
                                                                        </Chip>
                                                                        {option.title}
                                                                    </ListItemContent>
                                                                </AutocompleteOption>
                                                            )}
                                                            renderTags={(tags, getTagProps) =>
                                                                tags.map((item, index) => {
                                                                    const { key, ...tagProps } =
                                                                        getTagProps({
                                                                            index,
                                                                        }); // spread the 'key'
                                                                    return (
                                                                        <Chip
                                                                            key={`ac-taskhome-search-task-chip-${key}`}
                                                                            size="sm"
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
                                                            onChange={(event, value) =>
                                                                onChangeHandler(value)
                                                            }
                                                            onClose={() => {
                                                                setOpenSearch(false);
                                                            }}
                                                            onOpen={() => {
                                                                setOpenSearch(true);
                                                                // Reset the team task search options to load them again
                                                                setTeamTaskOptions([]);
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
                                                                    sx={{
                                                                        color: "red",
                                                                        fontWeight: "bold",
                                                                    }}
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
                                                                    color="neutral"
                                                                    size="sm"
                                                                    variant="plain"
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
                                                            currentFilterName={currentFilterName}
                                                            currentProject={PM.currentProject}
                                                            displayTaskType={displayTaskType}
                                                            filterBy={filterBy}
                                                            myself={myself}
                                                            setFilterBy={setFilterBy}
                                                            setTeamMembers={TEM.setTeamMembers}
                                                            teamMembers={TEM.teamMembers}
                                                            TM={TM}
                                                            selectedTagForFiltering={
                                                                selectedTagForFiltering
                                                            }
                                                            setCurrentFilterName={
                                                                setCurrentFilterName
                                                            }
                                                            setSelectedTagForFiltering={
                                                                setSelectedTagForFiltering
                                                            }
                                                            teamMemberProfiles={
                                                                TEM.teamMemberProfiles
                                                            }
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
                                            className="resize-handle"
                                            style={{
                                                width: "1px",
                                                backgroundColor:
                                                    mode === "dark" ? "grey" : "lightgrey",
                                                transition: "all 0.3s ease-in-out",
                                                cursor: "col-resize",
                                            }}
                                        />

                                        {/* right pane */}
                                        <Panel id={"4"} maxSize={80} minSize={30} order={4}>
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
                                                    chatType={-1}
                                                    currentMainChat={undefined}
                                                    currentThreadChat={undefined}
                                                    moveToSpecificChat={moveToSpecificChat}
                                                    myself={myself}
                                                    openingService={openingService}
                                                    parentTaskId={TM.isCreatingTask.parentTaskId}
                                                    PM={PM}
                                                    rootTaskId={TM.isCreatingTask.rootTaskId}
                                                    setCurrentMainChat={setCurrentMainChat}
                                                    setIsTaskHomeVisible={setIsTaskHomeVisible}
                                                    setMyself={setMyself}
                                                    setOpeningService={setOpeningService}
                                                    setTeamMembers={TEM.setTeamMembers}
                                                    socket={socket}
                                                    teamMemberProfiles={TEM.teamMemberProfiles}
                                                    teamMembers={TEM.teamMembers}
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
                                            className="resize-handle"
                                            style={{
                                                width: "1px",
                                                backgroundColor:
                                                    mode === "dark" ? "grey" : "lightgrey",
                                                transition: "all 0.3s ease-in-out",
                                                cursor: "col-resize",
                                            }}
                                        />

                                        {/* right pane */}
                                        <Panel
                                            defaultSize={50}
                                            id={"3"}
                                            maxSize={80}
                                            minSize={30}
                                            order={3}
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
                                                    isTaskNoteVisible={NM.isTaskNoteVisible}
                                                    moveToSpecificChat={moveToSpecificChat}
                                                    myself={myself}
                                                    openingService={openingService}
                                                    setCurrentMainChat={setCurrentMainChat}
                                                    setCurrentProject={PM.setCurrentProject}
                                                    setCurrentTaskNote={NM.setCurrentTaskNote}
                                                    setIsTaskHomeVisible={setIsTaskHomeVisible}
                                                    setIsTaskNoteVisible={NM.setIsTaskNoteVisible}
                                                    setMyself={setMyself}
                                                    setOpenCreateProject={PM.setOpenCreateProject}
                                                    setOpeningService={setOpeningService}
                                                    setTeamMembers={TEM.setTeamMembers}
                                                    setTeamProjects={PM.setTeamProjects}
                                                    socket={socket}
                                                    taskNoteMeta={NM.taskNoteMeta}
                                                    teamMemberProfiles={TEM.teamMemberProfiles}
                                                    teamMembers={TEM.teamMembers}
                                                    teamProjects={PM.teamProjects}
                                                    TM={TM}
                                                    handleCreateNewTaskNote={
                                                        NM.handleCreateNewTaskNote
                                                    }
                                                />
                                            </Box>
                                        </Panel>
                                    </>
                                )}

                                {NM.isTaskNoteVisible && NM.currentTaskNoteChain && (
                                    <>
                                        <PanelResizeHandle
                                            className="resize-handle"
                                            style={{
                                                width: "1px",
                                                backgroundColor:
                                                    mode === "dark" ? "grey" : "lightgrey",
                                                transition: "all 0.3s ease-in-out",
                                                cursor: "col-resize",
                                            }}
                                        />

                                        <Panel
                                            defaultSize={50}
                                            id={"7"}
                                            maxSize={100}
                                            minSize={50}
                                            order={7}
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
                                                    allChats={allChats}
                                                    funcSetAllChats={funcSetAllChats}
                                                    isInTaskPage={true}
                                                    myself={myself}
                                                    NM={NM}
                                                    setCurrentChat={setCurrentMainChat}
                                                    setCurrentMainChat={setCurrentMainChat}
                                                    setIsTaskHomeVisible={setIsTaskHomeVisible}
                                                    setMyself={setMyself}
                                                    setOpeningService={setOpeningService}
                                                    socket={socket}
                                                    teamMemberProfiles={TEM.teamMemberProfiles}
                                                    teamMembers={TEM.teamMembers}
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
                                <Panel id={"5"} maxSize={30} minSize={5} order={5}>
                                    <TaskSidebar
                                        myself={myself}
                                        PM={PM}
                                        setCurrentFilterName={setCurrentFilterName}
                                        setFilterBy={setFilterBy}
                                        setIsDashboardVisible={setIsDashboardVisible}
                                        setIsTaskHomeVisible={setIsTaskHomeVisible}
                                        setOpenJoinProject={setOpenJoinProject}
                                        setSelectedTagForFiltering={setSelectedTagForFiltering}
                                        setTaskTableVisible={setTaskTableVisible}
                                        taskTableVisible={isTaskTableVisible}
                                        TM={TM}
                                    />
                                </Panel>

                                {/* Resizable Handle with MUI sx Styling */}
                                <PanelResizeHandle
                                    className="resize-handle"
                                    style={{
                                        width: "1px",
                                        backgroundColor: mode === "dark" ? "grey" : "lightgrey",
                                        transition: "all 0.3s ease-in-out",
                                        cursor: "col-resize",
                                    }}
                                />

                                <Panel id={"6"} maxSize={100} minSize={80} order={6}>
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
                                            color="neutral"
                                            component="button"
                                            variant="soft"
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
                        allChats={allChats}
                        loadProjectsAndTasks={PM.loadProjectsAndTasks}
                        myself={myself}
                        openJoinProject={openJoinProject}
                        setAllChats={setAllChats}
                        setCurrentProject={PM.setCurrentProject}
                        setOpenJoinProject={setOpenJoinProject}
                        socket={socket}
                    />

                    {/* Modal for deleting a project */}
                    <ModalDeleteProject
                        myself={myself}
                        openDeleteProject={openDeleteProject}
                        PM={PM}
                        setOpenDeleteProject={setOpenDeleteProject}
                    />

                    {/* Modal for creating a new tag */}
                    <ModalCreateTag currentProject={PM.currentProject} myself={myself} TM={TM} />
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
