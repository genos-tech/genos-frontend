import { useEffect, useState } from "react";
import {
    IconButton,
    Modal,
    ModalDialog,
    Alert,
    Stack,
    Button,
    Input,
} from "@mui/joy";
import { CssVarsProvider } from '@mui/joy/styles';
import CssBaseline from '@mui/joy/CssBaseline';
import Box from '@mui/joy/Box';
import AddIcon from '@mui/icons-material/Add';
import Typography from '@mui/joy/Typography';
import Dropdown from '@mui/joy/Dropdown';
import Menu from '@mui/joy/Menu';
import MenuButton from '@mui/joy/MenuButton';
import MenuItem from '@mui/joy/MenuItem';
import MoreVert from '@mui/icons-material/MoreVert';
import { PanelGroup, Panel, PanelResizeHandle } from "react-resizable-panels";
import Sidebar from './utils/sidebar';
import TaskSidebar from './tasks/TaskSidebar';
import TaskPreview from './tasks/previewTask';
import TaskTable from './tasks/TaskTable';
import { UserProps, ProjectProps, TaskTableProps, PreviewTaskProps, TeamProjectsResponse, SearchTeamTasksResponse } from './../types';
import CreateTask from "../components/tasks/createTask";
import FetchSpecificProjectTasksWorker from "../workers/fetchSpecificProjectTasksWorker.ts?worker";
import loadSpecificTask from './backendOperation/loadSpecificTask';
import { useAuth } from "../components/admin/AuthContext";
import loadTeamProjects from './backendOperation/loadTeamProjects';
import Autocomplete from '@mui/joy/Autocomplete';
import loadTaskSearchList from './backendOperation/loadTaskSearchList';
import CircularProgress from '@mui/joy/CircularProgress';
import SearchRoundedIcon from '@mui/icons-material/SearchRounded';

const base_url = import.meta.env.VITE_API_BASE_URL;

type TaskProps = {
    myself: UserProps;
    setMyself: (me: UserProps) => void;
    setOpeningService: (service: number) => void;
};

