import React, { useState } from "react";
import { Modal, ModalDialog, Alert, Stack, Button, Typography } from "@mui/joy";

import { UserProps } from "../../../../types/admin";
import { ProjectProps } from "../../../../types/tasks";
import { useAuth } from "../../../../context/AuthContext";

const base_url = import.meta.env.VITE_API_BASE_URL;
const disableOpenJoinModalParams = {
    flag: false,
    projectId: -1,
    projectName: "",
    systemUserId: "",
};

type Props = {
    myself: UserProps;
    openJoinProject: {
        flag: boolean;
        projectId: number;
        projectName: string;
        systemUserId: string;
    };
    setOpenJoinProject: (value: {
        flag: boolean;
        projectId: number;
        projectName: string;
        systemUserId: string;
    }) => void;
    setCurrentProject: (value: ProjectProps) => void;
};

export const ModalJoinProject: React.FC<Props> = ({
    myself,
    openJoinProject,
    setOpenJoinProject,
    setCurrentProject,
}) => {
    const { accessToken } = useAuth();

    const [errorMessage, setErrorMessage] = useState<string | null>(null);

    const handleJoinProject = () => {
        joinProject();
    };
    async function joinProject(): Promise<void> {
        try {
            const joinProjectResponse = await fetch(`${base_url}/project/join/`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${accessToken}`,
                },
                body: JSON.stringify({
                    team_id: myself.teamId,
                    project_id: openJoinProject.projectId,
                    attendee_id: myself.userId,
                }),
            });

            const joinProjectData = await joinProjectResponse.json();

            if (!joinProjectResponse.ok) {
                console.error(joinProjectData);
                throw new Error(joinProjectData.hint || "Failed to join the created project");
            } else {
                setCurrentProject({
                    projectId: openJoinProject.projectId,
                    projectName: openJoinProject.projectName,
                    systemUserId: openJoinProject.systemUserId,
                });
                setOpenJoinProject(disableOpenJoinModalParams);
            }
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
                open={openJoinProject.flag}
                onClose={() => setOpenJoinProject(disableOpenJoinModalParams)}
            >
                <ModalDialog>
                    <Typography level="h4">
                        Joining{" "}
                        <Typography level="h3" color="primary">
                            {openJoinProject.projectName}
                        </Typography>
                    </Typography>
                    {errorMessage && errorMessage !== "" && (
                        <Alert color="danger">{errorMessage}</Alert>
                    )}
                    <Stack direction="row" spacing={1} sx={{ mt: 2, justifyContent: "center" }}>
                        <Button
                            component="button"
                            color="danger"
                            variant="outlined"
                            onClick={() => setOpenJoinProject(disableOpenJoinModalParams)}
                        >
                            Cancel
                        </Button>
                        <Button component="button" color="primary" onClick={handleJoinProject}>
                            Join (Get approval)
                        </Button>
                    </Stack>
                </ModalDialog>
            </Modal>
        </>
    );
};
