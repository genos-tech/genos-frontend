import { alpha } from "@mui/system";
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
    AutocompleteOption,
    CircularProgress,
    Chip,
} from "@mui/joy";
import ListItemButton, { listItemButtonClasses } from "@mui/joy/ListItemButton";
import SearchRoundedIcon from "@mui/icons-material/SearchRounded";
import AssignmentRoundedIcon from "@mui/icons-material/AssignmentRounded";
import FreeCancellationIcon from "@mui/icons-material/FreeCancellation";
import WorkIcon from "@mui/icons-material/Work";
import AddIcon from "@mui/icons-material/Add";
import TableChartIcon from "@mui/icons-material/TableChart";
import DashboardIcon from "@mui/icons-material/Dashboard";
import KeyboardArrowDownIcon from "@mui/icons-material/KeyboardArrowDown";
import { useColorScheme } from "@mui/joy/styles";

import { loadTeamTaskList } from "../services/loadTaskSearchList";
import { loadTeamProjects } from "../services/loadTeamProjects";
import { loadProjectTags } from "../services/loadProjectTags";
import { useAuth } from "../../../context/AuthContext";
import { UserProps } from "../../../types/admin";
import { ProjectProps, TagListProps, SearchTeamTasksResponse } from "../../../types/tasks";

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
    setIsTaskPreviewVisible: (value: boolean) => void;
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
    setFilterBy: (value: number) => void;
    setSelectedTagForFiltering: (value: string) => void;
};