export default function TaskHome(props: TaskProps) {
    const { myself, setMyself, setOpeningService } = props
    const { accessToken } = useAuth();


    const [isTaskContentVisible, setIsTaskContentVisible] = useState(false);
    const [isCreatingTask, setIsCreatingTask] = useState(false);
    const [isNewTaskCreated, setIsNewTaskCreated] = useState(false);
    const [currentProject, setCurrentProject] = useState<ProjectProps | null>(null);
    const [projectTasks, setProjectTasks] = useState<TaskTableProps[]>([]);
    const [currentPreviewTaskId, setCurrentPreviewTaskId] = useState<number>(-1);
    const [currentPreviewTask, setCurrentPreviewTask] = useState<PreviewTaskProps>();

    // =======================================================================
    const [openSearch, setOpenSearch] = useState(false);
    const [teamTaskOptions, setOptions] = useState<SearchTeamTasksResponse[]>([]);
    const loading = openSearch && teamTaskOptions.length === 0;
    useEffect(() => {
        let active = true;

        if (!loading) {
            return undefined;
        }

        (async () => {
            const loadedTeamTasks: SearchTeamTasksResponse[] = await loadTaskSearchList({
                myself: myself, accessToken: accessToken || ""
            });

            if (active) {
                setOptions([...loadedTeamTasks]);
            }
        })();

        return () => {
            active = false;
        };
    }, [loading]);


    function onChangeHandler(value: any) {
        if (value !== null) {
            setOpenSearch(false);
            setCurrentPreviewTaskId(value.taskId)
        }
    }
    // =======================================================================

    useEffect(() => {
        // Load the latest project as initial process
        (async () => {
            const loadedTeamProjects: TeamProjectsResponse[] = await loadTeamProjects({
                myself: myself, accessToken: accessToken || ""
            });
            if (loadedTeamProjects.length > 0) {
                setCurrentProject({
                    projectId: loadedTeamProjects[0].projectId,
                    projectName: loadedTeamProjects[0].projectName,
                });
            }
        })();
    }, [])

    const fetchProjectTasks = async (projectId: number): Promise<string> => {
        return new Promise((resolve, reject) => {
            const fetchSpecificProjectTasksWorker = new FetchSpecificProjectTasksWorker();
            fetchSpecificProjectTasksWorker.postMessage({
                projectId: projectId,
            });
            fetchSpecificProjectTasksWorker.onmessage = (event) => {
                const fetchedTasks: TaskTableProps[] = event.data;
                if (fetchedTasks !== undefined) {
                    setProjectTasks(fetchedTasks)
                } else {
                    console.error("Failed to fetch project tasks:", fetchedTasks)
                }
                resolve(event.data);
                fetchSpecificProjectTasksWorker.terminate();
            };
            fetchSpecificProjectTasksWorker.onerror = (error) => {
                reject(error);
                fetchSpecificProjectTasksWorker.terminate();
            };
        });
    };

    useEffect(() => {
        if (currentProject) {
            fetchProjectTasks(currentProject.projectId);
        }
    }, [currentProject])

    useEffect(() => {
        if (currentProject && currentPreviewTaskId !== -1) {
            (async () => {
                const loadedTask: PreviewTaskProps[] = await loadSpecificTask({
                    myself: myself,
                    projectId: currentProject.projectId,
                    taskId: currentPreviewTaskId,
                    accessToken: accessToken || ""
                });
                setCurrentPreviewTask(loadedTask[0])
                setIsTaskContentVisible(true)

                if (isNewTaskCreated) {
                    setProjectTasks((prev) => [...prev, {
                        id: loadedTask[0].id,
                        title: loadedTask[0].title || "",
                        priority: loadedTask[0].priority.priority,
                        effortLevel: loadedTask[0].effortLevel.level,
                        createdDate: loadedTask[0].createdDate,
                        dueDate: loadedTask[0].dueDate,
                        daysLeft: loadedTask[0].daysLeft,
                        status: loadedTask[0].status.status,
                        assigneeId: loadedTask[0].assignee.userId,
                        assigneeEmail: loadedTask[0].assignee.userEmail,
                        assigneeName: loadedTask[0].assignee.userName,
                        parentTaskId: loadedTask[0].parentTaskId,
                        threadId: loadedTask[0].threadId,
                        tags: loadedTask[0].tags,
                        teamId: myself.teamId,
                        projectId: loadedTask[0].project.projectId
                    }])
                    setIsNewTaskCreated(false)
                }

            })();
        }
    }, [currentPreviewTaskId, isNewTaskCreated])


    // Modal configs
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const [openCreateProject, setOpenCreateProject] = useState(false);
    const [projectName, setProjectName] = useState("");

    const handleCreateProject = () => {
        if (projectName.trim()) { createProject() }
    };

    async function createProject(): Promise<void> {
        try {
            const createProjectResponse = await fetch(`${base_url}/project/create/`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    "Authorization": `Bearer ${accessToken}`
                },
                body: JSON.stringify({
                    team: myself.teamId,
                    project_name: projectName,
                    owner: myself.userId
                }),
            });

            const createProjectData = await createProjectResponse.json();

            if (!createProjectResponse.ok) {
                console.error(createProjectData)
                throw new Error(createProjectData.hint || 'Project Creation Failed');
            } else {
                console.log("Task created:", createProjectData)
                setCurrentProject(
                    {
                        projectId: createProjectData.project_id,
                        projectName: createProjectData.project_name
                    }
                )
                setOpenCreateProject(false);
            }
        } catch (error) {
            const err_msg = `${error}`
            console.error(err_msg);
            setErrorMessage(err_msg);
        }
    }

    return (
        <CssVarsProvider disableTransitionOnChange>
            <CssBaseline />

            <Box sx={{ display: 'flex', minHeight: '100dvh', width: '100vw' }}>
                <Sidebar myself={myself} setMyself={setMyself} setOpeningService={setOpeningService} />

                <PanelGroup direction="horizontal">

                    <Panel id={'1'} order={1} minSize={5} maxSize={20}>
                        <TaskSidebar
                            myself={myself}
                            setCurrentProject={setCurrentProject}
                            setCurrentPreviewTaskId={setCurrentPreviewTaskId} />
                    </Panel>

                    {/* Resizable Handle with MUI sx Styling */}
                    <PanelResizeHandle
                        style={{
                            width: "1px",
                            backgroundColor: "#f0f0f0",
                            transition: "all 0.3s ease-in-out",
                            cursor: "col-resize",
                        }}
                        className="resize-handle"
                    />

                    {currentProject && (
                        <>
                            {/* left pane */}
                            <Panel id={'2'} order={2} minSize={30} maxSize={100}>
                                <Box
                                    component="main"
                                    className="MainContent"
                                    sx={{
                                        px: { xs: 1, md: 2 },
                                        pt: {
                                            xs: 'calc(12px + var(--Header-height))',
                                            sm: 'calc(12px + var(--Header-height))',
                                            md: 3,
                                        },
                                        pb: { xs: 2, sm: 2, md: 3 },
                                        flex: 1,
                                        display: 'flex',
                                        flexDirection: 'column',
                                        minWidth: 0,
                                        height: '100dvh',
                                        overflow: 'hidden',
                                        gap: 1,
                                    }}
                                >
                                    <Box
                                        sx={{
                                            display: 'flex',
                                            mb: 1,
                                            gap: 1,
                                            flexDirection: { xs: 'column', sm: 'row' },
                                            alignItems: { xs: 'start', sm: 'center' },
                                            flexWrap: 'wrap',
                                            justifyContent: 'space-between',
                                        }}
                                    >
                                        <Typography level="h2" component="h1">
                                            {currentProject.projectName}
                                        </Typography>

                                        <Box sx={{ width: '50%' }}>
                                            <Autocomplete
                                                sx={{ width: '100%' }}
                                                placeholder={"Search"}
                                                variant="soft"
                                                open={openSearch}
                                                onOpen={() => {
                                                    setOpenSearch(true);
                                                }}
                                                onClose={() => {
                                                    setOpenSearch(false);
                                                }}
                                                isOptionEqualToValue={(option, value) => option.projectId === value.projectId}
                                                getOptionLabel={(option) => `[${option.taskId}] ${option.title}`}
                                                options={teamTaskOptions}
                                                loading={loading}
                                                endDecorator={
                                                    loading ? (
                                                        <CircularProgress size="sm" sx={{ bgcolor: 'background.surface' }} />
                                                    ) : null
                                                }
                                                slotProps={{
                                                    listbox: {
                                                        sx: {
                                                            zIndex: 10020
                                                        },
                                                    },
                                                }}
                                                onChange={(event, value) => onChangeHandler(value)}
                                                size="sm"
                                                startDecorator={<SearchRoundedIcon />}
                                                aria-label="Search"
                                                groupBy={(option) => option.projectName}
                                            />
                                        </Box>

                                        <Box>
                                            <IconButton
                                                component='p'
                                                variant="outlined"
                                                sx={{
                                                    fontSize: '15px',
                                                    paddingRight: '10px'
                                                }}
                                                onClick={() => {
                                                    setIsTaskContentVisible(false);
                                                    setIsCreatingTask(true);
                                                }}
                                            >
                                                <AddIcon />
                                                Task
                                            </IconButton>
                                            <Dropdown>
                                                <MenuButton
                                                    slots={{ root: IconButton }}
                                                    slotProps={{ root: { variant: 'outlined', color: 'neutral' } }}
                                                    sx={{ ml: '5px' }}
                                                >
                                                    <MoreVert />
                                                </MenuButton>
                                                <Menu>
                                                    <MenuItem onClick={() => { setOpenCreateProject(true) }}>Create Project</MenuItem>
                                                </Menu>
                                            </Dropdown>
                                        </Box>
                                    </Box>
                                    <TaskTable
                                        projectTasks={projectTasks}
                                        setProjectTasks={setProjectTasks}
                                        setIsTaskContentVisible={setIsTaskContentVisible}
                                        setCurrentPreviewTaskId={setCurrentPreviewTaskId}
                                    />
                                </Box>
                            </Panel>

                            {isCreatingTask && (
                                <>
                                    {/* Resizable Handle with MUI sx Styling */}
                                    <PanelResizeHandle
                                        style={{
                                            width: "1px",
                                            backgroundColor: "#f0f0f0",
                                            transition: "all 0.3s ease-in-out",
                                            cursor: "col-resize",
                                        }}
                                        className="resize-handle"
                                    />

                                    {/* right pane */}
                                    <Panel id={'4'} order={4} minSize={40} maxSize={100}>
                                        <Box
                                            sx={{
                                                px: { xs: 1, md: 2 },
                                                pt: {
                                                    xs: 'calc(12px + var(--Header-height))',
                                                    sm: 'calc(12px + var(--Header-height))',
                                                    md: 2,
                                                },
                                                pb: { xs: 2, sm: 2, md: 3 },
                                                flex: 1,
                                                display: 'flex',
                                                flexDirection: 'column',
                                                minWidth: 0,
                                                height: '100dvh',
                                                gap: 1,
                                            }}
                                        >
                                            <CreateTask
                                                myself={myself}
                                                currentProject={currentProject}
                                                setIsCreatingTask={setIsCreatingTask}
                                                setIsNewTaskCreated={setIsNewTaskCreated}
                                                setIsTaskContentVisible={setIsTaskContentVisible}
                                                setCurrentPreviewTaskId={setCurrentPreviewTaskId}
                                            />
                                        </Box>
                                    </Panel>
                                </>
                            )}

                            {(isTaskContentVisible && currentPreviewTask) && (
                                <>
                                    {/* Resizable Handle with MUI sx Styling */}
                                    <PanelResizeHandle
                                        style={{
                                            width: "1px",
                                            backgroundColor: "#f0f0f0",
                                            transition: "all 0.3s ease-in-out",
                                            cursor: "col-resize",
                                        }}
                                        className="resize-handle"
                                    />

                                    {/* right pane */}
                                    <Panel id={'3'} order={3} minSize={30} maxSize={100}>
                                        <Box
                                            sx={{
                                                px: { xs: 1, md: 2 },
                                                pt: {
                                                    xs: 'calc(12px + var(--Header-height))',
                                                    sm: 'calc(12px + var(--Header-height))',
                                                    md: 2,
                                                },
                                                pb: { xs: 2, sm: 2, md: 3 },
                                                flex: 1,
                                                display: 'flex',
                                                flexDirection: 'column',
                                                minWidth: 0,
                                                height: '100dvh',
                                                gap: 1,
                                            }}
                                        >
                                            <TaskPreview
                                                myself={myself}
                                                currentProject={currentProject}
                                                currentPreviewTask={currentPreviewTask}
                                                setCurrentPreviewTask={setCurrentPreviewTask}
                                                setIsCreatingTask={setIsCreatingTask}
                                                setIsTaskContentVisible={setIsTaskContentVisible}
                                            />
                                        </Box>
                                    </Panel>
                                </>
                            )}
                        </>
                    )}

                    {!currentProject && (
                        <>
                            <Panel id={'5'} order={5} minSize={30} maxSize={100}>
                                <Box
                                    sx={{
                                        height: '100%',
                                        display: 'flex',
                                        justifyContent: 'center',
                                        alignItems: 'center',
                                    }}
                                >
                                    <IconButton
                                        component="button"
                                        variant="soft"
                                        color="primary"
                                        sx={{
                                            fontSize: '15px',
                                            paddingRight: '10px',
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


                    {/* Modal for creating a new chat group */}
                    <Modal sx={{ zIndex: 10010 }} open={openCreateProject} onClose={() => setOpenCreateProject(false)}>
                        <ModalDialog>
                            <Typography level="h4">Create New Project</Typography>
                            <Input
                                placeholder="Enter an unique project name"
                                value={projectName}
                                onChange={(e) => setProjectName(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === "Enter" && projectName.trim()) {
                                        handleCreateProject();
                                    }
                                }}
                                sx={{ mt: 1 }}
                            />
                            {errorMessage && errorMessage !== "" && (
                                <Alert color="danger">{errorMessage}</Alert>
                            )}
                            <Stack direction="row" spacing={1} sx={{ mt: 2, justifyContent: "flex-end" }}>
                                <Button component='a' variant="outlined" onClick={() => setOpenCreateProject(false)}>
                                    Cancel
                                </Button>
                                <Button component='a' onClick={handleCreateProject} disabled={!projectName.trim()}>
                                    Create
                                </Button>
                            </Stack>
                        </ModalDialog>
                    </Modal>

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
}