import { ReactNode, useId } from "react";
import { Alert, Button, Modal, ModalDialog, Stack, Typography } from "@mui/joy";

// Above the Genos settings dialog. `SpotlightSettingsModal` pins itself at
// 13200 so it can sit over the Spotlight overlay (13100), and a Joy Modal
// opened from inside it is a SIBLING portal at the default 1300, i.e. BEHIND
// it and unclickable. Tooltips are 13300, so this stays under them. In the
// main Settings modal (1300) the same value is simply "on top".
const CONFIRM_Z_INDEX = 13250;

interface Props {
    open: boolean;
    title: string;
    body: string;
    confirmLabel: string;
    cancelLabel: string;
    // True while the request is in flight: both buttons lock and the dialog
    // refuses to be dismissed, so a second click can't fire a second delete.
    busy?: boolean;
    // Shown inside the dialog, not behind it, so a failure is read next to
    // the button that caused it.
    error?: string | null;
    // For an extra gate the caller owns (the delete-all acknowledgement).
    confirmDisabled?: boolean;
    // Extra content between the body and the buttons.
    children?: ReactNode;
    onConfirm: () => void;
    onCancel: () => void;
}

/**
 * A destructive-action confirm, shared by every delete on the "What Genos
 * remembers" page. Always red: each of these removes something for good.
 */
export const ConfirmDialog = ({
    open,
    title,
    body,
    confirmLabel,
    cancelLabel,
    busy = false,
    error = null,
    confirmDisabled = false,
    children,
    onConfirm,
    onCancel,
}: Props) => {
    const titleId = useId();
    return (
        <Modal
            open={open}
            sx={{ zIndex: CONFIRM_Z_INDEX }}
            onClose={() => {
                if (!busy) onCancel();
            }}
        >
            <ModalDialog
                aria-labelledby={titleId}
                role="alertdialog"
                variant="outlined"
                sx={{
                    // `calc` rather than a bare vw: the dialog must never be
                    // wider than a phone, and 32px keeps a visible gutter.
                    width: { xs: "calc(100vw - 32px)", sm: 440 },
                    maxWidth: "calc(100vw - 32px)",
                    maxHeight: "calc(100dvh - 32px)",
                    overflowY: "auto",
                }}
            >
                <Typography id={titleId} level="title-md" sx={{ color: "danger.500" }}>
                    {title}
                </Typography>
                <Typography level="body-sm" sx={{ overflowWrap: "anywhere" }}>
                    {body}
                </Typography>
                {children}
                {error && (
                    <Alert color="danger" size="sm" sx={{ overflowWrap: "anywhere" }}>
                        {error}
                    </Alert>
                )}
                <Stack
                    direction="row"
                    spacing={1}
                    sx={{ mt: 1, justifyContent: "flex-end", flexWrap: "wrap", rowGap: 1 }}
                >
                    <Button disabled={busy} size="sm" variant="plain" onClick={onCancel}>
                        {cancelLabel}
                    </Button>
                    <Button
                        color="danger"
                        disabled={confirmDisabled}
                        loading={busy}
                        size="sm"
                        onClick={onConfirm}
                    >
                        {confirmLabel}
                    </Button>
                </Stack>
            </ModalDialog>
        </Modal>
    );
};
