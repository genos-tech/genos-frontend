import axios from "axios";
import React, { useState } from "react";
import { Modal, ModalDialog, Alert, Stack, Button, Typography } from "@mui/joy";

import { UserProps } from "../../../../types/admin";
import { ProjectProps } from "../../../../types/tasks";
import { useAuth } from "../../../../context/AuthContext";
import { authApi } from "../../../../services/api";

const disableOpenDeleteModalParams = { flag: false, projectId: -1, projectName: "" };

type Props = {
    myself: UserProps;
    openDeleteProject: { flag: boolean; projectId: number; projectName: string };
    setOpenDeleteProject: (value: {
        flag: boolean;
        projectId: number;
        projectName: string;
    }) => void;
    setCurrentProject: (value: ProjectProps | null) => void;
    teamProjects: ProjectProps[];
    setTeamProjects: (value: ProjectProps[]) => void;
};

export const ModalDeleteProject: React.FC<Props> = ({
    myself,
    openDeleteProject,
    setOpenDeleteProject,
    setCurrentProject,
    teamProjects,
    setTeamProjects,
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
                    setCurrentProject(null);
                    setOpenDeleteProject(disableOpenDeleteModalParams);
                    setTeamProjects(
                        teamProjects.filter(
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
                sx={{ zIndex: 10010 }}
                open={openDeleteProject.flag}
                onClose={() => setOpenDeleteProject(disableOpenDeleteModalParams)}
            >
                <ModalDialog>
                    <Typography level="h4">
                        Are you sure to delete{" "}
                        <Typography level="h3" color="danger">
                            {openDeleteProject.projectName}
                        </Typography>{" "}
                        ?
                    </Typography>
                    {errorMessage && errorMessage !== "" && (
                        <Alert color="danger">{errorMessage}</Alert>
                    )}
                    <Stack direction="row" spacing={1} sx={{ mt: 2, justifyContent: "center" }}>
                        <Button
                            component="button"
                            color="neutral"
                            variant="outlined"
                            onClick={() => setOpenDeleteProject(disableOpenDeleteModalParams)}
                        >
                            Cancel
                        </Button>
                        <Button component="button" color="danger" onClick={handleDeleteProject}>
                            Delete
                        </Button>
                    </Stack>
                </ModalDialog>
            </Modal>
        </>
    );
};
