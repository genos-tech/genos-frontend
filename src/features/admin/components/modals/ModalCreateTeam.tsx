import React, { useState } from "react";
import { Alert, Button, Input } from "@mui/joy";

import { ModalFrame } from "../../../../components/ui/modal/ModalFrame";
import { useAuth } from "../../../../context/AuthContext";
import { useTranslation } from "../../../../i18n";
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
    const { t } = useTranslation();

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
                    team_email: `${teamName}@genos.tech`,
                    owner_id: myself.userId,
                }),
            });

            const createTeamData = await createTeamResponse.json();

            if (!createTeamResponse.ok) {
                console.error(createTeamData);
                throw new Error(createTeamData.hint || t.admin.createTeamModal.creationFailed);
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
        <ModalFrame
            open={openCreateTeam}
            size="sm"
            title={t.admin.createTeamModal.title}
            zIndex={10010}
            actions={
                <>
                    <Button
                        color="neutral"
                        variant="plain"
                        onClick={() => setOpenCreateTeam(false)}
                    >
                        {t.admin.createTeamModal.cancel}
                    </Button>
                    <Button disabled={!teamName.trim()} onClick={handleCreateTeam}>
                        {t.admin.createTeamModal.create}
                    </Button>
                </>
            }
            onClose={() => setOpenCreateTeam(false)}
        >
            <Input
                placeholder={t.admin.createTeamModal.teamNamePlaceholder}
                value={teamName}
                onChange={(e) => setTeamName(e.target.value)}
                onKeyDown={(e) => {
                    if (e.key === "Enter" && teamName.trim()) {
                        handleCreateTeam();
                    }
                }}
            />
            {errorMessage && errorMessage !== "" && (
                <Alert color="danger" sx={{ mt: 1.5 }}>
                    {errorMessage}
                </Alert>
            )}
        </ModalFrame>
    );
};
