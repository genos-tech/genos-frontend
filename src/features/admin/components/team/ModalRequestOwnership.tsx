/**
 * Confirm step for filing an ownership claim.
 *
 * The button that opens this sits in the team profile's action row next
 * to Invite members, where it is one word with no context. This modal is
 * where the two things that make the action reasonable get said: the
 * current owner is notified immediately, and nothing happens for
 * `responseDays` days. Without that, "Request ownership" reads either
 * as instant escalation or as a support ticket, and it is neither.
 *
 * Shaped after ModalLeaveConfirm, but warning-toned rather than danger:
 * this asks someone for something, it doesn't destroy anything.
 */
import { useState } from "react";
import { keyframes } from "@emotion/react";
import ShieldRoundedIcon from "@mui/icons-material/ShieldRounded";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";
import { Alert, Box, Button, Modal, ModalDialog, Stack, Typography } from "@mui/joy";

import { fmt, useTranslation } from "../../../../i18n";

const fadeIn = keyframes`
    from { opacity: 0; transform: scale(0.95) translateY(-10px); }
    to { opacity: 1; transform: scale(1) translateY(0); }
`;

type Props = {
    open: boolean;
    teamName: string;
    /** How long the owner has to answer, from the server. */
    responseDays: number;
    /** Resolves true when the claim was filed, which closes the modal. */
    onConfirm: () => Promise<boolean>;
    onCancel: () => void;
};

export const ModalRequestOwnership = ({
    open,
    teamName,
    responseDays,
    onConfirm,
    onCancel,
}: Props) => {
    const { t } = useTranslation();
    const [submitting, setSubmitting] = useState(false);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const strings = t.common.profileEdit;

    const handleClose = () => {
        if (submitting) return;
        setErrorMessage(null);
        onCancel();
    };

    const handleConfirm = async () => {
        if (submitting) return;
        setSubmitting(true);
        setErrorMessage(null);
        try {
            const ok = await onConfirm();
            if (ok) {
                handleCloseAfterSuccess();
            } else {
                setErrorMessage(strings.claimError);
            }
        } catch (err) {
            setErrorMessage(err instanceof Error ? err.message : strings.claimError);
        } finally {
            setSubmitting(false);
        }
    };

    const handleCloseAfterSuccess = () => {
        setErrorMessage(null);
        onCancel();
    };

    return (
        <Modal
            open={open}
            sx={{
                zIndex: 10010,
                backdropFilter: "blur(4px)",
                // Transparent: Joy's Backdrop slot already paints one.
                // Stacking a second reads as a solid black page.
                backgroundColor: "transparent",
            }}
            onClose={handleClose}
        >
            <ModalDialog
                sx={{
                    animation: `${fadeIn} 0.2s ease-out`,
                    background:
                        "linear-gradient(145deg, rgba(30, 30, 40, 0.95) 0%, rgba(20, 20, 28, 0.98) 100%)",
                    border: "1px solid rgba(var(--gp-tint-warning-rgb, 250, 204, 21), 0.2)",
                    borderRadius: "16px",
                    boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.5)",
                    width: { xs: "calc(100vw - 24px)", md: "auto" },
                    minWidth: { xs: 0, md: "420px" },
                    maxWidth: { xs: "100vw", md: "480px" },
                    p: { xs: 2, md: 3 },
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
                        borderRadius: "14px",
                        background: "rgba(var(--gp-tint-warning-rgb, 250, 204, 21), 0.15)",
                        border: "1px solid rgba(var(--gp-tint-warning-rgb, 250, 204, 21), 0.25)",
                        mx: "auto",
                        mb: 2,
                    }}
                >
                    <ShieldRoundedIcon
                        sx={{
                            color: "rgba(var(--gp-tint-warning-rgb, 250, 204, 21), 0.9)",
                            fontSize: 28,
                        }}
                    />
                </Box>

                <Typography
                    level="h4"
                    sx={{ color: "rgba(255, 255, 255, 0.9)", fontWeight: 600, mb: 1 }}
                >
                    {strings.claimConfirmTitle}
                </Typography>

                <Typography
                    level="body-md"
                    sx={{ color: "rgba(255, 255, 255, 0.9)", fontWeight: 600, mb: 2 }}
                >
                    {teamName}
                </Typography>

                <Typography
                    level="body-sm"
                    sx={{ color: "rgba(255, 255, 255, 0.6)", mb: 1.5, textAlign: "left" }}
                >
                    {strings.claimDescription}
                </Typography>

                {/* The part that stops this reading as an escalate-now
                    button: the owner hears about it immediately, and
                    nothing moves for a month. */}
                <Typography
                    level="body-sm"
                    sx={{
                        color: "rgba(255, 255, 255, 0.75)",
                        mb: 2.5,
                        textAlign: "left",
                        background: "rgba(var(--gp-tint-warning-rgb, 250, 204, 21), 0.08)",
                        border: "1px solid rgba(var(--gp-tint-warning-rgb, 250, 204, 21), 0.2)",
                        borderRadius: "10px",
                        p: 1.5,
                    }}
                >
                    {fmt(strings.claimConfirmWindow, { days: String(responseDays) })}
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
                        {t.common.actions.cancel}
                    </Button>
                    <Button
                        color="warning"
                        loading={submitting}
                        sx={{ borderRadius: "10px", px: 3, fontWeight: 600 }}
                        variant="solid"
                        onClick={handleConfirm}
                    >
                        {strings.claimConfirmSend}
                    </Button>
                </Stack>
            </ModalDialog>
        </Modal>
    );
};
