import React, { useState } from "react";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import { Socket } from "socket.io-client";

import { ConfirmDialog } from "../../../../components/ui/modal/ConfirmDialog";
import { useTranslation } from "../../../../i18n";
import { g } from "../../../../theme/tokens";
import { TaskCommentProps } from "../../../../types/tasks";
import { emitTaskTouched } from "../../services/taskEvents";

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
     * z 10020+), so the dialog lifts to host+2 (`ModalFrame`'s
     * `hostZIndex`, the same convention as the other dialogs).
     * Absent ⇒ page-hosted; the 10010 default applies. Hardcoding 10010
     * would repeat the known bug where sibling dialogs open invisibly
     * BEHIND the preview modal. */
    hostZIndex?: number;
};

/**
 * Confirm-then-delete dialog for a task comment, on the shared
 * `ConfirmDialog` (MIP-1125).
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

    // The dialog portals to <body>, but React synthetic events still bubble
    // through the COMPONENT tree, i.e. into the hosting `TaskCommentBubble`,
    // whose click navigates to the comment deep link and whose double-click
    // opens the todo composer. `ModalFrame` fences click, double-click and
    // key events at its root, so the dialog (or its backdrop) never triggers
    // the bubble underneath.
    return (
        <ConfirmDialog
            cancelLabel={t.tasks.modals.deleteComment.cancelButton}
            confirmLabel={t.tasks.modals.deleteComment.confirmButton}
            description={t.tasks.modals.deleteComment.body}
            error={errorMessage}
            hostZIndex={hostZIndex}
            icon={<DeleteOutlineIcon sx={{ color: g.danger.text }} />}
            open={open}
            title={t.tasks.modals.deleteComment.title}
            destructive
            onClose={() => setOpen(false)}
            onConfirm={handleDeleteComment}
        />
    );
};
