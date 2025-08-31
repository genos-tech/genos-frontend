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
} from "@mui/joy";
import { CssVarsProvider } from "@mui/joy/styles";
import AddIcon from "@mui/icons-material/Add";
import DeleteIcon from "@mui/icons-material/Delete";
import CancelIcon from "@mui/icons-material/Cancel";
import MoreVert from "@mui/icons-material/MoreVert";
import { PanelGroup, Panel, PanelResizeHandle } from "react-resizable-panels";
import SearchRoundedIcon from "@mui/icons-material/SearchRounded";

import { TaskSidebar } from "./components/TaskSidebar";
import { TaskDashboard } from "./components/dashboard//TaskDashboard";
import { TaskPreview } from "./components/contents/TaskPreview";
import { ProjectTaskTable } from "./components/table/TaskTable";
import { CreateTaskForm } from "./components/contents/CreateTaskForm";
import { loadSpecificTask } from "./services/loadSpecificTask";
import { loadTeamProjects } from "./services/loadTeamProjects";
import { loadTeamTaskList } from "./services/loadTaskSearchList";
import { ModalCreateTag } from "./components/modals/ModalCreateTag";
import { ModalCreateProject } from "./components/modals/ModalCreateProject";
import { ModalJoinProject } from "./components/modals/ModalJoinProject";
import { ModalDeleteProject } from "./components/modals/ModalDeleteProject";
import { ModalCreateTeam } from "../admin/components/modals/ModalCreateTeam";
import { popSpecificProjectTasks } from "../chat/services/popSpecificProjectTasks";
import { Sidebar } from "../../components/layout/sidebar";
import { UserProps } from "../../types/admin";
import { ChatProps } from "../../types/chat";
import {
    ProjectProps,
    TaskTableProps,
    TaskProps,
    TaskType,
    TaskTypesProps,
    SearchTeamTasksResponse,
} from "../../types/tasks";
import { useAuth } from "../../context/AuthContext";
import { updateTeamTasks } from "./services/updateTeamTasks";

const taskTypes: TaskTypesProps = {
    ongoing: { id: 1, statuses: ["Open", "WIP", "Pending"], name: "Ongoing" },
    closed: { id: 2, statuses: ["Closed"], name: "Closed" },
    deleted: { id: 3, statuses: ["Deleted"], name: "Deleted" },
};

