import React, { useState } from "react";
import FolderDeleteIcon from "@mui/icons-material/FolderDelete";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";
import { Box, Typography } from "@mui/joy";
import axios from "axios";

import { ConfirmDialog } from "../../../../components/ui/modal/ConfirmDialog";
import { useAuth } from "../../../../context/AuthContext";
import { ProjectManagementState } from "../../../../hooks/common/useProjectManagement";
import { useTranslation } from "../../../../i18n";
import { authApi } from "../../../../services/api";
import { g, type } from "../../../../theme/tokens";
import { UserProps } from "../../../../types/admin";
import { errorMessageFrom } from "../../../../utils/errorMessage";

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

    const handleDeleteProject = () => deleteProject();
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
                    setErrorMessage(
                        errorMessageFrom(
                            res.data?.message,
                            t.tasks.modals.deleteProject.unexpectedError
                        )
                    );
                }
            } else {
                console.error("Unauthorized. Auth toke is not found.");
            }
        } catch (error: unknown) {
            if (axios.isAxiosError(error)) {
                setErrorMessage(
                    errorMessageFrom(
                        error.response?.data,
                        t.tasks.modals.deleteProject.unexpectedError
                    )
                );
                console.error("API error:", error.response?.status, error.response?.data);
            } else {
                setErrorMessage(t.tasks.modals.deleteProject.unexpectedError);
                console.error("Unexpected error:", error);
            }
        }
    }

    const close = () => {
        setOpenDeleteProject(disableOpenDeleteModalParams);
        setErrorMessage(null);
    };

    // `body` stays the lead line: it's already translated into every locale,
    // and it frames the list below.
    return (
        <ConfirmDialog
            cancelLabel={t.tasks.modals.deleteProject.cancelButton}
            confirmLabel={t.tasks.modals.deleteProject.confirmButton}
            description={t.tasks.modals.deleteProject.body}
            entityName={openDeleteProject.projectName}
            error={errorMessage}
            icon={<FolderDeleteIcon sx={{ color: g.danger.text }} />}
            open={openDeleteProject.flag}
            size="md"
            title={t.tasks.modals.deleteProject.heading}
            destructive
            onClose={close}
            onConfirm={handleDeleteProject}
        >
            {/* What deleting actually destroys.
                Spelled out rather than left at "this cannot be undone",
                because the scope is not guessable: a project takes its
                tasks, comments, attachments and notes with it, and none of
                it is recoverable. Every line is verified against the API's
                delete-scope tests. */}
            <Box
                sx={{
                    p: 1.5,
                    borderRadius: g.radius.md,
                    background: g.danger.subtle,
                    border: `1px solid ${g.danger.border}`,
                }}
            >
                <Typography
                    level="body-sm"
                    startDecorator={<WarningAmberIcon sx={{ fontSize: 16 }} />}
                    sx={{ color: g.danger.text, fontWeight: 600, mb: 1 }}
                >
                    {t.tasks.modals.deleteProject.destroyedTitle}
                </Typography>

                <Box
                    component="ul"
                    sx={{
                        listStyle: "disc",
                        pl: 2.5,
                        m: 0,
                        "& li": { ...type("body-sm"), color: g.text.secondary, lineHeight: 1.7 },
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
                        color: g.text.tertiary,
                        mt: 1.25,
                        pt: 1.25,
                        borderTop: `1px solid ${g.border.subtle}`,
                    }}
                >
                    {t.tasks.modals.deleteProject.chatNote}
                </Typography>
            </Box>
        </ConfirmDialog>
    );
};
