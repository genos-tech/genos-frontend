import React, { useState } from "react";
import { keyframes } from "@emotion/react";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";
import { Alert, Box, Button, Modal, ModalDialog, Stack, Typography } from "@mui/joy";

import { useTranslation } from "../../../../i18n";
import { TaskProps } from "../../../../types/tasks";

const fadeIn = keyframes`
    from { opacity: 0; transform: scale(0.95) translateY(-10px); }
    to { opacity: 1; transform: scale(1) translateY(0); }
`;

const shake = keyframes`
    0%, 100% { transform: rotate(0deg); }
    25% { transform: rotate(-5deg); }
    75% { transform: rotate(5deg); }
`;

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
    const { t } = useTranslation();

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
        <Modal
            open={openDeleteTask}
            sx={{
                zIndex: 10010,
                backdropFilter: "blur(4px)",
                // Transparent: Joy's own Backdrop slot already paints
                // `palette.background.backdrop` + blur(8px). Stacking a
                // second 50% black on the modal root composited to ~75%,
                // which read as a solid black page. Matches ModalUserProfile.
                backgroundColor: "transparent",
            }}
            onClose={() => setOpenDeleteTask(false)}
        >
            <ModalDialog
                sx={{
                    animation: `${fadeIn} 0.2s ease-out`,
                    background:
                        "linear-gradient(145deg, rgba(30, 30, 40, 0.95) 0%, rgba(20, 20, 28, 0.98) 100%)",
                    border: "1px solid rgba(var(--gp-tint-danger-rgb), 0.2)",
                    borderRadius: "16px",
                    boxShadow:
                        "0 25px 50px -12px rgba(0, 0, 0, 0.5), 0 0 40px rgba(var(--gp-tint-danger-rgb), 0.1)",
                    width: { xs: "calc(100vw - 24px)", md: "auto" },
                    minWidth: { xs: 0, md: "360px" },
                    maxWidth: "100vw",
                    p: { xs: 2, md: 3 },
                    textAlign: "center",
                }}
            >
                {/* Icon */}
                <Box
                    sx={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        width: 56,
                        height: 56,
                        borderRadius: "14px",
                        background:
                            "linear-gradient(135deg, rgba(var(--gp-tint-danger-rgb), 0.15) 0%, rgba(var(--gp-tint-danger-alt-rgb), 0.15) 100%)",
                        border: "1px solid rgba(var(--gp-tint-danger-rgb), 0.25)",
                        mx: "auto",
                        mb: 2,
                        "&:hover": {
                            animation: `${shake} 0.4s ease-in-out`,
                        },
                    }}
                >
                    <DeleteOutlineIcon
                        sx={{ color: "rgba(var(--gp-tint-danger-rgb), 0.9)", fontSize: 28 }}
                    />
                </Box>

                {/* Title */}
                <Typography
                    level="h4"
                    sx={{
                        color: "rgba(255, 255, 255, 0.9)",
                        fontWeight: 600,
                        mb: 1,
                    }}
                >
                    {t.tasks.modals.deleteTask.title}
                </Typography>

                {/* Task Name */}
                <Typography
                    level="title-md"
                    sx={{
                        background:
                            "linear-gradient(135deg, var(--gp-tint-danger) 0%, var(--gp-tint-danger-alt) 100%)",
                        WebkitBackgroundClip: "text",
                        WebkitTextFillColor: "transparent",
                        fontWeight: 600,
                        mb: 0.5,
                        px: 2,
                    }}
                >
                    {currentTaskContent.title}
                </Typography>

                {/* Warning */}
                <Typography
                    level="body-sm"
                    sx={{
                        color: "rgba(255, 255, 255, 0.5)",
                        mb: 2.5,
                    }}
                >
                    {t.tasks.modals.deleteTask.body}
                </Typography>

                {/* Error Alert */}
                {errorMessage && (
                    <Alert
                        color="danger"
                        startDecorator={<WarningAmberIcon />}
                        sx={{
                            mb: 2,
                            borderRadius: "10px",
                            backgroundColor: "rgba(var(--gp-tint-danger-rgb), 0.1)",
                            border: "1px solid rgba(var(--gp-tint-danger-rgb), 0.3)",
                            textAlign: "left",
                        }}
                    >
                        {errorMessage}
                    </Alert>
                )}

                {/* Action Buttons */}
                <Stack direction="row" spacing={1.5} sx={{ justifyContent: "center" }}>
                    <Button
                        variant="plain"
                        sx={{
                            color: "rgba(255, 255, 255, 0.6)",
                            borderRadius: "10px",
                            px: 3,
                            "&:hover": {
                                backgroundColor: "rgba(255, 255, 255, 0.05)",
                                color: "rgba(255, 255, 255, 0.9)",
                            },
                        }}
                        onClick={() => setOpenDeleteTask(false)}
                    >
                        {t.tasks.modals.deleteTask.cancelButton}
                    </Button>
                    <Button
                        sx={{
                            background:
                                "linear-gradient(135deg, var(--gp-tint-danger-alt) 0%, var(--gp-tint-danger-deep) 100%)",
                            borderRadius: "10px",
                            px: 3,
                            fontWeight: 600,
                            boxShadow: "0 4px 15px rgba(var(--gp-tint-danger-rgb), 0.3)",
                            transition: "all 0.2s ease",
                            "&:hover": {
                                transform: "translateY(-1px)",
                                boxShadow: "0 6px 20px rgba(var(--gp-tint-danger-rgb), 0.4)",
                            },
                        }}
                        onClick={handleDeleteTask}
                    >
                        {t.tasks.modals.deleteTask.confirmButton}
                    </Button>
                </Stack>
            </ModalDialog>
        </Modal>
    );
};
