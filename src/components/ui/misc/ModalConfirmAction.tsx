import { ReactNode, useState } from "react";
import { keyframes } from "@emotion/react";
import SwapHorizRoundedIcon from "@mui/icons-material/SwapHorizRounded";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";
import { Alert, Box, Button, Modal, ModalDialog, Stack, Typography } from "@mui/joy";

import { useTranslation } from "../../../i18n";

const fadeIn = keyframes`
    from { opacity: 0; transform: scale(0.95) translateY(-10px); }
    to { opacity: 1; transform: scale(1) translateY(0); }
`;

type Props = {
    open: boolean;
    title: string;
    description: string;
    /** The thing being acted on (a task's title, say), shown under the title. */
    entityName?: string;
    confirmLabel: string;
    cancelLabel: string;
    /** Defaults to the swap arrows, which suit "turn this into that". */
    icon?: ReactNode;
    /**
     * Stacking layer. 10010 is where the other confirmation dialogs sit,
     * which is BELOW a modal-hosted preview (10020 and up), so a preview
     * that opens this passes a layer above its own.
     */
    zIndex?: number;
    /**
     * Runs on Confirm. The dialog closes once it resolves; if it throws, the
     * dialog stays open and shows the error, so the person can retry or cancel.
     */
    onConfirm: () => Promise<unknown> | unknown;
    onClose: () => void;
};

/**
 * Confirm a non-destructive action in the app's own dialog (MIP-1042 follow-up).
 *
 * The same card as ModalLeaveConfirm and ModalDeleteTask (dark gradient, icon
 * tile, title, text, Cancel / primary), in the brand colours that Join and
 * Create project use because nothing here is lost. The browser's `confirm()`
 * it replaces looked like neither.
 */
export const ModalConfirmAction = ({
    open,
    title,
    description,
    entityName,
    confirmLabel,
    cancelLabel,
    icon,
    zIndex = 10010,
    onConfirm,
    onClose,
}: Props) => {
    const { t } = useTranslation();
    const [submitting, setSubmitting] = useState(false);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);

    // Nothing dismisses it while the action runs: a closed dialog would hide
    // the result of something already under way.
    const handleClose = () => {
        if (submitting) return;
        setErrorMessage(null);
        onClose();
    };

    const handleConfirm = async () => {
        if (submitting) return;
        setSubmitting(true);
        setErrorMessage(null);
        try {
            await onConfirm();
            setSubmitting(false);
            onClose();
        } catch (err) {
            setSubmitting(false);
            setErrorMessage(
                err instanceof Error && err.message ? err.message : t.common.errors.generic
            );
        }
    };

    return (
        <Modal
            open={open}
            sx={{
                zIndex,
                backdropFilter: "blur(4px)",
                // Transparent: Joy's own Backdrop slot already paints
                // `palette.background.backdrop` + blur(8px). Stacking a
                // second 50% black on the modal root composited to ~75%,
                // which read as a solid black page. Matches ModalUserProfile.
                backgroundColor: "transparent",
                // Joy pins the pickers a dialog opens to calc(modal + 1);
                // keep them above this layer too.
                "--unstable_popup-zIndex": zIndex + 10,
            }}
            onClose={handleClose}
        >
            <ModalDialog
                sx={{
                    animation: `${fadeIn} 0.2s ease-out`,
                    background:
                        "linear-gradient(145deg, rgba(30, 30, 40, 0.95) 0%, rgba(20, 20, 28, 0.98) 100%)",
                    border: "1px solid rgba(var(--gp-brand-500-rgb), 0.2)",
                    borderRadius: "16px",
                    boxShadow:
                        "0 25px 50px -12px rgba(0, 0, 0, 0.5), 0 0 40px rgba(var(--gp-brand-500-rgb), 0.1)",
                    width: { xs: "calc(100vw - 24px)", md: "auto" },
                    minWidth: { xs: 0, md: "380px" },
                    maxWidth: { xs: "100vw", md: "480px" },
                    maxHeight: { xs: "calc(100dvh - 32px)", md: "85vh" },
                    p: { xs: 2, md: 3 },
                    overflow: "auto",
                    textAlign: "center",
                }}
            >
                <Box
                    sx={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        width: 56,
                        height: 56,
                        flexShrink: 0,
                        borderRadius: "14px",
                        background:
                            "linear-gradient(135deg, rgba(var(--gp-brand-500-rgb), 0.15) 0%, rgba(var(--gp-brandalt-500-rgb), 0.15) 100%)",
                        border: "1px solid rgba(var(--gp-brand-500-rgb), 0.25)",
                        mx: "auto",
                        mb: 2,
                    }}
                >
                    {icon ?? (
                        <SwapHorizRoundedIcon
                            sx={{ color: "rgba(var(--gp-brand-500-rgb), 0.9)", fontSize: 28 }}
                        />
                    )}
                </Box>

                <Typography
                    level="h4"
                    sx={{ color: "rgba(255, 255, 255, 0.9)", fontWeight: 600, mb: 1 }}
                >
                    {title}
                </Typography>

                {entityName && (
                    <Typography
                        level="title-md"
                        sx={{
                            background:
                                "linear-gradient(135deg, var(--gp-brand-500) 0%, var(--gp-brandalt-500) 100%)",
                            WebkitBackgroundClip: "text",
                            WebkitTextFillColor: "transparent",
                            fontWeight: 600,
                            mb: 1,
                            px: 2,
                            // A long title wraps inside the card instead of widening it.
                            overflowWrap: "anywhere",
                        }}
                    >
                        {entityName}
                    </Typography>
                )}

                <Typography
                    level="body-sm"
                    sx={{ color: "rgba(255, 255, 255, 0.6)", mb: 2.5, textAlign: "center" }}
                >
                    {description}
                </Typography>

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

                <Stack direction="row" spacing={1.5} sx={{ justifyContent: "center" }}>
                    <Button
                        disabled={submitting}
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
                        onClick={handleClose}
                    >
                        {cancelLabel}
                    </Button>
                    <Button
                        loading={submitting}
                        sx={{
                            background:
                                "linear-gradient(135deg, var(--gp-brand-500) 0%, var(--gp-brandalt-500) 100%)",
                            borderRadius: "10px",
                            px: 3,
                            fontWeight: 600,
                            boxShadow: "0 4px 15px rgba(var(--gp-brand-500-rgb), 0.3)",
                            transition: "all 0.2s ease",
                            "&:hover": {
                                transform: "translateY(-1px)",
                                boxShadow: "0 6px 20px rgba(var(--gp-brand-500-rgb), 0.4)",
                            },
                        }}
                        onClick={handleConfirm}
                    >
                        {confirmLabel}
                    </Button>
                </Stack>
            </ModalDialog>
        </Modal>
    );
};