export const TaskSidebar = (props: TaskSidebarProps) => {
    const {
        myself,
        setMyself,
        setIsDashboardVisible,
        setTaskTableVisible,
        setIsTaskPreviewVisible,
        currentProject,
        setCurrentProject,
        currentPreviewTaskId,
        setCurrentPreviewTaskId,
        setOpenCreateTeam,
        setOpenCreateProject,
        setOpenJoinProject,
        setIsTaskHomeVisible,
        setFilterBy,
        setSelectedTagForFiltering,
    } = props;
    const { accessToken } = useAuth();
    const { mode } = useColorScheme();

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
                "open,wip,pending",
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

    const updateProjectTags = async () => {
        if (currentProject) {
            const loadedProjectTags: TagListProps[] = await loadProjectTags(
                myself,
                currentProject.projectId,
                accessToken
            );
            setCurrentProject({ ...currentProject, projectTags: loadedProjectTags });
        }
    };

    const [recentTasks, setRecentTasks] = useState<SearchTeamTasksResponse[]>([]);
    const updateRecentTasks = () => {
        (async () => {
            const loadedTeamTasks: SearchTeamTasksResponse[] = await loadTeamTaskList(
                myself,
                -1,
                "open,wip,pending",
                100,
                accessToken
            );
            setRecentTasks([...loadedTeamTasks.slice(0, 20)]);
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

    useEffect(() => {
        updateProjectTags();
    }, [myself]);

    useEffect(() => {
        updateProjectTags();
    }, []);

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
                    isOptionEqualToValue={(option, value) => option.taskId === value.taskId}
                    getOptionLabel={(option) => option.title}
                    renderTags={(tags, getTagProps) =>
                        tags.map((item, index) => {
                            const { key, ...tagProps } = getTagProps({ index }); // spread the 'key'
                            return (
                                <Chip
                                    key={`ac-taskhome-search-task-chip-${key}`}
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
                                            option.status.color || "#0044c2",
                                            mode === "dark" ? 0.5 : 0.75
                                        ),
                                        color: option.status.textColor,
                                        fontWeight: "bold",
                                        borderRadius: "5px",
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
                    onChange={(event, value) => onChangeHandler(value)}
                    size="sm"
                    startDecorator={<SearchRoundedIcon />}
                    aria-label="Search"
                    groupBy={(option) => option.projectName}
                />
            </Box>

            {/* ============================================================================ */}

            <Box
                className="custom-scrollbar"
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
                            <List>
                                {recentTasks.map(
                                    (
                                        {
                                            projectId,
                                            projectName,
                                            systemUserId,
                                            taskId,
                                            title,
                                            status,
                                        },
                                        index
                                    ) => {
                                        return (
                                            <ListItem key={`recent-task-${taskId}`}>
                                                <ListItemButton
                                                    onClick={() => {
                                                        setCurrentProject({
                                                            projectId: projectId,
                                                            projectName: projectName,
                                                            projectTags: [],
                                                            systemUserId: systemUserId,
                                                        });
                                                        setCurrentPreviewTaskId(taskId);
                                                    }}
                                                    sx={{ overflow: "hidden" }} // ensure children don't overflow
                                                >
                                                    <Chip
                                                        key={`recent-task-project-chip-${taskId}`}
                                                        variant="outlined"
                                                        color="neutral"
                                                        sx={{
                                                            borderRadius: "5px",
                                                            fontWeight: "bold",
                                                            marginX: "-10px",
                                                        }}
                                                        size="sm"
                                                    >
                                                        {projectName.toUpperCase().slice(0, 2)}
                                                    </Chip>
                                                    <Chip
                                                        key={`recent-task-chip-${taskId}`}
                                                        variant="soft"
                                                        color="neutral"
                                                        sx={{
                                                            borderRadius: "5px",
                                                            fontWeight: "bold",
                                                        }}
                                                        size="sm"
                                                    >
                                                        ID: {taskId || "N/A"}
                                                    </Chip>
                                                    <Chip
                                                        key={`status-chip-${taskId}-${index}`} // pass the key directly
                                                        variant="soft"
                                                        sx={{
                                                            backgroundColor: status.color
                                                                ? alpha(
                                                                      status.color,
                                                                      mode === "dark" ? 0.5 : 0.75
                                                                  )
                                                                : "transparent",
                                                            color: status.textColor,
                                                            fontWeight: "bold",
                                                            borderRadius: "5px",
                                                            marginX: "-10px",
                                                        }}
                                                        size="sm"
                                                    >
                                                        {`${status.status}`}
                                                    </Chip>
                                                    <Typography
                                                        noWrap
                                                        sx={{
                                                            overflow: "hidden",
                                                            textOverflow: "ellipsis",
                                                            whiteSpace: "nowrap",
                                                            width: "100%", // take full width of button
                                                            fontSize: "15px",
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
                                <ListItem key={"listitem-createProject"}>
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
                                    (
                                        {
                                            projectId,
                                            projectName,
                                            projectTags,
                                            systemUserId,
                                            isJoined,
                                        },
                                        index
                                    ) => {
                                        return (
                                            isJoined === true && (
                                                <Toggler
                                                    key={`toggler-TeamProjects-${index}`}
                                                    defaultExpanded={false}
                                                    renderToggle={({ open, setOpen }) => (
                                                        <ListItemButton
                                                            color={"neutral"}
                                                            variant={
                                                                projectId ===
                                                                currentProject?.projectId
                                                                    ? "solid"
                                                                    : "plain"
                                                            }
                                                            onClick={() => {
                                                                setOpen(!open);
                                                                setIsTaskHomeVisible(true);
                                                                setCurrentProject({
                                                                    projectId: projectId,
                                                                    projectName: projectName,
                                                                    projectTags: projectTags,
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
                                                            <KeyboardArrowDownIcon
                                                                sx={[
                                                                    open
                                                                        ? {
                                                                              transform:
                                                                                  "rotate(180deg)",
                                                                          }
                                                                        : {
                                                                              transform: "none",
                                                                          },
                                                                ]}
                                                            />
                                                        </ListItemButton>
                                                    )}
                                                >
                                                    <List>
                                                        {currentProject?.projectId === projectId &&
                                                            currentProject !== null &&
                                                            currentProject.projectTags.map(
                                                                (
                                                                    {
                                                                        tagName,
                                                                        tagColor,
                                                                        tagTextColor,
                                                                    },
                                                                    index
                                                                ) => {
                                                                    return (
                                                                        <ListItem
                                                                            key={`listitem-${tagName}-${index}`}
                                                                        >
                                                                            <ListItemButton
                                                                                color={"neutral"}
                                                                                onClick={() => {
                                                                                    setSelectedTagForFiltering(
                                                                                        `/${tagName}/`
                                                                                    );
                                                                                    setFilterBy(2);
                                                                                }}
                                                                                sx={{
                                                                                    overflow:
                                                                                        "hidden",
                                                                                }}
                                                                            >
                                                                                <Chip
                                                                                    key={`chip-${tagName}-${index}`}
                                                                                    variant="outlined"
                                                                                    sx={{
                                                                                        color:
                                                                                            mode ===
                                                                                            "dark"
                                                                                                ? "white"
                                                                                                : "black",
                                                                                        fontWeight:
                                                                                            "bold",
                                                                                        borderRadius:
                                                                                            "5px",
                                                                                        borderWidth:
                                                                                            "3px",
                                                                                        borderColor:
                                                                                            alpha(
                                                                                                tagColor,
                                                                                                mode ===
                                                                                                    "dark"
                                                                                                    ? 0.5
                                                                                                    : 0.75
                                                                                            ),
                                                                                        overflow:
                                                                                            "hidden",
                                                                                        textOverflow:
                                                                                            "ellipsis",
                                                                                        padding:
                                                                                            "4px",
                                                                                        ml: "10px",
                                                                                    }}
                                                                                    size="sm"
                                                                                >
                                                                                    {tagName}
                                                                                </Chip>
                                                                            </ListItemButton>
                                                                        </ListItem>
                                                                    );
                                                                }
                                                            )}
                                                    </List>
                                                </Toggler>
                                            )
                                        );
                                    }
                                )}
                                <Toggler
                                    key="toggler-OtherProjects"
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
                                                        <ListItem
                                                            key={`listitem-team-project-${projectId}`}
                                                        >
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
                                <ListItem key={"createTeam-listitem-todo"}>
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
                </List>
            </Box>
            <Divider />
        </Sheet>
    );
};
