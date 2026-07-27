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
                    border: "1px solid rgba(var(--gp-tint-danger-rgb), 0.2)",
                    borderRadius: "16px",
                    boxShadow:
                        "0 25px 50px -12px rgba(0, 0, 0, 0.5), 0 0 40px rgba(var(--gp-tint-danger-rgb), 0.1)",
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
                            "linear-gradient(135deg, rgba(var(--gp-tint-danger-rgb), 0.15) 0%, rgba(var(--gp-tint-danger-alt-rgb), 0.15) 100%)",
                        border: "1px solid rgba(var(--gp-tint-danger-rgb), 0.25)",
                        mx: "auto",
                        mb: 2,
                        "&:hover": {
                            animation: `${shake} 0.4s ease-in-out`,
                        },
                    }}
                >
                    <FolderDeleteIcon
                        sx={{ color: "rgba(var(--gp-tint-danger-rgb), 0.9)", fontSize: 28 }}
                    />
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
                        background:
                            "linear-gradient(135deg, var(--gp-tint-danger) 0%, var(--gp-tint-danger-alt) 100%)",
                        WebkitBackgroundClip: "text",
                        WebkitTextFillColor: "transparent",
                        fontWeight: 700,
                        mb: 0.5,
                    }}
                >
                    {openDeleteProject.projectName}
                </Typography>

                {/* Kept as the lead line: it's already translated into every
                    locale, and it frames the list below. */}
                <Typography
                    level="body-sm"
                    sx={{
                        color: "rgba(255, 255, 255, 0.5)",
                        mb: 1.5,
                    }}
                >
                    {t.tasks.modals.deleteProject.body}
                </Typography>

                {/* What deleting actually destroys.
                    Spelled out rather than left at "this cannot be undone",
                    because the scope is not guessable: a project takes its
                    tasks, comments, attachments and notes with it, and none of
                    it is recoverable. Every line is verified against the API's
                    delete-scope tests. */}
                <Box
                    sx={{
                        textAlign: "left",
                        mb: 2.5,
                        p: 1.5,
                        borderRadius: "10px",
                        background: "rgba(var(--gp-tint-danger-rgb), 0.06)",
                        border: "1px solid rgba(var(--gp-tint-danger-rgb), 0.2)",
                    }}
                >
                    <Typography
                        level="body-sm"
                        startDecorator={
                            <WarningAmberIcon
                                sx={{
                                    fontSize: 16,
                                    color: "rgba(var(--gp-tint-danger-rgb), 0.9)",
                                }}
                            />
                        }
                        sx={{
                            color: "rgba(var(--gp-tint-danger-rgb), 0.9)",
                            fontWeight: 600,
                            mb: 1,
                        }}
                    >
                        {t.tasks.modals.deleteProject.destroyedTitle}
                    </Typography>

                    <Box
                        component="ul"
                        sx={{
                            listStyle: "disc",
                            pl: 2.5,
                            m: 0,
                            "& li": {
                                color: "rgba(255,255,255,0.75)",
                                fontSize: "0.8rem",
                                lineHeight: 1.7,
                            },
                        }}
                    >
                        <li>{t.tasks.modals.deleteProject.destroyedMilestones}</li>
                        <li>{t.tasks.modals.deleteProject.destroyedTasks}</li>
                        <li>{t.tasks.modals.deleteProject.destroyedSprints}</li>
                        <li>{t.tasks.modals.deleteProject.destroyedMembersTags}</li>
                    </Box>

                    <Typography
                        level="body-xs"
                        sx={{
                            color: "rgba(255,255,255,0.45)",
                            mt: 1.25,
                            pt: 1.25,
                            borderTop: "1px solid rgba(255,255,255,0.08)",
                        }}
                    >
                        {t.tasks.modals.deleteProject.chatNote}
                    </Typography>
                </Box>

                {/* Error Alert */}
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
                        onClick={handleDeleteProject}
                    >
                        {t.tasks.modals.deleteProject.confirmButton}
                    </Button>
                </Stack>
            </ModalDialog>
        </Modal>
    );
};
