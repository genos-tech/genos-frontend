import React from "react";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";

import { ConfirmDialog } from "../../../../components/ui/modal/ConfirmDialog";
import { useTranslation } from "../../../../i18n";
import { g } from "../../../../theme/tokens";

/**
 * Picking "Deleted" in a status picker removes the task from every list, board
 * and dashboard in one click (MIP-1301). The "Delete Task" menu item asks first
 * (`ModalDeleteTask`); the pickers used to be a way around that question. The
 * rule for when to ask is `isDeletingStatus` (`utils/deletedStatus`).
 */

type Props = {
    /** Mount the dialog only while a choice is pending (a table row renders one per task). */
    open: boolean;
    /** The task's (or milestone's) title, set apart under the question. */
    entityName?: string;
    /** A milestone says "milestone", never "task". */
    isMilestone?: boolean;
    /** The layer of the modal this picker lives in, so the confirm opens above it. */
    hostZIndex?: number;
    onConfirm: () => void;
    onClose: () => void;
};

export const ConfirmDeletedStatus: React.FC<Props> = ({
    open,
    entityName,
    isMilestone = false,
    hostZIndex,
    onConfirm,
    onClose,
}) => {
    const { t } = useTranslation();
    const c = t.tasks.modals.confirmDeletedStatus;
    return (
        <ConfirmDialog
            cancelLabel={t.common.actions.cancel}
            confirmLabel={t.common.actions.delete}
            description={isMilestone ? c.bodyMilestone : c.body}
            entityName={entityName}
            hostZIndex={hostZIndex}
            icon={<DeleteOutlineIcon sx={{ color: g.danger.text }} />}
            open={open}
            title={isMilestone ? c.titleMilestone : c.title}
            destructive
            onClose={onClose}
            onConfirm={() => {
                onConfirm();
                onClose();
            }}
        />
    );
};
