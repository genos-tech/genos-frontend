import AddIcon from "@mui/icons-material/Add";
import ForwardIcon from "@mui/icons-material/Forward";
import KeyboardArrowDownIcon from "@mui/icons-material/KeyboardArrowDown";
import { Box, Chip, List, ListItem, ListItemContent, Typography } from "@mui/joy";
import ListItemButton from "@mui/joy/ListItemButton";
import { useColorScheme } from "@mui/joy/styles";
import { alpha } from "@mui/system";
import { useEffect, useState } from "react";

import { TaskManagementState } from "../../../../../hooks/tasks/useTaskManagement";
import { ProjectProps, TagListProps, TaskMetaTreeNode } from "../../../../../types/tasks";
import { areObjectsEqual } from "../../../../../utils/objectHandler";
import { Toggler } from "../common";
import { TaskTreeToggler } from "./TaskTreeToggler";

type OngoingsListItemProps = {
    currentProjectId: number;
    setCurrentProject: (value: ProjectProps) => void;
    projectTags: TagListProps[];
    setIsTaskHomeVisible: (value: boolean) => void;
    TM: TaskManagementState;
};
export const OngoingsListItem = (props: OngoingsListItemProps) => {
    const { currentProjectId, projectTags, setCurrentProject, setIsTaskHomeVisible, TM } = props;
    const { mode } = useColorScheme();

    const [tmpCurrentTaskChain, setTmpCurrentTaskChain] = useState<TaskMetaTreeNode[]>();
    const [tmpTaskMetaTree, setTmpTaskMetaTree] = useState<TaskMetaTreeNode[]>(TM.taskMetaTree);
    useEffect(() => {
        if (TM.currentTaskChain && TM.currentTaskChain.length > 0) {
            setTmpCurrentTaskChain(TM.currentTaskChain);
        } else {
            setTmpCurrentTaskChain([]);
        }
    }, [TM.currentTaskChain]);

    // Only when `taskMetaTree` has been updated with new contents, refresh the Note Chain.
    // `taskMetaTree` has been always updated without any contents change. Is such case,
    // no need to refresh it since it's the same as the tmp one.
    useEffect(() => {
        if (areObjectsEqual(tmpTaskMetaTree, TM.taskMetaTree) === false) {
            setTmpTaskMetaTree(TM.taskMetaTree);
        }
    }, [TM.taskMetaTree]);

    const createChildNoteList = (node: any) => (
        <Box key={`my-note-box-${node.taskId}`}>
            <ListItem key={`my-note-${node.taskId}`} nested>
                <ListItemButton
                    sx={{ ml: "20px", mr: "8px", pl: "20px" }}
                    variant="plain"
                    onClick={() => {
                        TM.setIsCreatingTask({
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
                            startDecorator={<AddIcon />}
                            sx={{
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                                whiteSpace: "nowrap",
                                width: "100%",
                                justifyContent: "right",
                            }}
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
                <ListItem key={`my-note-${node.taskId}`} nested>
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
                    startDecorator={<ForwardIcon />}
                    sx={{
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                    }}
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
            selected={TM.currentPreviewTaskId === node.taskId ? true : false}
            sx={{ ml: "45px", mr: "8px", pl: "20px" }}
            variant="plain"
            onClick={() => {
                // Only open the task if it's not already open.
                if (open === false) {
                    setOpen(!open);
                }

                TM.setIsTaskPreviewVisible(true);

                setCurrentProject({ ...node.project, projectTags: projectTags });
                TM.setCurrentPreviewTaskId(node.taskId);
            }}
        >
            <Chip
                key={`id-chip-${node.taskId}`} // pass the key directly
                color="neutral"
                size="sm"
                variant="soft"
                sx={{
                    marginRight: "1px",
                    borderRadius: "5px",
                    fontWeight: "bold",
                }}
            >
                ID: {node.taskId}
            </Chip>
            <Chip
                key={`status-chip-${node.taskId}`} // pass the key directly
                size="sm"
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
            >
                {`${node.status.status}`}
            </Chip>
            <ListItemContent>
                <Typography
                    level="title-sm"
                    sx={{
                        ml: "5px",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                    }}
                    noWrap
                >
                    {node.title}
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
                onClick={() => {
                    setOpen(!open);
                }}
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
