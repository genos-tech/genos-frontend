import * as React from "react";
import { useState, useEffect } from "react";
import {
    GlobalStyles,
    Box,
    Divider,
    List,
    ListItem,
    ListItemContent,
    Typography,
    Sheet,
    Autocomplete,
    CircularProgress,
    Chip,
} from "@mui/joy";
import ListItemButton, { listItemButtonClasses } from "@mui/joy/ListItemButton";
import SearchRoundedIcon from "@mui/icons-material/SearchRounded";
import AssignmentRoundedIcon from "@mui/icons-material/AssignmentRounded";
import FreeCancellationIcon from "@mui/icons-material/FreeCancellation";
import BusinessIcon from "@mui/icons-material/Business";
import WorkIcon from "@mui/icons-material/Work";
import AddIcon from "@mui/icons-material/Add";
import TableChartIcon from "@mui/icons-material/TableChart";
import DashboardIcon from "@mui/icons-material/Dashboard";
import KeyboardArrowDownIcon from "@mui/icons-material/KeyboardArrowDown";

import { loadTeamTaskList } from "../services/loadTaskSearchList";
import { loadTeamProjects } from "../services/loadTeamProjects";
import { useAuth } from "../../../context/AuthContext";
import { UserProps } from "../../../types/admin";
import { SearchTeamTasksResponse } from "../../../types/chat";
import { ProjectProps } from "../../../types/tasks";
import { loadAllTeams } from "../../admin/services/loadAllTeams";
import { Team } from "../../../types/admin";

function Toggler({
    defaultExpanded,
    renderToggle,
    children,
}: {
    defaultExpanded: boolean;
    children: React.ReactNode;
    renderToggle: (params: {
        open: boolean;
        setOpen: React.Dispatch<React.SetStateAction<boolean>>;
    }) => React.ReactNode;
}) {
    const [open, setOpen] = React.useState(defaultExpanded);
    return (
        <React.Fragment>
            {renderToggle({ open, setOpen })}
            <Box
                sx={[
                    {
                        display: "grid",
                        transition: "0.2s ease",
                        "& > *": {
                            overflow: "hidden",
                        },
                    },
                    open ? { gridTemplateRows: "1fr" } : { gridTemplateRows: "0fr" },
                ]}
            >
                {children}
            </Box>
        </React.Fragment>
    );
}

type TaskSidebarProps = {
    myself: UserProps;
    setMyself: (value: UserProps) => void;
    setIsDashboardVisible: (value: boolean) => void;
    setTaskTableVisible: (value: boolean) => void;
    currentProject: ProjectProps | null;
    setCurrentProject: (value: ProjectProps) => void;
    currentPreviewTaskId: number;
    setCurrentPreviewTaskId: (value: number) => void;
    setOpenCreateTeam: (value: boolean) => void;
    setOpenCreateProject: (value: boolean) => void;
    setOpenJoinProject: (value: {
        flag: boolean;
        projectId: number;
        projectName: string;
        systemUserId: string;
    }) => void;
    setIsTaskHomeVisible: (value: boolean) => void;
};

