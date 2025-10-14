import React, { useState } from "react";
import { Alert, Button, Modal, ModalDialog, Stack, Typography } from "@mui/joy";

import { TaskProps } from "../../../../types/tasks";

type Props = {
    openDeleteTask: boolean;
    setOpenDeleteTask: (value: boolean) => void;
    currentTaskContent: TaskProps;
    setCurrentTaskContent?: (value: TaskProps) => void;
    setTaskUpdated?: (value: boolean) => void;
    setTaskStatusUpdated?: (value: boolean) => void;
};

export const ModalDeleteTask: React.FC<Props> = ({
    openDeleteTask,
    setOpenDeleteTask,
    currentTaskContent,
    setCurrentTaskContent,
    setTaskUpdated,
    setTaskStatusUpdated,
}) => {
    const [errorMessage, setErrorMessage] = useState<string | null>(null);

    const handleDeleteTask = () => {
        if (setTaskUpdated) {
            // Update the existing task to be deleted.
            // Not executed in the task creation process.
            if (setCurrentTaskContent && setTaskStatusUpdated) {
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
                    setTaskStatusUpdated(true);
                })();
            }
            setTaskUpdated(true);
            setOpenDeleteTask(false);
        } else {
            console.error("`setTaskUpdated` is required to delete a task.");
        }
    };

    return (
        <>
            <Modal
                open={openDeleteTask}
                sx={{ zIndex: 10010 }}
                onClose={() => setOpenDeleteTask(false)}
            >
                <ModalDialog>
                    <Typography level="h4">
                        Are you sure to delete{" "}
                        <Typography color="danger" level="h3">
                            {currentTaskContent.title}
                        </Typography>{" "}
                        ?
                    </Typography>
                    {errorMessage && errorMessage !== "" && (
                        <Alert color="danger">{errorMessage}</Alert>
                    )}
                    <Stack direction="row" spacing={1} sx={{ mt: 2, justifyContent: "center" }}>
                        <Button
                            color="neutral"
                            component="button"
                            variant="outlined"
                            onClick={() => setOpenDeleteTask(false)}
                        >
                            Cancel
                        </Button>
                        <Button
                            color="danger"
                            component="button"
                            onClick={() => {
                                handleDeleteTask();
                            }}
                        >
                            Delete
                        </Button>
                    </Stack>
                </ModalDialog>
            </Modal>
        </>
    );
};
