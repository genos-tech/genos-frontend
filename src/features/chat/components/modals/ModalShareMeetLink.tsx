import { keyframes } from "@emotion/react";
import VideoCameraFrontRoundedIcon from "@mui/icons-material/VideoCameraFrontRounded";
import { Box, Button, Modal, ModalDialog, Stack, Typography } from "@mui/joy";

import { useTranslation } from "../../../../i18n";

const fadeIn = keyframes`
    from { opacity: 0; transform: scale(0.95) translateY(-10px); }
    to { opacity: 1; transform: scale(1) translateY(0); }
`;

type Props = {
    open: boolean;
    link: string | null;
    onShare: () => void;
    onCancel: () => void;
};

export const ModalShareMeetLink = ({ open, link, onShare, onCancel }: Props) => {
    const { t } = useTranslation();

    return (
        <Modal
            open={open}
            sx={{
                zIndex: 10010,
                backdropFilter: "blur(4px)",
                // Transparent: Joy's own Backdrop slot already paints
                // `palette.background.backdrop` + blur(8px). Stacking a
                // second 50% black on the modal root composited to ~75%,
                // which read as a solid black page. Matches ModalUserProfile.
                backgroundColor: "transparent",
            }}
            onClose={onCancel}
        >
            <ModalDialog
                sx={{
                    animation: `${fadeIn} 0.2s ease-out`,
                    background:
                        "linear-gradient(145deg, rgba(30, 30, 40, 0.95) 0%, rgba(20, 20, 28, 0.98) 100%)",
                    border: "1px solid rgba(var(--gp-tint-danger-rgb), 0.2)",
                    borderRadius: "16px",
                    boxShadow:
                        "0 25px 50px -12px rgba(0, 0, 0, 0.5), 0 0 40px rgba(var(--gp-tint-danger-rgb), 0.1)",
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
                            "linear-gradient(135deg, rgba(var(--gp-tint-danger-rgb), 0.15) 0%, rgba(var(--gp-tint-danger-alt-rgb), 0.15) 100%)",
                        border: "1px solid rgba(var(--gp-tint-danger-rgb), 0.25)",
                        mx: "auto",
                        mb: 2,
                    }}
                >
                    <VideoCameraFrontRoundedIcon
                        sx={{ color: "rgba(var(--gp-tint-danger-rgb), 0.9)", fontSize: 28 }}
                    />
                </Box>

                <Typography
                    level="h4"
                    sx={{
                        color: "rgba(255, 255, 255, 0.9)",
                        fontWeight: 600,
                        mb: 1,
                    }}
                >
                    {t.chat.modals.shareMeetLink.title}
                </Typography>

                <Typography
                    level="body-sm"
                    sx={{
                        color: "rgba(255, 255, 255, 0.5)",
                        mb: 2,
                    }}
                >
                    {t.chat.modals.shareMeetLink.description}
                </Typography>

                {link && (
                    <Box
                        sx={{
                            borderRadius: "10px",
                            border: "1px solid rgba(var(--gp-tint-danger-rgb), 0.25)",
                            background: "rgba(var(--gp-tint-danger-rgb), 0.05)",
                            p: 1.25,
                            mb: 2.5,
                            wordBreak: "break-all",
                        }}
                    >
                        <Typography
                            level="body-sm"
                            sx={{
                                color: "rgba(255, 255, 255, 0.8)",
                                fontFamily:
                                    "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
                            }}
                        >
                            {link}
                        </Typography>
                    </Box>
                )}

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
                        onClick={onCancel}
                    >
                        {t.chat.modals.shareMeetLink.cancel}
                    </Button>
                    <Button
                        sx={{
                            background:
                                "linear-gradient(135deg, var(--gp-tint-danger-alt) 0%, var(--gp-tint-danger-deep) 100%)",
                            borderRadius: "10px",
                            px: 3,
                            fontWeight: 600,
                            boxShadow: "0 4px 15px rgba(var(--gp-tint-danger-rgb), 0.3)",
                            transition: "all 0.2s ease",
                            "&:hover": {
                                transform: "translateY(-1px)",
                                boxShadow: "0 6px 20px rgba(var(--gp-tint-danger-rgb), 0.4)",
                            },
                        }}
                        onClick={onShare}
                    >
                        {t.chat.modals.shareMeetLink.share}
                    </Button>
                </Stack>
            </ModalDialog>
        </Modal>
    );
};
