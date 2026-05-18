import { useState } from "react";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";

import { fmt, useTranslation } from "../../../../i18n";
import {
    Alert,
    Button,
    DialogActions,
    DialogContent,
    DialogTitle,
    Divider,
    Modal,
    ModalDialog,
    Stack,
    Typography,
} from "@mui/joy";

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
    const [busy, setBusy] = useState(false);
    const { t } = useTranslation();

    return (
        <Modal open={open} onClose={() => !busy && onClose()}>
            <ModalDialog sx={{ minWidth: 420 }}>
                <DialogTitle>{t.tasks.deleteSprint.title}</DialogTitle>
                <Divider />
                <DialogContent>
                    <Stack spacing={1.5} sx={{ pt: 1 }}>
                        <Typography level="body-sm">
                            <b>{sprintName}</b>
                            {t.tasks.deleteSprint.bodyPrefix}
                        </Typography>
                        {milestoneCount > 0 && (
                            <Alert color="warning" startDecorator={<WarningAmberIcon />}>
                                {fmt(t.tasks.deleteSprint.milestoneMove, {
                                    count: milestoneCount,
                                })}
                            </Alert>
                        )}
                    </Stack>
                </DialogContent>
                <DialogActions>
                    <Button variant="plain" color="neutral" onClick={onClose} disabled={busy}>
                        {t.tasks.deleteSprint.cancelButton}
                    </Button>
                    <Button
                        color="danger"
                        loading={busy}
                        onClick={async () => {
                            setBusy(true);
                            try {
                                await onConfirm();
                            } finally {
                                setBusy(false);
                            }
                        }}
                    >
                        {t.tasks.deleteSprint.deleteButton}
                    </Button>
                </DialogActions>
            </ModalDialog>
        </Modal>
    );
};