type TaskHomeProps = {
    socket: Socket | null;
    myself: UserProps;
    setMyself: (me: UserProps) => void;
    setCurrentMainChat: (chat: ChatProps) => void;
    openingService: number;
    setOpeningService: (service: number) => void;
    isCommentUpdated: boolean;
    setIsCommentUpdated: (value: boolean) => void;
};
export const TaskHome = (props: TaskHomeProps) => {
    const {
        socket,
        myself,
        setMyself,
        setCurrentMainChat,
        openingService,
        setOpeningService,
        isCommentUpdated,
        setIsCommentUpdated,
    } = props;
    const { accessToken } = useAuth();
    const { mode } = useColorScheme();

    const [isTaskHomeVisible, setIsTaskHomeVisible] = useState(true);
    const [isDashboardVisible, setIsDashboardVisible] = useState(false);
    const [isTaskTableVisible, setTaskTableVisible] = useState(true);
    const [isTaskContentVisible, setIsTaskPreviewVisible] = useState(false);
    const [isCreatingTask, setIsCreatingTask] = useState({
        flag: false,
        parentTaskId: null,
        rootTaskId: null,
    });
    const [isNewTaskCreated, setIsNewTaskCreated] = useState(false);
    const [isTaskUpdated, setIsTaskUpdated] = useState(false);
    const [currentProject, setCurrentProject] = useState<ProjectProps | null>(null);
    const [filterBy, setFilterBy] = useState<number>(1); // 1: status, 2: tag
    const [selectedTagForFiltering, setSelectedTagForFiltering] = useState<string>();
    const [currentPreviewTaskId, setCurrentPreviewTaskId] = useState<number>(-1);
    const [currentPreviewTask, setCurrentPreviewTask] = useState<TaskProps>();
    const [ongoingTasks, setOnGoingTasks] = useState<TaskTableProps[]>([]);
    const [closedTasks, setClosedTasks] = useState<TaskTableProps[]>([]);
    const [deletedTasks, setDeletedTasks] = useState<TaskTableProps[]>([]);
    const [displayTaskType, setDisplayTaskType] = useState<TaskType>(taskTypes.ongoing);

    const [openCreateTeam, setOpenCreateTeam] = useState(false);
    const [openCreateProject, setOpenCreateProject] = useState(false);
    const [openJoinProject, setOpenJoinProject] = useState<{
        flag: boolean;
        projectId: number;
        projectName: string;
        systemUserId: string;
    }>({ flag: false, projectId: -1, projectName: "", systemUserId: "" });
    const [openDeleteProject, setOpenDeleteProject] = useState<{
        flag: boolean;
        projectId: number;
        projectName: string;
    }>({ flag: false, projectId: -1, projectName: "" });
    const [openCreateTag, setOpenCreateTag] = useState(false);
    const [isNewProjectCreated, setIsNewProjectCreated] = useState(false);
    const [isNewTagCreated, setIsNewTagCreated] = useState(false);

    // =======================================================================
    const [openSearch, setOpenSearch] = useState(false);
    const [teamTaskOptions, setTeamTaskOptions] = useState<SearchTeamTasksResponse[]>([]);
    const loading = openSearch && teamTaskOptions.length === 0;
    useEffect(() => {
        let active = true;

        if (!loading) {
            return undefined;
        }

        (async () => {
            const loadedTeamTasks: SearchTeamTasksResponse[] = await loadTeamTaskList(
                myself,
                -1,
                accessToken
            );

            if (active) {
                setTeamTaskOptions([...loadedTeamTasks]);
            }
        })();

        return () => {
            active = false;
        };
    }, [loading]);

    function onChangeHandler(value: any) {
        if (value !== null) {
            setOpenSearch(false);
            setCurrentPreviewTaskId(value.taskId);
            setIsTaskPreviewVisible(true);
        }
    }
    // =======================================================================

    const fetchProjectTasks = async (projectId: number) => {
        const BaseTasks: TaskTableProps[] = await popSpecificProjectTasks(
            projectId,
            taskTypes.ongoing.statuses
        );
        const ClosedTasks: TaskTableProps[] = await popSpecificProjectTasks(
            projectId,
            taskTypes.closed.statuses
        );
        const DeletedTasks: TaskTableProps[] = await popSpecificProjectTasks(
            projectId,
            taskTypes.deleted.statuses
        );
        setOnGoingTasks(BaseTasks);
        setClosedTasks(ClosedTasks);
        setDeletedTasks(DeletedTasks);
    };

    const loadProjects = async () => {
        // Load the latest project as initial process
        const loadedTeamProjects: ProjectProps[] = await loadTeamProjects(myself, accessToken);

        // Set the current project to one of the joining project.
        // TODO: should set "last-opened-project" using cache(localstorage)
        if (loadedTeamProjects.length > 0) {
            for (let i = 0; i < loadedTeamProjects.length; i++) {
                if (loadedTeamProjects[i].isJoined === true) {
                    setCurrentProject({
                        projectId: loadedTeamProjects[i].projectId,
                        projectName: loadedTeamProjects[i].projectName,
                        projectTags: loadedTeamProjects[i].projectTags,
                        systemUserId: loadedTeamProjects[i].systemUserId,
                    });
                    await updateTeamTasks(myself, accessToken);
                    await fetchProjectTasks(loadedTeamProjects[i].projectId);
                    break;
                }
            }
        } else {
            setCurrentProject(null);
        }
    };

    useEffect(() => {
        loadProjects();
    }, []);

    useEffect(() => {
        loadProjects();
    }, [myself, openCreateTeam, openCreateProject, isNewTaskCreated]);

    useEffect(() => {
        if (currentProject) {
            fetchProjectTasks(currentProject.projectId);
        }
    }, [currentProject, isTaskUpdated]);

    useEffect(() => {
        if (currentProject && currentPreviewTaskId !== -1) {
            (async () => {
                const loadedTask: TaskProps[] = await loadSpecificTask(
                    myself,
                    currentProject.projectId,
                    currentPreviewTaskId,
                    accessToken
                );

                // Avoid double update it
                if (isNewTagCreated === false) {
                    setCurrentPreviewTask(loadedTask[0]);
                }

                if (isNewTaskCreated) {
                    setIsTaskPreviewVisible(true);
                    setOnGoingTasks((prev) => [
                        ...prev,
                        {
                            id: String(loadedTask[0].id) || null,
                            title: loadedTask[0].title || "",
                            priority: loadedTask[0].priority.priority || null,
                            effortLevel: loadedTask[0].effortLevel.level || null,
                            createdDate: loadedTask[0].createdDate || null,
                            updatedAt: loadedTask[0].updatedAt || null,
                            dueDate: loadedTask[0].dueDate || null,
                            daysLeft: loadedTask[0].daysLeft || null,
                            status: loadedTask[0].status.status || null,
                            assigneeId: loadedTask[0].assignee.userId || null,
                            assigneeEmail: loadedTask[0].assignee.userEmail || null,
                            assigneeName: loadedTask[0].assignee.userName || null,
                            assigneeImgPath: loadedTask[0].assignee.avatarImgPath || null,
                            parentTaskId: String(loadedTask[0].parentTaskId) || null,
                            threadId: loadedTask[0].threadId || null,
                            tags: loadedTask[0].tags || [],
                            concatTags: loadedTask[0].concatTags || null,
                            teamId: myself.teamId || null,
                            projectId: loadedTask[0].project?.projectId || null,
                        },
                    ]);
                    setIsNewTaskCreated(false);
                }
            })();
        }
    }, [currentPreviewTaskId, isNewTaskCreated]);

    useEffect(() => {
        if (isTaskUpdated && currentPreviewTask) {
            setOnGoingTasks((prevTasks) =>
                prevTasks.map((task) =>
                    task.id === String(currentPreviewTask.id)
                        ? {
                              id: String(currentPreviewTask.id) || null,
                              title: currentPreviewTask.title || null,
                              priority: currentPreviewTask.priority.priority || null,
                              effortLevel: currentPreviewTask.effortLevel.level || null,
                              createdDate: currentPreviewTask.createdDate || null,
                              updatedAt: currentPreviewTask.updatedAt || null,
                              dueDate: currentPreviewTask.dueDate || null,
                              daysLeft: currentPreviewTask.daysLeft || null,
                              status: currentPreviewTask.status.status || null,
                              assigneeId: currentPreviewTask.assignee.userId || null,
                              assigneeEmail: currentPreviewTask.assignee.userEmail || null,
                              assigneeName: currentPreviewTask.assignee.userName || null,
                              assigneeImgPath: currentPreviewTask.assignee.avatarImgPath || null,
                              parentTaskId: String(currentPreviewTask.parentTaskId) || null,
                              threadId: currentPreviewTask.threadId || null,
                              tags: currentPreviewTask.tags || [],
                              concatTags: currentPreviewTask.concatTags || null,
                              teamId: myself.teamId || null,
                              projectId: currentPreviewTask.project?.projectId || null,
                          }
                        : task
                )
            );
            setIsTaskUpdated(false);
        }
    }, [isTaskUpdated, currentPreviewTask]);

    return (
        <CssVarsProvider disableTransitionOnChange>
            <CssBaseline />

            <Box sx={{ display: "flex", minHeight: "100dvh", width: "100vw" }}>
                <Sidebar
                    socket={socket}
                    myself={myself}
                    setMyself={setMyself}
                    openingService={openingService}
                    setCurrentMainChat={setCurrentMainChat}
                    setOpeningService={setOpeningService}
                />

                <PanelGroup autoSaveId="conditional" direction="horizontal">
                    {currentProject && (
                        <>
                            <Panel id={"1"} order={1} defaultSize={15} minSize={5} maxSize={30}>
                                <TaskSidebar
                                    myself={myself}
                                    setMyself={setMyself}
                                    setIsDashboardVisible={setIsDashboardVisible}
                                    setTaskTableVisible={setTaskTableVisible}
                                    setIsTaskPreviewVisible={setIsTaskPreviewVisible}
                                    currentProject={currentProject}
                                    setCurrentProject={setCurrentProject}
                                    currentPreviewTaskId={currentPreviewTaskId}
                                    setCurrentPreviewTaskId={setCurrentPreviewTaskId}
                                    setOpenCreateTeam={setOpenCreateTeam}
                                    setOpenCreateProject={setOpenCreateProject}
                                    setOpenJoinProject={setOpenJoinProject}
                                    setIsTaskHomeVisible={setIsTaskHomeVisible}
                                    setFilterBy={setFilterBy}
                                    setSelectedTagForFiltering={setSelectedTagForFiltering}
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

                            {/* left pane (task-home) */}
                            {isTaskHomeVisible === true && (
                                <Panel id={"2"} order={2} minSize={30} maxSize={100}>
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
                                                flexDirection: { xs: "column", sm: "row" },
                                                alignItems: { xs: "start", sm: "center" },
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
                                                    gap: "8px", // space between text and dropdown (optional)
                                                }}
                                            >
                                                {currentProject.projectName}
                                                <Dropdown>
                                                    <MenuButton
                                                        slots={{ root: IconButton }}
                                                        slotProps={{ root: { color: "neutral" } }}
                                                    >
                                                        <Chip
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
                                                                fontWeight: "bold",
                                                                borderRadius: "7px",
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
                                                                    borderRadius: "7px",
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
                                                                    borderRadius: "7px",
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
                                                                    borderRadius: "7px",
                                                                }}
                                                                size="lg"
                                                            >
                                                                {taskTypes.deleted.name}
                                                            </Chip>
                                                        </MenuItem>
                                                    </Menu>
                                                </Dropdown>
                                            </Typography>

                                            <Box sx={{ width: "50%" }}>
                                                <Autocomplete
                                                    key={`ac-project-tags-${currentPreviewTaskId}`}
                                                    sx={{ width: "100%" }}
                                                    placeholder={"Search"}
                                                    variant="soft"
                                                    open={openSearch}
                                                    onOpen={() => {
                                                        setOpenSearch(true);
                                                    }}
                                                    onClose={() => {
                                                        setOpenSearch(false);
                                                    }}
                                                    isOptionEqualToValue={(option, value) =>
                                                        option.taskId === value.taskId
                                                    }
                                                    getOptionLabel={(option) => option.title}
                                                    renderTags={(tags, getTagProps) =>
                                                        tags.map((item, index) => {
                                                            const { key, ...tagProps } =
                                                                getTagProps({ index }); // spread the 'key'
                                                            return (
                                                                <Chip
                                                                    key={`ac-taskhome-search-task-chip-${key}`}
                                                                    variant="soft"
                                                                    sx={{
                                                                        backgroundColor: alpha(
                                                                            item.status.color ||
                                                                                "#0044c2",
                                                                            mode === "dark"
                                                                                ? 0.5
                                                                                : 0.75
                                                                        ),
                                                                        color: item.status
                                                                            .textColor,
                                                                        fontWeight: "bold",
                                                                        borderRadius: "7px",
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
                                                                    textOverflow: "ellipsis",
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
                                                                        backgroundColor: alpha(
                                                                            option.status.color ||
                                                                                "#0044c2",
                                                                            mode === "dark"
                                                                                ? 0.5
                                                                                : 0.75
                                                                        ),
                                                                        color: option.status
                                                                            .textColor,
                                                                        fontWeight: "bold",
                                                                        borderRadius: "7px",
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
                                                    options={teamTaskOptions}
                                                    loading={loading}
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
                                                <IconButton
                                                    component="p"
                                                    variant="outlined"
                                                    size="sm"
                                                    sx={{
                                                        fontSize: "15px",
                                                        paddingRight: "10px",
                                                    }}
                                                    onClick={() => {
                                                        setIsCreatingTask({
                                                            flag: true,
                                                            parentTaskId: null,
                                                            rootTaskId: null,
                                                        });
                                                    }}
                                                >
                                                    <AddIcon />
                                                    Task
                                                </IconButton>
                                                {(isTaskContentVisible === true ||
                                                    isCreatingTask.flag === true) && (
                                                    <IconButton
                                                        size="sm"
                                                        variant="plain"
                                                        color="neutral"
                                                        onClick={() => {
                                                            setIsTaskHomeVisible(false);
                                                        }}
                                                    >
                                                        <CancelIcon />
                                                    </IconButton>
                                                )}
                                                <Dropdown>
                                                    <MenuButton
                                                        slots={{ root: IconButton }}
                                                        slotProps={{ root: { color: "neutral" } }}
                                                    >
                                                        <MoreVert />
                                                    </MenuButton>
                                                    <Menu size="sm">
                                                        <MenuItem
                                                            onClick={() => {
                                                                setOpenCreateProject(true);
                                                            }}
                                                        >
                                                            <AddIcon />
                                                            New Project
                                                        </MenuItem>
                                                        <MenuItem
                                                            onClick={() => {
                                                                setOpenCreateTag(true);
                                                            }}
                                                        >
                                                            <AddIcon />
                                                            New Tag
                                                        </MenuItem>
                                                        <MenuItem
                                                            onClick={() => {
                                                                setOpenDeleteProject({
                                                                    flag: true,
                                                                    projectId:
                                                                        currentProject.projectId,
                                                                    projectName:
                                                                        currentProject.projectName,
                                                                });
                                                            }}
                                                        >
                                                            <DeleteIcon />
                                                            Delete Project
                                                        </MenuItem>
                                                    </Menu>
                                                </Dropdown>
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
                                                    myself={myself}
                                                    currentProject={currentProject}
                                                    ongoingTasks={ongoingTasks}
                                                    closedTasks={closedTasks}
                                                    deletedTasks={deletedTasks}
                                                    setIsTaskPreviewVisible={
                                                        setIsTaskPreviewVisible
                                                    }
                                                    setCurrentPreviewTaskId={
                                                        setCurrentPreviewTaskId
                                                    }
                                                    displayTaskType={displayTaskType}
                                                    setFilterBy={setFilterBy}
                                                    filterBy={filterBy}
                                                    setSelectedTagForFiltering={
                                                        setSelectedTagForFiltering
                                                    }
                                                    selectedTagForFiltering={
                                                        selectedTagForFiltering
                                                    }
                                                />
                                            </>
                                        )}
                                    </Box>
                                </Panel>
                            )}

                            {isCreatingTask.flag && (
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
                                    <Panel id={"4"} order={4} minSize={30} maxSize={100}>
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
                                                socket={socket}
                                                myself={myself}
                                                currentMainChat={undefined}
                                                currentThreadChat={undefined}
                                                chatType={-1}
                                                setIsTaskPreviewVisible={setIsTaskPreviewVisible}
                                                setIsCreatingTask={setIsCreatingTask}
                                                setOpenCreateProject={setOpenCreateProject}
                                                setOpenCreateTag={setOpenCreateTag}
                                                currentProject={currentProject}
                                                setCurrentProject={setCurrentProject}
                                                setCurrentPreviewTaskId={setCurrentPreviewTaskId}
                                                isNewProjectCreated={isNewProjectCreated}
                                                isNewTagCreated={isNewTagCreated}
                                                setIsNewTaskCreated={setIsNewTaskCreated}
                                                setCurrentMainChat={setCurrentMainChat}
                                                setOpeningService={setOpeningService}
                                                parentTaskId={isCreatingTask.parentTaskId}
                                                rootTaskId={isCreatingTask.rootTaskId}
                                                setIsTaskHomeVisible={setIsTaskHomeVisible}
                                                isTaskContentVisible={isTaskContentVisible}
                                                isCreatingTask={isCreatingTask.flag}
                                            />
                                        </Box>
                                    </Panel>
                                </>
                            )}

                            {isTaskContentVisible && currentPreviewTask && (
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
                                            <TaskPreview
                                                socket={socket}
                                                myself={myself}
                                                setCurrentProject={setCurrentProject}
                                                currentPreviewTask={currentPreviewTask}
                                                setIsCreatingTask={setIsCreatingTask}
                                                setIsTaskPreviewVisible={setIsTaskPreviewVisible}
                                                setCurrentPreviewTask={setCurrentPreviewTask}
                                                setOpenCreateProject={setOpenCreateProject}
                                                setOpenCreateTag={setOpenCreateTag}
                                                isTaskUpdated={isTaskUpdated}
                                                setIsTaskUpdated={setIsTaskUpdated}
                                                setCurrentMainChat={setCurrentMainChat}
                                                setOpeningService={setOpeningService}
                                                currentPreviewTaskId={currentPreviewTaskId}
                                                setCurrentPreviewTaskId={setCurrentPreviewTaskId}
                                                isCommentUpdated={isCommentUpdated}
                                                setIsCommentUpdated={setIsCommentUpdated}
                                                setIsTaskHomeVisible={setIsTaskHomeVisible}
                                                isTaskContentVisible={isTaskContentVisible}
                                                isCreatingTask={isCreatingTask.flag}
                                            />
                                        </Box>
                                    </Panel>
                                </>
                            )}
                        </>
                    )}

                    {!currentProject && (
                        <>
                            <Panel id={"5"} order={5} minSize={5} maxSize={30}>
                                <TaskSidebar
                                    myself={myself}
                                    setMyself={setMyself}
                                    setIsDashboardVisible={setIsDashboardVisible}
                                    setTaskTableVisible={setTaskTableVisible}
                                    setIsTaskPreviewVisible={setIsTaskPreviewVisible}
                                    currentProject={currentProject}
                                    setCurrentProject={setCurrentProject}
                                    currentPreviewTaskId={currentPreviewTaskId}
                                    setCurrentPreviewTaskId={setCurrentPreviewTaskId}
                                    setOpenCreateTeam={setOpenCreateTeam}
                                    setOpenCreateProject={setOpenCreateProject}
                                    setOpenJoinProject={setOpenJoinProject}
                                    setIsTaskHomeVisible={setIsTaskHomeVisible}
                                    setFilterBy={setFilterBy}
                                    setSelectedTagForFiltering={setSelectedTagForFiltering}
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
                                            setOpenCreateProject(true);
                                        }}
                                    >
                                        <AddIcon />
                                        New Project
                                    </IconButton>
                                </Box>
                            </Panel>
                        </>
                    )}

                    {/* Modal for creating a new project */}
                    <ModalCreateTeam
                        myself={myself}
                        setMyself={setMyself}
                        openCreateTeam={openCreateTeam}
                        setOpenCreateTeam={setOpenCreateTeam}
                    />

                    {/* Modal for creating a new project */}
                    <ModalCreateProject
                        myself={myself}
                        openCreateProject={openCreateProject}
                        setOpenCreateProject={setOpenCreateProject}
                        setCurrentProject={setCurrentProject}
                        setIsNewProjectCreated={setIsNewProjectCreated}
                    />

                    {/* Modal for creating a new project */}
                    <ModalJoinProject
                        socket={socket}
                        myself={myself}
                        openJoinProject={openJoinProject}
                        setOpenJoinProject={setOpenJoinProject}
                    />

                    {/* Modal for deleting a project */}
                    <ModalDeleteProject
                        myself={myself}
                        openDeleteProject={openDeleteProject}
                        setOpenDeleteProject={setOpenDeleteProject}
                        setCurrentProject={setCurrentProject}
                    />

                    {/* Modal for creating a new tag */}
                    <ModalCreateTag
                        myself={myself}
                        currentProject={currentProject}
                        openCreateTag={openCreateTag}
                        setOpenCreateTag={setOpenCreateTag}
                        setIsNewTagCreated={setIsNewTagCreated}
                    />
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
