import AccountTreeIcon from "@mui/icons-material/AccountTree";
import KeyboardArrowDownIcon from "@mui/icons-material/KeyboardArrowDown";
import LockOutlineIcon from "@mui/icons-material/LockOutline";
import WorkIcon from "@mui/icons-material/Work";
import { Box, List, ListItem, ListItemContent, Typography } from "@mui/joy";
import ListItemButton from "@mui/joy/ListItemButton";
import { useColorScheme } from "@mui/joy/styles";

import { ProjectManagementState } from "../../../../hooks/common/useProjectManagement";
import { TaskManagementState } from "../../../../hooks/tasks/useTaskManagement";
import { Toggler } from "./common";
import { JoinProjectListItem } from "./projects_subs/JoinProjectListItem";
import { NewProjectListItem } from "./projects_subs/NewProjectListItem";
import { OngoingsListItem } from "./projects_subs/OngoingsListItem";

type ProjectsListItemProps = {
    usePM: ProjectManagementState;
    setIsTaskHomeVisible: (value: boolean) => void;
    setOpenJoinProject: (value: {
        flag: boolean;
        projectId: number;
        projectName: string;
        isPrivate: boolean;
        systemUserId: string;
    }) => void;
    useTM: TaskManagementState;
};

export const ProjectsListItem = (props: ProjectsListItemProps) => {
    const { usePM, setIsTaskHomeVisible, setOpenJoinProject, useTM } = props;
    const { mode } = useColorScheme();
    const isDark = mode === "dark";

    return (
        <ListItem nested>
            <Toggler
                key={`toggler-TeamProjects`}
                defaultExpanded={true}
                renderToggle={({ open, setOpen }) => (
                    <ListItemButton
                        onClick={() => {
                            setOpen(!open);
                        }}
                        sx={{
                            borderRadius: "10px",
                            py: 1,
                            px: 1.5,
                            gap: 1.5,
                            transition: "all 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
                            "&:hover": {
                                backgroundColor: isDark
                                    ? "rgba(255,255,255,0.06)"
                                    : "rgba(0,0,0,0.04)",
                            },
                        }}
                    >
                        <Box
                            sx={{
                                width: 28,
                                height: 28,
                                borderRadius: "8px",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                backgroundColor: isDark
                                    ? "rgba(255,255,255,0.08)"
                                    : "rgba(0,0,0,0.05)",
                                transition: "all 0.2s ease",
                            }}
                        >
                            <WorkIcon
                                sx={{
                                    fontSize: 16,
                                    color: isDark ? "rgba(255,255,255,0.75)" : "rgba(0,0,0,0.65)",
                                }}
                            />
                        </Box>
                        <ListItemContent>
                            <Typography
                                level="body-sm"
                                sx={{
                                    fontWeight: 500,
                                    overflow: "hidden",
                                    textOverflow: "ellipsis",
                                    whiteSpace: "nowrap",
                                    color: isDark ? "rgba(255,255,255,0.9)" : "rgba(0,0,0,0.8)",
                                }}
                            >
                                Projects
                            </Typography>
                        </ListItemContent>
                        <KeyboardArrowDownIcon
                            sx={{
                                fontSize: 18,
                                color: isDark ? "rgba(255,255,255,0.5)" : "rgba(0,0,0,0.4)",
                                transition: "transform 0.2s ease",
                                transform: open ? "rotate(180deg)" : "none",
                            }}
                        />
                    </ListItemButton>
                )}
            >
                <List sx={{ gap: 0.25, py: 0.5 }}>
                    {usePM.teamProjects.map(
                        (
                            {
                                projectId,
                                projectName,
                                projectTags,
                                isPrivate,
                                systemUserId,
                                isJoined,
                            },
                            index
                        ) => {
                            const isSelected = projectId === usePM.currentProject?.projectId;
                            return (
                                isJoined === true && (
                                    <Toggler
                                        key={`toggler-TeamProjects-${projectId}-${index}`}
                                        defaultExpanded={false}
                                        renderToggle={({ open, setOpen }) => (
                                            <ListItemButton
                                                selected={isSelected}
                                                onClick={() => {
                                                    setOpen(!open);
                                                    setIsTaskHomeVisible(true);
                                                    useTM.setIsSprintBoardVisible(false);

                                                    // Only if the clicked project id is not the same as the current one,
                                                    // reset the project (and load tasks in the downstream step.)
                                                    if (
                                                        projectId !==
                                                        usePM.currentProject?.projectId
                                                    ) {
                                                        // Reset the task table...
                                                        useTM.setAllTasks([]);
                                                        (async () => {
                                                            await usePM.loadProjectsAndTasks(
                                                                projectId
                                                            );
                                                            // This will be executed in the loadProjectsAndTasks,
                                                            // but somehow this needs to update the task table...
                                                            usePM.setCurrentProject({
                                                                projectId: projectId,
                                                                projectName: projectName,
                                                                projectTags: projectTags,
                                                                isPrivate: isPrivate,
                                                                systemUserId: systemUserId,
                                                            });
                                                        })();
                                                    }
                                                }}
                                                sx={{
                                                    overflow: "hidden",
                                                    borderRadius: "8px",
                                                    py: 0.75,
                                                    px: 1.25,
                                                    gap: 1,
                                                    transition: "all 0.15s ease",
                                                    "&:hover": {
                                                        backgroundColor: isDark
                                                            ? "rgba(255,255,255,0.04)"
                                                            : "rgba(0,0,0,0.03)",
                                                    },
                                                    "&.Mui-selected": {
                                                        backgroundColor: isDark
                                                            ? "rgba(251,146,60,0.15)"
                                                            : "rgba(234,88,12,0.1)",
                                                        "&:hover": {
                                                            backgroundColor: isDark
                                                                ? "rgba(251,146,60,0.2)"
                                                                : "rgba(234,88,12,0.15)",
                                                        },
                                                    },
                                                }}
                                            >
                                                <AccountTreeIcon
                                                    sx={{
                                                        fontSize: 16,
                                                        color: isSelected
                                                            ? isDark
                                                                ? "#fb923c"
                                                                : "#ea580c"
                                                            : isDark
                                                              ? "rgba(255,255,255,0.6)"
                                                              : "rgba(0,0,0,0.5)",
                                                    }}
                                                />

                                                {isPrivate === true && (
                                                    <LockOutlineIcon
                                                        sx={{
                                                            fontSize: 14,
                                                            mx: -0.5,
                                                            color: isDark
                                                                ? "rgba(255,255,255,0.4)"
                                                                : "rgba(0,0,0,0.35)",
                                                        }}
                                                    />
                                                )}

                                                <Typography
                                                    level="body-xs"
                                                    sx={{
                                                        overflow: "hidden",
                                                        textOverflow: "ellipsis",
                                                        whiteSpace: "nowrap",
                                                        flex: 1,
                                                        fontWeight: isSelected ? 600 : 500,
                                                        color: isSelected
                                                            ? isDark
                                                                ? "#fb923c"
                                                                : "#ea580c"
                                                            : isDark
                                                              ? "rgba(255,255,255,0.8)"
                                                              : "rgba(0,0,0,0.7)",
                                                    }}
                                                    noWrap
                                                >
                                                    {projectName}
                                                </Typography>
                                                <KeyboardArrowDownIcon
                                                    sx={{
                                                        fontSize: 16,
                                                        color: isDark
                                                            ? "rgba(255,255,255,0.4)"
                                                            : "rgba(0,0,0,0.35)",
                                                        transition: "transform 0.2s ease",
                                                        transform: open
                                                            ? "rotate(180deg)"
                                                            : "none",
                                                    }}
                                                />
                                            </ListItemButton>
                                        )}
                                    >
                                        <List sx={{ gap: 0.25, py: 0.25 }}>
                                            <OngoingsListItem
                                                currentProjectId={projectId}
                                                useTM={useTM}
                                            />
                                        </List>
                                    </Toggler>
                                )
                            );
                        }
                    )}

                    <JoinProjectListItem usePM={usePM} setOpenJoinProject={setOpenJoinProject} />

                    <NewProjectListItem usePM={usePM} />
                </List>
            </Toggler>
        </ListItem>
    );
};
