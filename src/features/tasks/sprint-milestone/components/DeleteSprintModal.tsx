import WarningAmberIcon from "@mui/icons-material/WarningAmber";
import { Alert } from "@mui/joy";

import { ConfirmDialog } from "../../../../components/ui/modal/ConfirmDialog";
import { fmt, useTranslation } from "../../../../i18n";

type Props = {
    open: boolean;
    sprintName: string;
    milestoneCount: number;
    onConfirm: () => Promise<void> | void;
    onClose: () => void;
};

export const DeleteSprintModal = ({
    open,
    sprintName,
    milestoneCount,
    onConfirm,
    onClose,
}: Props) => {
    const { t } = useTranslation();

    return (
        <ConfirmDialog
            cancelLabel={t.tasks.deleteSprint.cancelButton}
            confirmLabel={t.tasks.deleteSprint.deleteButton}
            open={open}
            size="md"
            title={t.tasks.deleteSprint.title}
            description={
                <>
                    <b>{sprintName}</b>
                    {t.tasks.deleteSprint.bodyPrefix}
                </>
            }
            destructive
            onClose={onClose}
            onConfirm={onConfirm}
        >
            {milestoneCount > 0 && (
                <Alert color="warning" size="sm" startDecorator={<WarningAmberIcon />}>
                    {fmt(t.tasks.deleteSprint.milestoneMove, { count: milestoneCount })}
                </Alert>
            )}
        </ConfirmDialog>
    );
};
