import React, { useState } from "react";
import { keyframes } from "@emotion/react";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";
import { Alert, Box, Button, Modal, ModalDialog, Stack, Typography } from "@mui/joy";
import { Socket } from "socket.io-client";

import { useTranslation } from "../../../../i18n";
import { TaskCommentProps } from "../../../../types/tasks";
import { emitTaskTouched } from "../../services/taskEvents";

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
    socket: Socket | null;
    open: boolean;
    setOpen: (value: boolean) => void;
    comment: TaskCommentProps;
    currentProjectId?: number;
    currentProjectName?: string;
    currentTaskDisplayId?: string | null;
    /** Stacking level of the hosting surface. Present ⇒ the comment
     * bubble lives inside a modal-hosted preview (UrlLinkModal family,
     * z 10020+), so the dialog lifts to host+2 — the same convention as
     * `noteModalChildStackSx`. Absent ⇒ page-hosted; the 10010 dialog
     * default applies. Hardcoding 10010 here would repeat the known
     * bug where sibling dialogs open invisibly BEHIND the preview
     * modal. */
    hostZIndex?: number;
};

/**
 * Confirm-then-delete dialog for a task comment. Visual language and
 * structure mirror `ModalDeleteMessage` / `ModalDeleteTask`.
 *
 * Owns the delete emit (like `ModalDeleteMessage` owns
 * `deleteMessage`): the socket `task_comment` DELETE round-trips
 * through Flask → Django (soft-delete) → `wsType: "task"` broadcast,
 * which refreshes every mounted comment list via the scoped
 * `task-touched` bus. The ack-side `emitTaskTouched` just drops the
 * 15s comment cache a beat earlier for the deleter. No optimistic
 * list filter — the broadcast round-trip is the single source of
 * truth, matching how comment posts/edits already behave.
 */
export const ModalDeleteTaskComment: React.FC<Props> = ({
    socket,
    open,
    setOpen,
    comment,
    currentProjectId,
    currentProjectName,
    currentTaskDisplayId,
    hostZIndex,
}) => {
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const { t } = useTranslation();

    const handleDeleteComment = () => {
        if (!socket) {
            console.error("socket is not defined");
            setErrorMessage(t.tasks.modals.deleteComment.error);
            return;
        }

        socket.emit(
            "task_comment",
            {
                method_type: "DELETE",
                project_id: currentProjectId,
                project_name: currentProjectName,
                task_id: comment.taskId,
                display_id: currentTaskDisplayId,
                comment_id: comment.commentId,
            },
            () => {
                emitTaskTouched(Number(comment.taskId), "comment");
            }
        );
        setErrorMessage(null);
        setOpen(false);
    };

    return (
        <Modal
            open={open}
            sx={{
                zIndex: hostZIndex != null ? hostZIndex + 2 : 10010,
                backdropFilter: "blur(4px)",
                // Transparent: Joy's own Backdrop slot already paints
                // `palette.background.backdrop` + blur(8px). Stacking a
                // second 50% black on the modal root composited to ~75%,
                // which read as a solid black page. Matches ModalUserProfile.
                backgroundColor: "transparent",
            }}
            onClose={() => setOpen(false)}
            // The dialog portals to <body>, but React synthetic events
            // still bubble through the COMPONENT tree — i.e. into the
            // hosting `TaskCommentBubble`, whose click navigates to the
            // comment deep link and whose double-click opens the todo
            // composer. Fence both so interacting with the dialog (or
            // its backdrop) never triggers the bubble underneath.
            onClick={(e) => e.stopPropagation()}
            onDoubleClick={(e) => e.stopPropagation()}
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
                    minWidth: { xs: 0, md: "320px" },
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
                    {t.tasks.modals.deleteComment.title}
                </Typography>

                {/* Description */}
                <Typography
                    level="body-sm"
                    sx={{
                        color: "rgba(255, 255, 255, 0.5)",
                        mb: 2.5,
                    }}
                >
                    {t.tasks.modals.deleteComment.body}
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
                        onClick={() => setOpen(false)}
                    >
                        {t.tasks.modals.deleteComment.cancelButton}
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
                        onClick={handleDeleteComment}
                    >
                        {t.tasks.modals.deleteComment.confirmButton}
                    </Button>
                </Stack>
            </ModalDialog>
        </Modal>
    );
};
