import { useState } from "react";
import { keyframes } from "@emotion/react";
import LogoutRoundedIcon from "@mui/icons-material/LogoutRounded";
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
    entityName: string;
    /** Called when the user clicks Leave. Should return `true` on success
     *  so the modal can close cleanly; `false` (or thrown) leaves the
     *  error message displayed. */
    onConfirm: () => Promise<boolean>;
    onCancel: () => void;
};

export const ModalLeaveConfirm = ({
    open,
    title,
    description,
    entityName,
    onConfirm,
    onCancel,
}: Props) => {
    const { t } = useTranslation();
    const [submitting, setSubmitting] = useState(false);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);

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
            if (!ok) {
                setErrorMessage(t.common.leaveConfirm.genericError);
            }
        } catch (err) {
            setErrorMessage(
                err instanceof Error ? err.message : t.common.leaveConfirm.genericError
            );
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <Modal
            open={open}
            sx={{
                zIndex: 10010,
                backdropFilter: "blur(4px)",
                backgroundColor: "rgba(0, 0, 0, 0.5)",
            }}
            onClose={handleClose}
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
                    minWidth: { xs: 0, md: "380px" },
                    maxWidth: "100vw",
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
                        background:
                            "linear-gradient(135deg, rgba(232,121,195,0.15) 0%, rgba(192,38,168,0.15) 100%)",
                        border: "1px solid rgba(232,121,195,0.25)",
                        mx: "auto",
                        mb: 2,
                    }}
                >
                    <LogoutRoundedIcon sx={{ color: "rgba(232,121,195,0.9)", fontSize: 28 }} />
                </Box>

                <Typography
                    level="h4"
                    sx={{ color: "rgba(255, 255, 255, 0.9)", fontWeight: 600, mb: 1 }}
                >
                    {title}
                </Typography>

                <Typography level="body-sm" sx={{ color: "rgba(255, 255, 255, 0.6)", mb: 1 }}>
                    {description}
                </Typography>

                <Typography
                    level="body-md"
                    sx={{ color: "rgba(255, 255, 255, 0.9)", fontWeight: 600, mb: 2.5 }}
                >
                    {entityName}
                </Typography>

                {errorMessage && (
                    <Alert
                        color="danger"
                        startDecorator={<WarningAmberIcon />}
                        sx={{
                            mb: 2,
                            borderRadius: "10px",
                            backgroundColor: "rgba(232,121,195,0.1)",
                            border: "1px solid rgba(232,121,195,0.3)",
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
                        {t.common.leaveConfirm.cancel}
                    </Button>
                    <Button
                        loading={submitting}
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
                        {t.common.leaveConfirm.leave}
                    </Button>
                </Stack>
            </ModalDialog>
        </Modal>
    );
};