export const TaskSidebar = (props: TaskSidebarProps) => {
    const {
        myself,
        setMyself,
        setIsDashboardVisible,
        setTaskTableVisible,
        currentProject,
        setCurrentProject,
        currentPreviewTaskId,
        setCurrentPreviewTaskId,
        setOpenCreateTeam,
        setOpenCreateProject,
        setOpenJoinProject,
        setIsTaskHomeVisible,
    } = props;
    const { accessToken } = useAuth();

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
        }
    }
    // =======================================================================

    const [recentTasks, setRecentTasks] = useState<SearchTeamTasksResponse[]>([]);
    const updateRecentTasks = () => {
        (async () => {
            const loadedTeamTasks: SearchTeamTasksResponse[] = await loadTeamTaskList(
                myself,
                accessToken
            );
            setRecentTasks([...loadedTeamTasks.slice(0, 10)]);
        })();
    };

    useEffect(() => {
        updateRecentTasks();
    }, [currentPreviewTaskId]);

    const [teamProjects, setTeamProjects] = useState<ProjectProps[]>([]);
    const updateTeamProjects = () => {
        (async () => {
            const loadedTeamProjects: ProjectProps[] = await loadTeamProjects(myself, accessToken);
            setTeamProjects([...loadedTeamProjects]);
        })();
    };

    useEffect(() => {
        updateTeamProjects();
    }, [currentProject]);

    const [teams, setTeams] = useState<Team[]>([]);
    const loadTeams = () => {
        (async () => {
            const loadedTeams: Team[] = await loadAllTeams(accessToken);
            setTeams(loadedTeams);
        })();
    };

    useEffect(() => {
        loadTeams();
    }, [myself]);

    return (
        <Sheet
            className="TaskSidebar"
            sx={{
                position: { xs: "fixed", md: "sticky" },
                transform: {
                    xs: "translateX(calc(100% * (var(--SideNavigation-slideIn, 0) - 1)))",
                    md: "none",
                },
                transition: "transform 0.4s, width 0.4s",
                height: "100dvh",
                width: "100%",
                top: 0,
                p: 2,
                flexShrink: 0,
                display: "flex",
                flexDirection: "column",
                gap: 2,
                borderRight: "1px solid",
                borderColor: "divider",
            }}
        >
            <GlobalStyles
                styles={(theme) => ({
                    ":root": {
                        "--TaskSidebar-width": "220px",
                        [theme.breakpoints.up("lg")]: {
                            "--TaskSidebar-width": "240px",
                        },
                    },
                })}
            />

            {/* ============================================================================ */}

            <Box>
                <Autocomplete
                    placeholder={"Search"}
                    open={openSearch}
                    onOpen={() => {
                        setOpenSearch(true);
                    }}
                    onClose={() => {
                        setOpenSearch(false);
                    }}
                    isOptionEqualToValue={(option, value) => option.projectId === value.projectId}
                    getOptionLabel={(option) => `${option.taskId} | ${option.title}`}
                    options={teamTaskOptions}
                    loading={loading}
                    endDecorator={
                        loading ? (
                            <CircularProgress size="sm" sx={{ bgcolor: "background.surface" }} />
                        ) : null
                    }
                    slotProps={{
                        listbox: {
                            sx: {
                                zIndex: 10020,
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

            {/* ============================================================================ */}

            <Box
                sx={{
                    minHeight: 0,
                    overflow: "hidden auto",
                    flexGrow: 1,
                    display: "flex",
                    flexDirection: "column",
                    [`& .${listItemButtonClasses.root}`]: {
                        gap: 1.5,
                    },
                }}
            >
                <List
                    size="sm"
                    sx={{
                        gap: 1,
                        "--List-nestedInsetStart": "30px",
                        "--ListItem-radius": (theme) => theme.vars.radius.sm,
                    }}
                >
                    <ListItem>
                        <ListItemButton
                            onClick={() => {
                                setTaskTableVisible(false);
                                setIsDashboardVisible(true);
                            }}
                        >
                            <DashboardIcon />
                            <ListItemContent>
                                <Typography level="title-sm">Dashboard</Typography>
                            </ListItemContent>
                        </ListItemButton>
                    </ListItem>

                    <ListItem>
                        <ListItemButton
                            onClick={() => {
                                setTaskTableVisible(true);
                                setIsDashboardVisible(false);
                                setIsTaskHomeVisible(true);
                            }}
                        >
                            <TableChartIcon />
                            <ListItemContent>
                                <Typography level="title-sm">Task Table</Typography>
                            </ListItemContent>
                        </ListItemButton>
                    </ListItem>

                    <ListItem nested>
                        <Toggler
                            defaultExpanded={false}
                            renderToggle={({ open, setOpen }) => (
                                <ListItemButton
                                    onClick={() => {
                                        setOpen(!open);
                                        updateRecentTasks();
                                        setIsDashboardVisible(false);
                                    }}
                                >
                                    <AssignmentRoundedIcon />
                                    <ListItemContent>
                                        <Typography level="title-sm">Recents</Typography>
                                    </ListItemContent>
                                    <KeyboardArrowDownIcon
                                        sx={[
                                            open
                                                ? {
                                                      transform: "rotate(180deg)",
                                                  }
                                                : {
                                                      transform: "none",
                                                  },
                                        ]}
                                    />
                                </ListItemButton>
                            )}
                        >
                            <List sx={{ gap: 0.5 }}>
                                {recentTasks.map(
                                    (
                                        { projectId, projectName, systemUserId, taskId, title },
                                        index
                                    ) => {
                                        return (
                                            <ListItem key={taskId}>
                                                <ListItemButton
                                                    onClick={() => {
                                                        setCurrentProject({
                                                            projectId: projectId,
                                                            projectName: projectName,
                                                            systemUserId: systemUserId,
                                                        });
                                                        setCurrentPreviewTaskId(taskId);
                                                    }}
                                                    sx={{ overflow: "hidden" }} // ensure children don't overflow
                                                >
                                                    <Chip
                                                        key={taskId}
                                                        variant="soft"
                                                        color="neutral"
                                                        sx={{
                                                            borderRadius: "7px",
                                                            fontWeight: "bold",
                                                        }}
                                                        size="lg"
                                                    >
                                                        ID: {taskId || "N/A"}
                                                    </Chip>
                                                    <Typography
                                                        noWrap
                                                        sx={{
                                                            overflow: "hidden",
                                                            textOverflow: "ellipsis",
                                                            whiteSpace: "nowrap",
                                                            width: "100%", // take full width of button
                                                        }}
                                                    >
                                                        {title}
                                                    </Typography>
                                                </ListItemButton>
                                            </ListItem>
                                        );
                                    }
                                )}
                            </List>
                        </Toggler>
                    </ListItem>

                    <ListItem nested>
                        <Toggler
                            defaultExpanded={true}
                            renderToggle={({ open, setOpen }) => (
                                <ListItemButton
                                    onClick={() => {
                                        setOpen(!open);
                                        updateTeamProjects();
                                    }}
                                >
                                    <WorkIcon />
                                    <ListItemContent>
                                        <Typography level="title-sm">Projects</Typography>
                                    </ListItemContent>
                                    <KeyboardArrowDownIcon
                                        sx={[
                                            open
                                                ? {
                                                      transform: "rotate(180deg)",
                                                  }
                                                : {
                                                      transform: "none",
                                                  },
                                        ]}
                                    />
                                </ListItemButton>
                            )}
                        >
                            <List sx={{ gap: 0.5 }}>
                                <ListItem key={"createProject"}>
                                    <ListItemButton
                                        color="neutral"
                                        variant="soft"
                                        onClick={() => {
                                            setOpenCreateProject(true);
                                        }}
                                        sx={{ overflow: "hidden" }} // ensure children don't overflow
                                    >
                                        <AddIcon />
                                        <Typography
                                            noWrap
                                            sx={{
                                                fontSize: "15px",
                                                overflow: "hidden",
                                                textOverflow: "ellipsis",
                                                whiteSpace: "nowrap",
                                                width: "100%", // take full width of button
                                            }}
                                        >
                                            New Project
                                        </Typography>
                                    </ListItemButton>
                                </ListItem>
                                {teamProjects.map(
                                    ({ projectId, projectName, systemUserId, isJoined }) => {
                                        return (
                                            isJoined === true && (
                                                <ListItem key={projectId}>
                                                    <ListItemButton
                                                        color={"neutral"}
                                                        variant={
                                                            projectId === currentProject?.projectId
                                                                ? "solid"
                                                                : "plain"
                                                        }
                                                        onClick={() => {
                                                            setIsTaskHomeVisible(true);
                                                            setCurrentProject({
                                                                projectId: projectId,
                                                                projectName: projectName,
                                                                systemUserId: systemUserId,
                                                            });
                                                        }}
                                                        sx={{ overflow: "hidden" }} // ensure children don't overflow
                                                    >
                                                        <Typography
                                                            noWrap
                                                            sx={{
                                                                color:
                                                                    projectId ===
                                                                    currentProject?.projectId
                                                                        ? "white"
                                                                        : "neutral-500",
                                                                overflow: "hidden",
                                                                textOverflow: "ellipsis",
                                                                whiteSpace: "nowrap",
                                                                width: "100%", // take full width of button
                                                            }}
                                                        >
                                                            {projectName}
                                                        </Typography>
                                                    </ListItemButton>
                                                </ListItem>
                                            )
                                        );
                                    }
                                )}
                                <Toggler
                                    defaultExpanded={false}
                                    renderToggle={({ open, setOpen }) => (
                                        <ListItemButton
                                            onClick={() => {
                                                setOpen(!open);
                                                updateTeamProjects();
                                            }}
                                        >
                                            <ListItemContent>
                                                <Typography level="title-sm">
                                                    Other Projects
                                                </Typography>
                                            </ListItemContent>
                                            <KeyboardArrowDownIcon
                                                sx={[
                                                    open
                                                        ? {
                                                              transform: "rotate(180deg)",
                                                          }
                                                        : {
                                                              transform: "none",
                                                          },
                                                ]}
                                            />
                                        </ListItemButton>
                                    )}
                                >
                                    <List sx={{ gap: 0.5 }}>
                                        {teamProjects.map(
                                            ({
                                                projectId,
                                                projectName,
                                                systemUserId,
                                                isJoined,
                                            }) => {
                                                return (
                                                    isJoined === false && (
                                                        <ListItem key={projectId}>
                                                            <ListItemButton
                                                                color={"neutral"}
                                                                variant={
                                                                    projectId ===
                                                                    currentProject?.projectId
                                                                        ? "solid"
                                                                        : "plain"
                                                                }
                                                                onClick={() => {
                                                                    setOpenJoinProject({
                                                                        flag: true,
                                                                        projectId: projectId,
                                                                        projectName: projectName,
                                                                        systemUserId:
                                                                            systemUserId || "",
                                                                    });
                                                                }}
                                                                sx={{
                                                                    overflow: "hidden",
                                                                }} // ensure children don't overflow
                                                            >
                                                                <Typography
                                                                    noWrap
                                                                    sx={{
                                                                        color:
                                                                            projectId ===
                                                                            currentProject?.projectId
                                                                                ? "white"
                                                                                : "neutral-500",
                                                                        overflow: "hidden",
                                                                        textOverflow: "ellipsis",
                                                                        whiteSpace: "nowrap",
                                                                        width: "100%", // take full width of button
                                                                        ml: "20px",
                                                                    }}
                                                                >
                                                                    {projectName}
                                                                </Typography>
                                                            </ListItemButton>
                                                        </ListItem>
                                                    )
                                                );
                                            }
                                        )}
                                    </List>
                                </Toggler>
                            </List>
                        </Toggler>
                    </ListItem>

                    <ListItem nested>
                        <Toggler
                            defaultExpanded={false}
                            renderToggle={({ open, setOpen }) => (
                                <ListItemButton
                                    onClick={() => {
                                        setOpen(!open);
                                        loadTeams();
                                    }}
                                >
                                    <FreeCancellationIcon />
                                    <ListItemContent>
                                        <Typography level="title-sm">To-Do (TBD)</Typography>
                                    </ListItemContent>
                                    <KeyboardArrowDownIcon
                                        sx={[
                                            open
                                                ? {
                                                      transform: "rotate(180deg)",
                                                  }
                                                : {
                                                      transform: "none",
                                                  },
                                        ]}
                                    />
                                </ListItemButton>
                            )}
                        >
                            <List sx={{ gap: 0.5 }}>
                                <ListItem key={"createTeam"}>
                                    <ListItemButton
                                        color="neutral"
                                        variant="soft"
                                        onClick={() => {}}
                                        sx={{ overflow: "hidden" }} // ensure children don't overflow
                                    >
                                        <AddIcon />
                                        <Typography
                                            noWrap
                                            sx={{
                                                fontSize: "15px",
                                                overflow: "hidden",
                                                textOverflow: "ellipsis",
                                                whiteSpace: "nowrap",
                                                width: "100%", // take full width of button
                                            }}
                                        >
                                            New To-Do
                                        </Typography>
                                    </ListItemButton>
                                </ListItem>
                            </List>
                        </Toggler>
                    </ListItem>

                    <ListItem nested>
                        <Toggler
                            defaultExpanded={false}
                            renderToggle={({ open, setOpen }) => (
                                <ListItemButton
                                    onClick={() => {
                                        setOpen(!open);
                                        loadTeams();
                                    }}
                                >
                                    <BusinessIcon />
                                    <ListItemContent>
                                        <Typography level="title-sm">Teams</Typography>
                                    </ListItemContent>
                                    <KeyboardArrowDownIcon
                                        sx={[
                                            open
                                                ? {
                                                      transform: "rotate(180deg)",
                                                  }
                                                : {
                                                      transform: "none",
                                                  },
                                        ]}
                                    />
                                </ListItemButton>
                            )}
                        >
                            <List sx={{ gap: 0.5 }}>
                                <ListItem key={"createTeam"}>
                                    <ListItemButton
                                        color="neutral"
                                        variant="soft"
                                        onClick={() => {
                                            setOpenCreateTeam(true);
                                        }}
                                        sx={{ overflow: "hidden" }} // ensure children don't overflow
                                    >
                                        <AddIcon />
                                        <Typography
                                            noWrap
                                            sx={{
                                                fontSize: "15px",
                                                overflow: "hidden",
                                                textOverflow: "ellipsis",
                                                whiteSpace: "nowrap",
                                                width: "100%", // take full width of button
                                            }}
                                        >
                                            New Team
                                        </Typography>
                                    </ListItemButton>
                                </ListItem>
                                {teams.map(({ teamId, teamName }) => {
                                    return (
                                        <ListItem key={teamId}>
                                            <ListItemButton
                                                color={"neutral"}
                                                variant={
                                                    teamId === myself.teamId ? "solid" : "plain"
                                                }
                                                onClick={() =>
                                                    setMyself({
                                                        ...myself,
                                                        teamId: teamId,
                                                        teamName: teamName,
                                                    })
                                                }
                                                sx={{ overflow: "hidden" }} // ensure children don't overflow
                                            >
                                                <Typography
                                                    noWrap
                                                    sx={{
                                                        color:
                                                            teamId === myself.teamId
                                                                ? "white"
                                                                : "neutral-500",
                                                        borderRadius: 5,
                                                        overflow: "hidden",
                                                        textOverflow: "ellipsis",
                                                        whiteSpace: "nowrap",
                                                        width: "100%", // take full width of button
                                                    }}
                                                >
                                                    {teamName}
                                                </Typography>
                                            </ListItemButton>
                                        </ListItem>
                                    );
                                })}
                            </List>
                        </Toggler>
                    </ListItem>
                </List>
            </Box>
            <Divider />
        </Sheet>
    );
};
