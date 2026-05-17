import { useState } from "react";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";
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

    return (
        <Modal open={open} onClose={() => !busy && onClose()}>
            <ModalDialog sx={{ minWidth: 420 }}>
                <DialogTitle>Delete sprint?</DialogTitle>
                <Divider />
                <DialogContent>
                    <Stack spacing={1.5} sx={{ pt: 1 }}>
                        <Typography level="body-sm">
                            <b>{sprintName}</b> will be permanently removed.
                        </Typography>
                        {milestoneCount > 0 && (
                            <Alert color="warning" startDecorator={<WarningAmberIcon />}>
                                {milestoneCount} milestone
                                {milestoneCount === 1 ? "" : "s"} will be moved to Backlog (No
                                sprint).
                            </Alert>
                        )}
                    </Stack>
                </DialogContent>
                <DialogActions>
                    <Button variant="plain" color="neutral" onClick={onClose} disabled={busy}>
                        Cancel
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
                        Delete
                    </Button>
                </DialogActions>
            </ModalDialog>
        </Modal>
    );
};
