import { alpha } from "@mui/system";
import { useState, useEffect } from "react";
import { Box, List, ListItem, ListItemContent, Typography, Chip } from "@mui/joy";
import ListItemButton from "@mui/joy/ListItemButton";
import AddIcon from "@mui/icons-material/Add";
import KeyboardArrowDownIcon from "@mui/icons-material/KeyboardArrowDown";
import ForwardIcon from "@mui/icons-material/Forward";
import { useColorScheme } from "@mui/joy/styles";

import { ProjectProps, TagListProps, TaskMetaTreeNode } from "../../../../../types/tasks";
import { Toggler } from "../common";
import { TaskTreeToggler } from "./TaskTreeToggler";
import { getCurrentTimestamp } from "../../../../../utils/dateUtils";
import { areObjectsEqual } from "../../../../../utils/objectHandler";

type OngoingsListItemProps = {
    taskMetaTree: TaskMetaTreeNode[];
    currentProjectId: number;
    currentTaskChain?: TaskMetaTreeNode[];
    currentPreviewTaskId: number;
    setIsTaskPreviewVisible: (value: boolean) => void;
    setCurrentProject: (value: ProjectProps) => void;
    setCurrentPreviewTaskId: (value: number) => void;
    projectTags: TagListProps[];
    setIsCreatingTask: (value: {
        flag: boolean;
        parentTaskId: number | null;
        rootTaskId: number | null;
    }) => void;
    setIsTaskHomeVisible: (value: boolean) => void;
};
export const OngoingsListItem = (props: OngoingsListItemProps) => {
    const {
        taskMetaTree,
        currentProjectId,
        currentTaskChain,
        currentPreviewTaskId,
        setIsTaskPreviewVisible,
        setCurrentProject,
        setCurrentPreviewTaskId,
        projectTags,
        setIsCreatingTask,
        setIsTaskHomeVisible,
    } = props;
    const { mode } = useColorScheme();

    const [tmpCurrentTaskChain, setTmpCurrentTaskChain] = useState<TaskMetaTreeNode[]>();
    const [tmpTaskMetaTree, setTmpTaskMetaTree] = useState<TaskMetaTreeNode[]>(taskMetaTree);
    useEffect(() => {
        if (currentTaskChain && currentTaskChain.length > 0) {
            setTmpCurrentTaskChain(currentTaskChain);
        } else {
            setTmpCurrentTaskChain([]);
        }
    }, [currentTaskChain]);

    // Only when `taskMetaTree` has been updated with new contents, refresh the Note Chain.
    // `taskMetaTree` has been always updated without any contents change. Is such case,
    // no need to refresh it since it's the same as the tmp one.
    useEffect(() => {
        if (areObjectsEqual(tmpTaskMetaTree, taskMetaTree) === false) {
            setTmpTaskMetaTree(taskMetaTree);
        }
    }, [taskMetaTree]);

    const createChildNoteList = (node: any) => (
        <Box key={`my-note-box-${node.taskId}`}>
            <ListItem nested key={`my-note-${node.taskId}`}>
                <ListItemButton
                    variant="plain"
                    sx={{ ml: "20px", mr: "8px", pl: "20px" }}
                    onClick={() => {
                        setIsCreatingTask({
                            flag: true,
                            parentTaskId: node.taskId,
                            rootTaskId: node.rootTaskId,
                        });

                        // Close task-home when creating a sub task.
                        setIsTaskHomeVisible(false);
                    }}
                >
                    <ListItemContent>
                        <Typography
                            level="title-sm"
                            sx={{
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                                whiteSpace: "nowrap",
                                width: "100%",
                            }}
                            startDecorator={<AddIcon />}
                        >
                            Sub Task
                        </Typography>
                    </ListItemContent>
                </ListItemButton>
            </ListItem>
        </Box>
    );

    const renderTaskTree = (node: TaskMetaTreeNode) => (
        <Box key={`my-note-box-${node.taskId}`}>
            {tmpCurrentTaskChain && (
                <ListItem nested key={`my-note-${node.taskId}`}>
                    <TaskTreeToggler
                        renderToggle={({ open, setOpen }) =>
                            innerRenderToggleListItemButton(open, setOpen, node)
                        }
                    >
                        {node.children.length > 0 && tmpCurrentTaskChain && (
                            <List>{node.children.map((child) => renderTaskTree(child))}</List>
                        )}
                        {node.children.length === 0 && <List>{createChildNoteList(node)}</List>}
                    </TaskTreeToggler>
                </ListItem>
            )}
        </Box>
    );

    const outerRenderToggleListItemButton = (
        ongoingsTitle: string,
        open: boolean,
        setOpen: (value: boolean) => void
    ) => (
        <ListItemButton
            color="neutral"
            sx={{ ml: "45px", mr: "8px", pl: "30px" }}
            onClick={() => {
                setOpen(!open);
            }}
        >
            <ListItemContent>
                <Typography
                    level="title-sm"
                    sx={{
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                    }}
                    startDecorator={<ForwardIcon />}
                >
                    {ongoingsTitle}
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
    );

    const innerRenderToggleListItemButton = (
        open: boolean,
        setOpen: (value: boolean) => void,
        node: any
    ) => (
        <ListItemButton
            selected={currentPreviewTaskId === node.taskId ? true : false}
            variant="plain"
            sx={{ ml: "45px", mr: "8px", pl: "20px" }}
            onClick={() => {
                // Only open the task if it's not already open.
                if (open === false) {
                    setOpen(!open);
                }

                setIsTaskPreviewVisible(true);

                // No need to pass the tags here since it'll be updated in the other components.
                setCurrentProject({ ...node.project, projectTags: projectTags });
                setCurrentPreviewTaskId(node.taskId);
            }}
        >
            <Chip
                key={`status-chip-${node.taskId}`} // pass the key directly
                variant="soft"
                sx={{
                    backgroundColor: node.status.color
                        ? alpha(node.status.color, mode === "dark" ? 0.5 : 0.75)
                        : "transparent",
                    color: node.status.textColor,
                    fontWeight: "bold",
                    borderRadius: "5px",
                    marginX: "-10px",
                }}
                size="sm"
            >
                {`${node.status.status}`}
            </Chip>
            <ListItemContent>
                <Typography
                    noWrap
                    level="title-sm"
                    sx={{
                        ml: "5px",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                    }}
                >
                    {node.title}
                </Typography>
            </ListItemContent>
            <KeyboardArrowDownIcon
                onClick={() => {
                    setOpen(!open);
                }}
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
    );

    return (
        <Toggler
            defaultExpanded={false}
            renderToggle={({ open, setOpen }) =>
                outerRenderToggleListItemButton("Ongoings", open, setOpen)
            }
        >
            <List>
                {tmpTaskMetaTree
                    .filter((root) => root.project.projectId === currentProjectId)
                    .map((root) => renderTaskTree(root))}
            </List>
        </Toggler>
    );
};
