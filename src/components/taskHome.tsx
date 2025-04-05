import { useState } from "react";
import { IconButton } from "@mui/joy";
import { CssVarsProvider } from '@mui/joy/styles';
import CssBaseline from '@mui/joy/CssBaseline';
import Box from '@mui/joy/Box';
import Button from '@mui/joy/Button';
import AddIcon from '@mui/icons-material/Add';
import Typography from '@mui/joy/Typography';
import ButtonGroup from '@mui/joy/ButtonGroup';
import { PanelGroup, Panel, PanelResizeHandle } from "react-resizable-panels";
import Sidebar from './utils/sidebar';
import TaskSidebar from './tasks/TaskSidebar';
import TaskContent from './tasks/TaskContent';
import TaskTable from './tasks/TaskTable';
import { UserProps, ProjectProps } from './../types';
import CreateTask from "../components/tasks/createTask";
import Autocomplete from '@mui/joy/Autocomplete';


interface User {
    id: string;
    name: string;
    email: string;
}


// SAMPLE DATA
const userOptions: User[] = [
    { id: '1', name: 'Alice', email: 'alice.wonder@example.com' },
    { id: '2', name: 'Bob', email: 'bob.builder@work.net' },
    { id: '3', name: 'Charlie', email: 'charlie.chaplin@mail.org' },
    { id: '4', name: 'Diana', email: 'diana.prince@themyscira.com' },
    { id: '5', name: 'Ethan', email: 'ethan.hunt@imf.org' },
];

const sampleCurrentProject: ProjectProps = {
    projectId: 1,
    projectName: "prj-origin-tech"
}

type TaskProps = {
    myself: UserProps;
    setMyself: (me: UserProps) => void;
    setOpeningService: (service: number) => void;
};

export default function TaskHome(props: TaskProps) {
    const { myself, setMyself, setOpeningService } = props
    const [isTaskContentVisible, setIsTaskContentVisible] = useState(true);
    const [isCreatingTask, setIsCreatingTask] = useState(false);
    const [currentProject, setCurrentProject] = useState<ProjectProps>(sampleCurrentProject);

    return (
        <CssVarsProvider disableTransitionOnChange>
            <CssBaseline />

            <Box sx={{ display: 'flex', minHeight: '100dvh', width: '100vw' }}>
                <Sidebar myself={myself} setMyself={setMyself} setOpeningService={setOpeningService} />

                <PanelGroup direction="horizontal">

                    <Panel id={'1'} order={1} minSize={5} maxSize={20}>
                        <TaskSidebar />
                    </Panel>

                    {/* Resizable Handle with MUI sx Styling */}
                    <PanelResizeHandle
                        style={{
                            width: "1px",
                            backgroundColor: "grey",
                            transition: "all 0.3s ease-in-out",
                            cursor: "col-resize",
                        }}
                        className="resize-handle"
                    />

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
                                    All/Project/Sub Tasks (TBD)
                                </Typography>
                                <Autocomplete
                                    placeholder="Search name or email..."
                                    isOptionEqualToValue={(option: User, value: User) => option.id === value.id}
                                    getOptionLabel={(option: User) => `${option.name} | ${option.email}`}
                                    options={userOptions}
                                    aria-label="Search"
                                />
                                <ButtonGroup variant="outlined">
                                    {(['List', 'Gannt'] as const).map((anchor) => (
                                        <Button component='p' key={anchor} onClick={() => { console.log("") }}>
                                            {anchor}
                                        </Button>
                                    ))}
                                </ButtonGroup>

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
                            </Box>
                            <TaskTable setIsTaskContentVisible={setIsTaskContentVisible} />
                        </Box>
                    </Panel>

                    {isCreatingTask && (
                        <>
                            {/* Resizable Handle with MUI sx Styling */}
                            <PanelResizeHandle
                                style={{
                                    width: "1px",
                                    backgroundColor: "grey",
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
                                        setIsTaskContentVisible={setIsTaskContentVisible}
                                    />
                                </Box>
                            </Panel>
                        </>
                    )}

                    {isTaskContentVisible && (
                        <>
                            {/* Resizable Handle with MUI sx Styling */}
                            <PanelResizeHandle
                                style={{
                                    width: "1px",
                                    backgroundColor: "grey",
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
                                    <TaskContent setIsTaskContentVisible={setIsTaskContentVisible} />
                                </Box>
                            </Panel>
                        </>
                    )}

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