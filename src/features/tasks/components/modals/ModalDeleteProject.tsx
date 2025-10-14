import { Alert, Button, Modal, ModalDialog, Stack, Typography } from "@mui/joy";
import axios from "axios";
import React, { useState } from "react";

import { useAuth } from "../../../../context/AuthContext";
import { ProjectManagementState } from "../../../../hooks/common/useProjectManagement";
import { authApi } from "../../../../services/api";
import { UserProps } from "../../../../types/admin";
import { ProjectProps } from "../../../../types/tasks";

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
    PM: ProjectManagementState;
};

export const ModalDeleteProject: React.FC<Props> = ({
    myself,
    openDeleteProject,
    setOpenDeleteProject,
    PM,
}) => {
    const { accessToken } = useAuth();

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
                    PM.setCurrentProject(null);
                    setOpenDeleteProject(disableOpenDeleteModalParams);
                    PM.setTeamProjects(
                        PM.teamProjects.filter(
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
                setErrorMessage("Unexpected error");
                console.error("Unexpected error:", error);
            }
        }
    }

    return (
        <>
            <Modal
                open={openDeleteProject.flag}
                sx={{ zIndex: 10010 }}
                onClose={() => setOpenDeleteProject(disableOpenDeleteModalParams)}
            >
                <ModalDialog>
                    <Typography level="h4">
                        Are you sure to delete{" "}
                        <Typography color="danger" level="h3">
                            {openDeleteProject.projectName}
                        </Typography>{" "}
                        ?
                    </Typography>
                    {errorMessage && errorMessage !== "" && (
                        <Alert color="danger">{errorMessage}</Alert>
                    )}
                    <Stack direction="row" spacing={1} sx={{ mt: 2, justifyContent: "center" }}>
                        <Button
                            color="neutral"
                            component="button"
                            variant="outlined"
                            onClick={() => setOpenDeleteProject(disableOpenDeleteModalParams)}
                        >
                            Cancel
                        </Button>
                        <Button color="danger" component="button" onClick={handleDeleteProject}>
                            Delete
                        </Button>
                    </Stack>
                </ModalDialog>
            </Modal>
        </>
    );
};
