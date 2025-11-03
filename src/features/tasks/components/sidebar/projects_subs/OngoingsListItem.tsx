import { memo, useCallback, useEffect, useMemo, useState } from "react";
import AddIcon from "@mui/icons-material/Add";
import ForwardIcon from "@mui/icons-material/Forward";
import KeyboardArrowDownIcon from "@mui/icons-material/KeyboardArrowDown";
import { Box, Chip, List, ListItem, ListItemContent, Typography } from "@mui/joy";
import ListItemButton from "@mui/joy/ListItemButton";
import { useColorScheme } from "@mui/joy/styles";
import { alpha } from "@mui/system";

import { TaskManagementState } from "../../../../../hooks/tasks/useTaskManagement";
import { TaskMetaTreeNode } from "../../../../../types/tasks";
import { areObjectsEqual } from "../../../../../utils/objectHandler";
import { Toggler } from "../common";
import { TaskTreeToggler } from "./TaskTreeToggler";

type OngoingsListItemProps = {
    currentProjectId: number;
    TM: TaskManagementState;
};

// Memoized child components for better performance
const AddSubTaskButton = memo(
    ({
        node,
        rootTaskId,
        onCreateSubTask,
    }: {
        node: TaskMetaTreeNode;
        rootTaskId: number;
        onCreateSubTask: (taskId: number, rootTaskId: number) => void;
    }) => (
        <Box key={`my-note-box-${node.taskId}`}>
            <ListItem key={`my-note-${node.taskId}`} nested>
                <ListItemButton
                    sx={{ ml: "20px", mr: "8px", pl: "20px" }}
                    variant="plain"
                    onClick={() => onCreateSubTask(node.taskId, rootTaskId)}
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
    )
);
AddSubTaskButton.displayName = "AddSubTaskButton";

const TaskNodeButton = memo(
    ({
        node,
        isSelected,
        mode,
        onTaskClick,
        onToggle,
    }: {
        node: TaskMetaTreeNode;
        isSelected: boolean;
        mode: "light" | "dark";
        onTaskClick: (node: TaskMetaTreeNode) => void;
        onToggle: () => void;
    }) => {
        const handleClick = useCallback(() => {
            onTaskClick(node);
        }, [node, onTaskClick]);

        const handleToggleClick = useCallback(
            (e: React.MouseEvent) => {
                e.stopPropagation();
                onToggle();
            },
            [onToggle]
        );

        return (
            <ListItemButton
                selected={isSelected}
                sx={{ ml: "45px", mr: "8px", pl: "20px" }}
                variant="plain"
                onClick={handleClick}
            >
                <Chip
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
                    sx={{
                        transform: "none",
                    }}
                    onClick={handleToggleClick}
                />
            </ListItemButton>
        );
    }
);
TaskNodeButton.displayName = "TaskNodeButton";

const TaskTreeNode = memo(
    ({
        node,
        rootTaskId,
        TM,
        mode,
        onTaskClick,
        onCreateSubTask,
    }: {
        node: TaskMetaTreeNode;
        rootTaskId: number;
        TM: TaskManagementState;
        mode: "light" | "dark" | undefined;
        onTaskClick: (
            node: TaskMetaTreeNode,
            open: boolean,
            setOpen: (value: boolean) => void
        ) => void;
        onCreateSubTask: (taskId: number, rootTaskId: number) => void;
    }) => {
        const isSelected = TM.currentPreviewTaskId === node.taskId;
        const hasChildren = node.children.length > 0;
        const actualMode = mode || "light";

        const renderToggle = useCallback(
            ({ open, setOpen }: { open: boolean; setOpen: (value: boolean) => void }) => (
                <TaskNodeButton
                    isSelected={isSelected}
                    mode={actualMode}
                    node={node}
                    onTaskClick={(n) => onTaskClick(n, open, setOpen)}
                    onToggle={() => setOpen(!open)}
                />
            ),
            [node, isSelected, actualMode, onTaskClick]
        );

        return (
            <Box key={`my-note-box-${node.taskId}`}>
                <ListItem key={`my-note-${node.taskId}`} nested>
                    <TaskTreeToggler renderToggle={renderToggle}>
                        {hasChildren ? (
                            <List>
                                {node.children.map((child) => (
                                    <TaskTreeNode
                                        key={child.taskId}
                                        TM={TM}
                                        mode={mode}
                                        node={child}
                                        rootTaskId={rootTaskId}
                                        onCreateSubTask={onCreateSubTask}
                                        onTaskClick={onTaskClick}
                                    />
                                ))}
                            </List>
                        ) : (
                            <List>
                                <AddSubTaskButton
                                    node={node}
                                    rootTaskId={rootTaskId}
                                    onCreateSubTask={onCreateSubTask}
                                />
                            </List>
                        )}
                    </TaskTreeToggler>
                </ListItem>
            </Box>
        );
    }
);
TaskTreeNode.displayName = "TaskTreeNode";

export const OngoingsListItem = (props: OngoingsListItemProps) => {
    const { currentProjectId, TM } = props;
    const { mode: rawMode } = useColorScheme();
    const mode: "light" | "dark" | undefined = rawMode === "system" ? "light" : rawMode;

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
    }, [TM.taskMetaTree, tmpTaskMetaTree]);

    // Memoize filtered task tree
    const filteredTaskTree = useMemo(
        () => tmpTaskMetaTree.filter((root) => root.project.projectId === currentProjectId),
        [tmpTaskMetaTree, currentProjectId]
    );

    // Memoize callback handlers
    const handleCreateSubTask = useCallback(
        (taskId: number, rootTaskId: number) => {
            TM.setIsCreatingTask({
                flag: true,
                parentTaskId: taskId,
                rootTaskId: rootTaskId,
            });
            TM.setIsTaskHomeVisible(false);
        },
        [TM]
    );

    const handleTaskClick = useCallback(
        (node: TaskMetaTreeNode, open: boolean, setOpen: (value: boolean) => void) => {
            if (node.children.length > 0) {
                setOpen(!open);
            }
            TM.setIsTaskPreviewVisible(true);
            TM.setCurrentPreviewTaskId(node.taskId);
        },
        [TM]
    );

    const handleOuterToggleClick = useCallback(() => {
        TM.getTaskMeta();
    }, [TM]);

    const renderOuterToggle = useCallback(
        ({ open, setOpen }: { open: boolean; setOpen: (value: boolean) => void }) => (
            <ListItemButton
                color="neutral"
                sx={{ ml: "45px", mr: "8px", pl: "30px" }}
                onClick={() => {
                    handleOuterToggleClick();
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
                        Ongoings
                    </Typography>
                </ListItemContent>
                <KeyboardArrowDownIcon
                    sx={{
                        transform: open ? "rotate(180deg)" : "none",
                    }}
                />
            </ListItemButton>
        ),
        [handleOuterToggleClick]
    );

    return (
        <Toggler defaultExpanded={false} renderToggle={renderOuterToggle}>
            <List>
                {tmpCurrentTaskChain &&
                    filteredTaskTree.map((root) => (
                        <TaskTreeNode
                            key={root.taskId}
                            TM={TM}
                            mode={mode}
                            node={root}
                            rootTaskId={root.taskId}
                            onCreateSubTask={handleCreateSubTask}
                            onTaskClick={handleTaskClick}
                        />
                    ))}
            </List>
        </Toggler>
    );
};
