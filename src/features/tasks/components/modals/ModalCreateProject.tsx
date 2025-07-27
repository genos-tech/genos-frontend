import React, { useState } from "react";
import { Modal, ModalDialog, Alert, Stack, Button, Input, Typography } from "@mui/joy";

import { signUp } from "../../../admin/services/signup";
import { joinTeam } from "../../../admin/services/joinTeam";
import { UserProps, SignUpResponse } from "../../../../types/admin";
import { ProjectProps } from "../../../../types/tasks";
import { useAuth } from "../../../../context/AuthContext";

const base_url = import.meta.env.VITE_API_BASE_URL;

type Props = {
    myself: UserProps;
    openCreateProject: boolean;
    setOpenCreateProject: (value: boolean) => void;
    setCurrentProject: (value: ProjectProps) => void;
    setIsNewProjectCreated: (value: boolean) => void;
};

export const ModalCreateProject: React.FC<Props> = ({
    myself,
    openCreateProject,
    setOpenCreateProject,
    setCurrentProject,
    setIsNewProjectCreated,
}) => {
    const { accessToken } = useAuth();

    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const [projectName, setProjectName] = useState("");
    const handleCreateProject = () => {
        if (projectName.trim()) {
            createProject();
        }
    };
    async function createProject(): Promise<void> {
        try {
            // Signup for a system user for the new project
            const _signup = async (username: string, email: string, password: string) => {
                const signUpRes: SignUpResponse = await signUp(
                    username,
                    email,
                    password,
                    true,
                    setErrorMessage
                );
                if (signUpRes) {
                    const createProjectResponse = await fetch(`${base_url}/project/`, {
                        method: "POST",
                        headers: {
                            "Content-Type": "application/json",
                            Authorization: `Bearer ${accessToken}`,
                        },
                        body: JSON.stringify({
                            team: myself.teamId,
                            project_name: projectName,
                            owner: myself.userId,
                            project_system_user: signUpRes.user.id,
                        }),
                    });

                    const createProjectData = await createProjectResponse.json();

                    if (!createProjectResponse.ok) {
                        console.error(createProjectData);
                        throw new Error(createProjectData.hint || "Project Creation Failed");
                    } else {
                        const joinProjectResponse = await fetch(`${base_url}/project/join/`, {
                            method: "POST",
                            headers: {
                                "Content-Type": "application/json",
                                Authorization: `Bearer ${accessToken}`,
                            },
                            body: JSON.stringify({
                                team_id: myself.teamId,
                                project_id: createProjectData.project_id,
                                attendee_id: myself.userId,
                            }),
                        });

                        const joinProjectData = await joinProjectResponse.json();

                        if (!joinProjectResponse.ok) {
                            console.error(joinProjectData);
                            throw new Error(
                                joinProjectData.hint || "Failed to join the created project"
                            );
                        } else {
                            const prjJoinTeamRes = await joinTeam(
                                accessToken,
                                myself.teamId,
                                signUpRes.user.id,
                                setErrorMessage
                            );

                            const meJoinTeamRes = await joinTeam(
                                accessToken,
                                myself.teamId,
                                myself.userId,
                                setErrorMessage
                            );

                            if (prjJoinTeamRes && meJoinTeamRes) {
                                setCurrentProject({
                                    projectId: createProjectData.project_id,
                                    projectName: createProjectData.project_name,
                                    projectTags: [],
                                    systemUserId: createProjectData.project_system_user,
                                });
                                setOpenCreateProject(false);
                                setIsNewProjectCreated(true);
                            } else {
                                console.error("Failed to add me and/or system_user to the team");
                            }
                        }
                    }
                } else {
                    console.error("Failed to create system user for the project.");
                }
            };
            _signup(
                projectName,
                `${projectName}-${myself.teamId}@origin.tech`,
                `${projectName}-Bad-Password-Need-Secure-One`
            );
        } catch (error) {
            const err_msg = `${error}`;
            console.error(err_msg);
            setErrorMessage(err_msg);
        }
    }

    return (
        <>
            <Modal
                sx={{ zIndex: 10010 }}
                open={openCreateProject}
                onClose={() => setOpenCreateProject(false)}
            >
                <ModalDialog>
                    <Typography level="h4">Create New Project</Typography>
                    <Input
                        placeholder="Unique project name"
                        value={projectName}
                        onChange={(e) => setProjectName(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === "Enter" && projectName.trim()) {
                                handleCreateProject();
                            }
                        }}
                        sx={{ mt: 1 }}
                    />
                    {errorMessage && errorMessage !== "" && (
                        <Alert color="danger">{errorMessage}</Alert>
                    )}
                    <Stack direction="row" spacing={1} sx={{ mt: 2, justifyContent: "flex-end" }}>
                        <Button
                            component="button"
                            color="danger"
                            variant="outlined"
                            onClick={() => setOpenCreateProject(false)}
                        >
                            Cancel
                        </Button>
                        <Button
                            component="button"
                            color="primary"
                            onClick={handleCreateProject}
                            disabled={!projectName.trim()}
                        >
                            Create
                        </Button>
                    </Stack>
                </ModalDialog>
            </Modal>
        </>
    );
};
