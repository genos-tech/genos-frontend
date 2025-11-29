import React, { useState } from "react";
import { Alert, Button, Input, Modal, ModalDialog, Stack, Typography } from "@mui/joy";

import { useAuth } from "../../../../context/AuthContext";
import { UserProps } from "../../../../types/admin";

const base_url = import.meta.env.VITE_API_BASE_URL;

type Props = {
    myself: UserProps;
    setMyself: (value: UserProps) => void;
    openCreateTeam: boolean;
    setOpenCreateTeam: (value: boolean) => void;
    setIsNewTeamCreated: (value: boolean) => void;
};

export const ModalCreateTeam: React.FC<Props> = ({
    myself,
    setMyself,
    openCreateTeam,
    setOpenCreateTeam,
    setIsNewTeamCreated,
}) => {
    const { accessToken } = useAuth();

    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const [teamName, setTeamName] = useState("");
    const handleCreateTeam = () => {
        if (teamName.trim()) {
            createTeam();
        }
    };
    async function createTeam(): Promise<void> {
        try {
            const createTeamResponse = await fetch(`${base_url}/team/create/`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${accessToken}`,
                },
                body: JSON.stringify({
                    team_name: teamName,
                    team_email: `${teamName}@origin.tech`,
                    owner_id: myself.userId,
                }),
            });

            const createTeamData = await createTeamResponse.json();

            if (!createTeamResponse.ok) {
                console.error(createTeamData);
                throw new Error(createTeamData.hint || "Team Creation Failed");
            } else {
                setMyself({ ...myself, teamId: createTeamData.teamId });
                setOpenCreateTeam(false);
                setIsNewTeamCreated(true);
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
                open={openCreateTeam}
                sx={{ zIndex: 10010 }}
                onClose={() => setOpenCreateTeam(false)}
            >
                <ModalDialog>
                    <Typography level="h4">Create New Team</Typography>
                    <Input
                        placeholder="Unique team name"
                        sx={{ mt: 1 }}
                        value={teamName}
                        onChange={(e) => setTeamName(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === "Enter" && teamName.trim()) {
                                handleCreateTeam();
                            }
                        }}
                    />
                    {errorMessage && errorMessage !== "" && (
                        <Alert color="danger">{errorMessage}</Alert>
                    )}
                    <Stack direction="row" spacing={1} sx={{ mt: 2, justifyContent: "flex-end" }}>
                        <Button
                            color="danger"
                            component="a"
                            variant="outlined"
                            onClick={() => setOpenCreateTeam(false)}
                        >
                            Cancel
                        </Button>
                        <Button
                            component="a"
                            disabled={!teamName.trim()}
                            onClick={handleCreateTeam}
                        >
                            Create
                        </Button>
                    </Stack>
                </ModalDialog>
            </Modal>
        </>
    );
};
