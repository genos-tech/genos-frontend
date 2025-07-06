import { Stack, IconButton } from "@mui/joy";
import AddIcon from "@mui/icons-material/Add";
import DeleteIcon from "@mui/icons-material/Delete";
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutline";

import { TaskProps } from "../../../../../types/tasks";

type TaskPreviewCustomBarProps = {
    currentTaskContent: TaskProps;
    setCurrentTaskContent: (value: TaskProps) => void;
    setTaskUpdated: (value: boolean) => void;
    setIsCreatingTask: (value: any) => void;
};
export const TaskPreviewCustomBar = (props: TaskPreviewCustomBarProps) => {
    const { currentTaskContent, setCurrentTaskContent, setTaskUpdated, setIsCreatingTask } = props;

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
                                    color: "#ffff23",
                                    textColor: "purple",
                                },
                            });
                        })();
                        setTaskUpdated(true);
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
                    }}
                >
                    <CheckCircleOutlineIcon sx={{ fontSize: "15px" }} />
                    Mark as Closed
                </IconButton>
            ) : (
                <div></div>
            )}
            {/* Sub Task IconButton aligned to the right */}
            <IconButton
                component="p"
                variant="outlined"
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
                        setIsCreatingTask({
                            flag: true,
                            parentTaskId: currentTaskContent.id,
                            rootTaskId: currentTaskContent.rootTaskId,
                        });
                    } else {
                        console.error("Task ID nod defined error.");
                    }
                }}
            >
                <AddIcon />
                Sub Task
            </IconButton>
            {/* Delete IconButton */}
            {currentTaskContent.status.status !== "Closed" ? (
                <IconButton
                    component="p"
                    variant="outlined"
                    color="danger"
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
                                    status: "Deleted",
                                    color: "#ff2323",
                                    textColor: "white",
                                },
                            });
                        })();
                        setTaskUpdated(true);
                    }}
                >
                    <DeleteIcon sx={{ fontSize: "15px" }} />
                    Delete
                </IconButton>
            ) : (
                <div></div>
            )}
        </Stack>
    );
};
