import React, { useState } from "react";
import { keyframes } from "@emotion/react";
import FolderDeleteIcon from "@mui/icons-material/FolderDelete";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";
import { Alert, Box, Button, Modal, ModalDialog, Stack, Typography } from "@mui/joy";
import axios from "axios";

import { useAuth } from "../../../../context/AuthContext";
import { ProjectManagementState } from "../../../../hooks/common/useProjectManagement";
import { useTranslation } from "../../../../i18n";
import { authApi } from "../../../../services/api";
import { UserProps } from "../../../../types/admin";

const fadeIn = keyframes`
    from { opacity: 0; transform: scale(0.95) translateY(-10px); }
    to { opacity: 1; transform: scale(1) translateY(0); }
`;

const shake = keyframes`
    0%, 100% { transform: rotate(0deg); }
    25% { transform: rotate(-5deg); }
    75% { transform: rotate(5deg); }
`;

const disableOpenDeleteModalParams = {
    flag: false,
    projectId: -1,
    projectName: "",
};

type Props = {
    myself: UserProps;
    openDeleteProject: { flag: boolean; projectId: number; projectName: string };
    setOpenDeleteProject: (value: {
        flag: boolean;
        projectId: number;
        projectName: string;
    }) => void;
    usePM: ProjectManagementState;
};

export const ModalDeleteProject: React.FC<Props> = ({
    myself,
    openDeleteProject,
    setOpenDeleteProject,
    usePM,
}) => {
    const { accessToken } = useAuth();
    const { t } = useTranslation();

    const [errorMessage, setErrorMessage] = useState<string | null>(null);

    const handleDeleteProject = () => {
        deleteProject();
    };
    async function deleteProject(): Promise<void> {
        try {
            const api = authApi(accessToken);
            if (api) {
                const query: string = `team_id=${myself.teamId}&project_id=${openDeleteProject.projectId}`;
                const res = await api.delete(`/project/?${query}`);
                if (res.status === 204) {
                    usePM.setCurrentProject(null);
                    setOpenDeleteProject(disableOpenDeleteModalParams);
                    usePM.setTeamProjects(
                        usePM.teamProjects.filter(
                            (project) => project.projectId !== openDeleteProject.projectId
                        )
                    );
                } else if (res.status === 200) {
                    setErrorMessage(res.data.message);
                }
            } else {
                console.error("Unauthorized. Auth toke is not found.");
            }
        } catch (error: unknown) {
            if (axios.isAxiosError(error)) {
                setErrorMessage(error.response?.data);
                console.error("API error:", error.response?.status, error.response?.data);
            } else {
                setErrorMessage(t.tasks.modals.deleteProject.unexpectedError);
                console.error("Unexpected error:", error);
            }
        }
    }

    return (
        <Modal
            open={openDeleteProject.flag}
            sx={{
                zIndex: 10010,
                backdropFilter: "blur(4px)",
                // Transparent: Joy's own Backdrop slot already paints
                // `palette.background.backdrop` + blur(8px). Stacking a
                // second 50% black on the modal root composited to ~75%,
                // which read as a solid black page. Matches ModalUserProfile.
                backgroundColor: "transparent",
            }}
            onClose={() => setOpenDeleteProject(disableOpenDeleteModalParams)}
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
                    <FolderDeleteIcon sx={{ color: "rgba(232,121,195,0.9)", fontSize: 28 }} />
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
                    {t.tasks.modals.deleteProject.heading}
                </Typography>

                {/* Project Name */}
                <Typography
                    level="h3"
                    sx={{
                        background: "linear-gradient(135deg, #e879c3 0%, #c026a8 100%)",
                        WebkitBackgroundClip: "text",
                        WebkitTextFillColor: "transparent",
                        fontWeight: 700,
                        mb: 0.5,
                    }}
                >
                    {openDeleteProject.projectName}
                </Typography>

                {/* Warning */}
                <Typography
                    level="body-sm"
                    sx={{
                        color: "rgba(255, 255, 255, 0.5)",
                        mb: 2.5,
                    }}
                >
                    {t.tasks.modals.deleteProject.body}
                </Typography>

                {/* Error Alert */}
                {errorMessage && (
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
                        {errorMessage}
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
                        onClick={() => setOpenDeleteProject(disableOpenDeleteModalParams)}
                    >
                        {t.tasks.modals.deleteProject.cancelButton}
                    </Button>
                    <Button
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
                        onClick={handleDeleteProject}
                    >
                        {t.tasks.modals.deleteProject.confirmButton}
                    </Button>
                </Stack>
            </ModalDialog>
        </Modal>
    );
};
