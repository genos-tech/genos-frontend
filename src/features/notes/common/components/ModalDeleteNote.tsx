import React from "react";
import { keyframes } from "@emotion/react";
import NoteIcon from "@mui/icons-material/Note";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";
import { Alert, Box, Button, Modal, ModalDialog, Stack, Typography } from "@mui/joy";

import { useTranslation } from "../../../../i18n";

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
    open: boolean;
    /** Title of the note being deleted (shown in the confirmation). */
    noteTitle: string;
    /**
     * True when the note still has child notes. Deletion is blocked in
     * that case (same guard as the note-header delete) — Confirm is
     * disabled and the "child note(s) exist" message is shown.
     */
    hasChildren: boolean;
    onClose: () => void;
    onConfirm: () => void;
};

// Shared confirm dialog for deleting a note straight from the sidebar
// "⋯" row menu (my / task / chat), so the user doesn't have to open the
// note first. Purely presentational — the parent owns `open`/`hasChildren`
// and runs the actual delete in `onConfirm`. Visually matches the
// per-note ModalDelete*Note dialogs used by the note header.
export const ModalDeleteNote: React.FC<Props> = ({
    open,
    noteTitle,
    hasChildren,
    onClose,
    onConfirm,
}) => {
    const { t } = useTranslation();

    const handleConfirm = () => {
        if (hasChildren) return;
        onConfirm();
        onClose();
    };

    return (
        <Modal
            open={open}
            sx={{
                zIndex: 10010,
                backdropFilter: "blur(4px)",
                backgroundColor: "rgba(0, 0, 0, 0.5)",
            }}
            onClose={onClose}
        >
            <ModalDialog
                sx={{
                    animation: `${fadeIn} 0.2s ease-out`,
                    background:
                        "linear-gradient(145deg, rgba(30, 30, 40, 0.95) 0%, rgba(20, 20, 28, 0.98) 100%)",
                    border: "1px solid rgba(232,121,195,0.2)",
                    borderRadius: "16px",
                    boxShadow:
                        "0 25px 50px -12px rgba(0, 0, 0, 0.5), 0 0 40px rgba(232,121,195,0.1)",
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
                            "linear-gradient(135deg, rgba(232,121,195,0.15) 0%, rgba(192,38,168,0.15) 100%)",
                        border: "1px solid rgba(232,121,195,0.25)",
                        mx: "auto",
                        mb: 2,
                        "&:hover": {
                            animation: `${shake} 0.4s ease-in-out`,
                        },
                    }}
                >
                    <NoteIcon sx={{ color: "rgba(232,121,195,0.9)", fontSize: 28 }} />
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
                    {t.notes.deleteModal.title}
                </Typography>

                {/* Note Name */}
                <Typography
                    level="title-md"
                    sx={{
                        background: "linear-gradient(135deg, #e879c3 0%, #c026a8 100%)",
                        WebkitBackgroundClip: "text",
                        WebkitTextFillColor: "transparent",
                        fontWeight: 600,
                        mb: 0.5,
                        px: 2,
                    }}
                >
                    {noteTitle}
                </Typography>

                {/* Warning */}
                <Typography
                    level="body-sm"
                    sx={{
                        color: "rgba(255, 255, 255, 0.5)",
                        mb: 2.5,
                    }}
                >
                    {t.notes.deleteModal.warning}
                </Typography>

                {/* Child-note guard — same block the note-header delete
                    surfaces, but shown up front so Confirm can be disabled
                    instead of failing after the click. */}
                {hasChildren && (
                    <Alert
                        color="danger"
                        startDecorator={<WarningAmberIcon />}
                        sx={{
                            mb: 2,
                            borderRadius: "10px",
                            backgroundColor: "rgba(232,121,195,0.1)",
                            border: "1px solid rgba(232,121,195,0.3)",
                            textAlign: "left",
                        }}
                    >
                        {t.notes.deleteModal.childExistsError}
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
                        onClick={onClose}
                    >
                        {t.notes.deleteModal.cancel}
                    </Button>
                    <Button
                        disabled={hasChildren}
                        sx={{
                            background: "linear-gradient(135deg, #c026a8 0%, #9d2386 100%)",
                            borderRadius: "10px",
                            px: 3,
                            fontWeight: 600,
                            boxShadow: "0 4px 15px rgba(232,121,195,0.3)",
                            transition: "all 0.2s ease",
                            "&:hover": {
                                transform: "translateY(-1px)",
                                boxShadow: "0 6px 20px rgba(232,121,195,0.4)",
                            },
                        }}
                        onClick={handleConfirm}
                    >
                        {t.notes.deleteModal.confirm}
                    </Button>
                </Stack>
            </ModalDialog>
        </Modal>
    );
};
