import React, { useState } from "react";
import {
    Alert,
    Box,
    Button,
    Checkbox,
    Input,
    Modal,
    ModalDialog,
    Stack,
    Typography,
} from "@mui/joy";

import { useAuth } from "../../../../context/AuthContext";
import { ProjectManagementState } from "../../../../hooks/common/useProjectManagement";
import { SignUpResponse, UserProps } from "../../../../types/admin";
import { replaceSpacesWithUnderscore } from "../../../../utils/stringHelper";
import { joinTeam } from "../../../admin/services/joinTeam";
import { signUp } from "../../../admin/services/signup";

const base_url = import.meta.env.VITE_API_BASE_URL;

type Props = {
    myself: UserProps;
    usePM: ProjectManagementState;
    setIsNewProjectCreated?: (value: boolean) => void;
};

export const ModalCreateProject: React.FC<Props> = ({ myself, usePM, setIsNewProjectCreated }) => {
    const { accessToken } = useAuth();

    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const [isPrivate, setIsPrivate] = useState(true);
    const [projectName, setProjectName] = useState("");
    const handleCreateProject = () => {
        if (projectName.trim()) {
            createProject();
        }
    };
    async function createProject(): Promise<void> {
        try {
            // Signup for a system user for the new project
            const _signup = async (projectEmail: string, password: string) => {
                // Step-1: Create a system user for the new project.
                const signUpRes: SignUpResponse = await signUp(
                    projectName,
                    projectEmail,
                    password,
                    true,
                    setErrorMessage
                );

                // Step-2: If the system user is created successfully, create the project.
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
                            is_private: isPrivate,
                        }),
                    });

                    const createProjectData = await createProjectResponse.json();

                    if (!createProjectResponse.ok) {
                        console.error(createProjectData);
                        throw new Error(createProjectData.hint || "Project Creation Failed");
                    } else {
                        // Step-3: Join the project.
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
                            // Step-4: Join the team for the system user.
                            const prjJoinTeamRes = await joinTeam(
                                accessToken,
                                myself.teamId,
                                signUpRes.user.id,
                                setErrorMessage
                            );

                            // Step-5: Join the team for the user.
                            const meJoinTeamRes = await joinTeam(
                                accessToken,
                                myself.teamId,
                                myself.userId,
                                setErrorMessage
                            );

                            if (prjJoinTeamRes && meJoinTeamRes && createProjectData.project_id) {
                                usePM.setCurrentProject({
                                    projectId: createProjectData.project_id,
                                    projectName: createProjectData.project_name,
                                    projectTags: [],
                                    systemUserId: createProjectData.project_system_user,
                                });
                                usePM.setOpenCreateProject(false);
                                if (setIsNewProjectCreated) {
                                    setIsNewProjectCreated(true);
                                    usePM.loadProjectsAndTasks(createProjectData.project_id);
                                }
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
                `${myself.teamId}-${replaceSpacesWithUnderscore(projectName)}@origin.tech`,
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
                open={usePM.openCreateProject}
                sx={{ zIndex: 10010 }}
                onClose={() => usePM.setOpenCreateProject(false)}
            >
                <ModalDialog>
                    <Typography level="h4">Create New Project</Typography>
                    <Input
                        placeholder="Unique project name"
                        sx={{ mt: 1 }}
                        value={projectName}
                        onChange={(e) => setProjectName(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === "Enter" && projectName.trim()) {
                                handleCreateProject();
                            }
                        }}
                    />
                    <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                        <Checkbox
                            checked={isPrivate}
                            color="neutral"
                            label="🔒 Private Project"
                            sx={{ mt: 1 }}
                            variant="soft"
                            onChange={(e) => setIsPrivate(e.target.checked)}
                        />
                    </Box>
                    {errorMessage && errorMessage !== "" && (
                        <Alert color="danger">{errorMessage}</Alert>
                    )}
                    <Stack direction="row" spacing={1} sx={{ justifyContent: "flex-end" }}>
                        <Button
                            color="danger"
                            component="button"
                            variant="outlined"
                            onClick={() => usePM.setOpenCreateProject(false)}
                        >
                            Cancel
                        </Button>
                        <Button
                            color="primary"
                            component="button"
                            disabled={!projectName.trim()}
                            onClick={handleCreateProject}
                        >
                            Create
                        </Button>
                    </Stack>
                </ModalDialog>
            </Modal>
        </>
    );
};
