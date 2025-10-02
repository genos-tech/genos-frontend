import { Stack, IconButton } from "@mui/joy";
import AddIcon from "@mui/icons-material/Add";
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutline";
import CheckIcon from "@mui/icons-material/Check";

import { TaskProps } from "../../../../../types/tasks";

type TaskCustomBarBlockProps = {
    currentTaskContent: TaskProps;
    setCurrentTaskContent: (value: TaskProps) => void;
    setTaskUpdated: (value: boolean) => void;
    setTaskStatusUpdated: (value: boolean) => void;
    setIsCreatingTask?: (value: any) => void;
    taskBodySaved: boolean;
    setIsTaskHomeVisible?: (value: boolean) => void;
};
export const TaskCustomBarBlock = (props: TaskCustomBarBlockProps) => {
    const {
        currentTaskContent,
        setCurrentTaskContent,
        setTaskUpdated,
        setTaskStatusUpdated,
        setIsCreatingTask,
        taskBodySaved,
        setIsTaskHomeVisible,
    } = props;

    return (
        <Stack direction="row" sx={{ width: "100%", alignItems: "center", gap: 1 }}>
            {/* Next Status IconButton */}
            {currentTaskContent.status.status === "Open" ||
            currentTaskContent.status.status === "Pending" ? (
                <IconButton
                    component="p"
                    variant="outlined"
                    color="warning"
                    size="sm"
                    sx={{
                        fontSize: "14px",
                        paddingX: "7px",
                    }}
                    onClick={() => {
                        (async () => {
                            setCurrentTaskContent({
                                ...currentTaskContent,
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
            {currentTaskContent.status.status === "WIP" ? (
                <IconButton
                    component="p"
                    variant="outlined"
                    color="success"
                    size="sm"
                    sx={{
                        fontSize: "14px",
                        paddingX: "7px",
                    }}
                    onClick={() => {
                        (async () => {
                            setCurrentTaskContent({
                                ...currentTaskContent,
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
                    component="p"
                    variant="plain"
                    color="neutral"
                    size="sm"
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
            {currentTaskContent.status.status !== "Deleted" && (
                <IconButton
                    component="p"
                    variant="plain"
                    size="sm"
                    sx={{
                        fontSize: "14px",
                        paddingX: "7px",
                        marginLeft: "auto",
                    }}
                    onClick={() => {
                        if (
                            currentTaskContent.id !== undefined &&
                            currentTaskContent.rootTaskId != null
                        ) {
                            if (setIsCreatingTask) {
                                setIsCreatingTask({
                                    flag: true,
                                    parentTaskId: currentTaskContent.id,
                                    rootTaskId: currentTaskContent.rootTaskId,
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
            )}
        </Stack>
    );
};
