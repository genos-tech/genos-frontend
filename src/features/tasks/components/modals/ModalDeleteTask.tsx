import React from "react";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";

import { ConfirmDialog } from "../../../../components/ui/modal/ConfirmDialog";
import { useTranslation } from "../../../../i18n";
import { g } from "../../../../theme/tokens";
import { TaskProps } from "../../../../types/tasks";

type Props = {
    openDeleteTask: boolean;
    setOpenDeleteTask: (value: boolean) => void;
    currentTaskContent: TaskProps;
    setCurrentTaskContent?: (value: TaskProps) => void;
    setTaskUpdated?: (value: boolean) => void;
    setTaskStatusUpdated?: (value: boolean) => void;
    /** The layer of the modal this task is shown in (UrlLinkModal), so the
     *  confirm opens above it instead of behind it. Page-hosted: omit. */
    hostZIndex?: number;
};

export const ModalDeleteTask: React.FC<Props> = ({
    openDeleteTask,
    setOpenDeleteTask,
    currentTaskContent,
    setCurrentTaskContent,
    setTaskUpdated,
    setTaskStatusUpdated,
    hostZIndex,
}) => {
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
        <ConfirmDialog
            cancelLabel={t.tasks.modals.deleteTask.cancelButton}
            confirmLabel={t.tasks.modals.deleteTask.confirmButton}
            description={t.tasks.modals.deleteTask.body}
            entityName={currentTaskContent.title}
            hostZIndex={hostZIndex}
            icon={<DeleteOutlineIcon sx={{ color: g.danger.text }} />}
            open={openDeleteTask}
            title={t.tasks.modals.deleteTask.title}
            destructive
            onClose={() => setOpenDeleteTask(false)}
            onConfirm={handleDeleteTask}
        />
    );
};
