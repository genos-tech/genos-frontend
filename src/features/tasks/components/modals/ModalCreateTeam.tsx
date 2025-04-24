import React, { useState } from 'react';
import {
    Modal,
    ModalDialog,
    Alert,
    Stack,
    Button,
    Input,
    Typography,
} from "@mui/joy";
import { UserProps } from '../../../../types/admin';
import { useAuth } from "../../../../context/AuthContext";

const base_url = import.meta.env.VITE_API_BASE_URL;

type Props = {
    myself: UserProps;
    setMyself: (value: UserProps) => void;
    openCreateTeam: boolean;
    setOpenCreateTeam: (value: boolean) => void;
};

export const ModalCreateTeam: React.FC<Props> = ({
    myself,
    setMyself,
    openCreateTeam,
    setOpenCreateTeam
}) => {
    const { accessToken } = useAuth();

    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const [teamName, setTeamName] = useState("");
    const handleCreateTeam = () => {
        if (teamName.trim()) { createTeam() }
    };
    async function createTeam(): Promise<void> {
        try {
            const createTeamResponse = await fetch(`${base_url}/team/create/`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    "Authorization": `Bearer ${accessToken}`
                },
                body: JSON.stringify({
                    team_name: teamName,
                    team_email: `${teamName}@origin.tech`,
                    owner_id: myself.userId
                }),
            });

            const createTeamData = await createTeamResponse.json();

            if (!createTeamResponse.ok) {
                console.error(createTeamData)
                throw new Error(createTeamData.hint || 'Team Creation Failed');
            } else {
                console.log("Task created:", createTeamData)
                setMyself({ ...myself, teamId: createTeamData.teamId })
                setOpenCreateTeam(false);
            }
        } catch (error) {
            const err_msg = `${error}`
            console.error(err_msg);
            setErrorMessage(err_msg);
        }
    }

    return (
        <>
            <Modal sx={{ zIndex: 10010 }} open={openCreateTeam} onClose={() => setOpenCreateTeam(false)}>
                <ModalDialog>
                    <Typography level="h4">Create New Team</Typography>
                    <Input
                        placeholder="Unique team name"
                        value={teamName}
                        onChange={(e) => setTeamName(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === "Enter" && teamName.trim()) {
                                handleCreateTeam();
                            }
                        }}
                        sx={{ mt: 1 }}
                    />
                    {errorMessage && errorMessage !== "" && (
                        <Alert color="danger">{errorMessage}</Alert>
                    )}
                    <Stack direction="row" spacing={1} sx={{ mt: 2, justifyContent: "flex-end" }}>
                        <Button component='a' variant="outlined" onClick={() => setOpenCreateTeam(false)}>
                            Cancel
                        </Button>
                        <Button component='a' onClick={handleCreateTeam} disabled={!teamName.trim()}>
                            Create
                        </Button>
                    </Stack>
                </ModalDialog>
            </Modal>
        </>
    );
};
