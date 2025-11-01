import AddIcon from "@mui/icons-material/Add";
import CheckIcon from "@mui/icons-material/Check";
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutline";
import { IconButton, Stack, Tooltip } from "@mui/joy";

import { TaskProps } from "../../../../../types/tasks";

type TaskCustomBarBlockProps = {
    taskContent: TaskProps;
    setTaskContent: (value: TaskProps) => void;
    setTaskUpdated: (value: boolean) => void;
    setTaskStatusUpdated: (value: boolean) => void;
    setIsCreatingTask?: (value: any) => void;
    taskBodySaved: boolean;
    setIsTaskHomeVisible?: (value: boolean) => void;
};
export const TaskCustomBarBlock = (props: TaskCustomBarBlockProps) => {
    const {
        taskContent,
        setTaskContent,
        setTaskUpdated,
        setTaskStatusUpdated,
        setIsCreatingTask,
        taskBodySaved,
        setIsTaskHomeVisible,
    } = props;

    return (
        <Stack direction="row" sx={{ width: "100%", alignItems: "center", gap: 1 }}>
            {/* Next Status IconButton */}
            {taskContent.status.status === "Open" || taskContent.status.status === "Pending" ? (
                <IconButton
                    color="warning"
                    component="p"
                    size="sm"
                    variant="outlined"
                    sx={{
                        fontSize: "14px",
                        paddingX: "7px",
                    }}
                    onClick={() => {
                        (async () => {
                            setTaskContent({
                                ...taskContent,
                                status: {
                                    code: 0,
                                    status: "WIP",
                                    color: "#ff8c00ff",
                                    textColor: "white",
                                },
                            });
                        })();
                        setTaskUpdated(true);
                        setTaskStatusUpdated(true);
                    }}
                >
                    <CheckCircleOutlineIcon sx={{ fontSize: "15px" }} />
                    Mark as WIP
                </IconButton>
            ) : (
                <div></div>
            )}
            {taskContent.status.status === "WIP" ? (
                <IconButton
                    color="success"
                    component="p"
                    size="sm"
                    variant="outlined"
                    sx={{
                        fontSize: "14px",
                        paddingX: "7px",
                    }}
                    onClick={() => {
                        (async () => {
                            setTaskContent({
                                ...taskContent,
                                status: {
                                    code: 0,
                                    status: "Closed",
                                    color: "#1dc200",
                                    textColor: "white",
                                },
                            });
                        })();
                        setTaskUpdated(true);
                        setTaskStatusUpdated(true);
                    }}
                >
                    <CheckCircleOutlineIcon sx={{ fontSize: "15px" }} />
                    Mark as Closed
                </IconButton>
            ) : (
                <div></div>
            )}

            {taskBodySaved === true && (
                <IconButton
                    color="neutral"
                    component="p"
                    size="sm"
                    variant="plain"
                    sx={{
                        fontSize: "14px",
                        paddingX: "5px",
                    }}
                >
                    <CheckIcon sx={{ fontSize: "15px" }} />
                    Saved
                </IconButton>
            )}

            {/* Sub Task IconButton aligned to the right */}
            {taskContent.status.status !== "Deleted" && (
                <Tooltip size="sm" title="Create a Sub Task" variant="outlined">
                    <IconButton
                        component="p"
                        size="sm"
                        variant="plain"
                        sx={{
                            fontSize: "14px",
                            paddingX: "7px",
                            marginLeft: "auto",
                        }}
                        onClick={() => {
                            if (taskContent.id !== undefined && taskContent.rootTaskId != null) {
                                if (setIsCreatingTask) {
                                    setIsCreatingTask({
                                        flag: true,
                                        parentTaskId: taskContent.id,
                                        rootTaskId: taskContent.rootTaskId,
                                    });
                                }

                                // Close task-home when creating a sub task.
                                if (setIsTaskHomeVisible) {
                                    setIsTaskHomeVisible(false);
                                }
                            } else {
                                console.error("Task ID nod defined error.");
                            }
                        }}
                    >
                        <AddIcon />
                        Sub Task
                    </IconButton>
                </Tooltip>
            )}
        </Stack>
    );
};
