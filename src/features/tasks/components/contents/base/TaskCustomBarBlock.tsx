import CheckIcon from "@mui/icons-material/Check";
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutline";
import { IconButton, Stack } from "@mui/joy";

import { TaskProps } from "../../../../../types/tasks";

type TaskCustomBarBlockProps = {
    taskContent: TaskProps;
    setTaskContent: (value: TaskProps) => void;
    setTaskUpdated: (value: boolean) => void;
    setTaskStatusUpdated: (value: boolean) => void;
    taskBodySaved: boolean;
};
export const TaskCustomBarBlock = (props: TaskCustomBarBlockProps) => {
    const { taskContent, setTaskContent, setTaskUpdated, setTaskStatusUpdated, taskBodySaved } =
        props;

    return (
        <Stack
            direction="row"
            sx={{
                width: "100%",
                alignItems: "center",
                gap: 1,
                justifyContent: "flex-end",
                pb: 1,
            }}
        >
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
                                    color: "#ff8c00",
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
        </Stack>
    );
};
