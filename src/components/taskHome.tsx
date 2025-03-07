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

export default function TaskHome() {

    return (
        <CssVarsProvider disableTransitionOnChange>
            <CssBaseline />
            <Box sx={{ display: 'flex', minHeight: '100dvh' }}>
                <Sidebar />

                <PanelGroup direction="horizontal">

                    <Panel defaultSize={15} minSize={10} maxSize={30}>
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
                    <Panel defaultSize={50} minSize={30} maxSize={100}>
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
                                <ButtonGroup variant="outlined">
                                    {(['Overview', 'Task List', 'Gantt Chart'] as const).map((anchor) => (
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
                                    }}>
                                    <AddIcon />
                                    Task
                                </IconButton>
                            </Box>
                            <TaskTable />
                        </Box>
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

                    {/* right pane */}
                    <Panel defaultSize={50} minSize={30} maxSize={100}>
                        <Box
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
                                gap: 1,
                            }}
                        >
                            <TaskContent />
                        </Box>
                    </Panel>
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