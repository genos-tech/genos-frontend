import React, { useRef, useState } from "react";
import { Alert, Button, Input } from "@mui/joy";

import { ModalFrame } from "../../../../components/ui/modal/ModalFrame";
import { useAuth } from "../../../../context/AuthContext";
import { useTeamSetupFields } from "../../../../hooks/common/useTeamSetupFields";
import { useTranslation } from "../../../../i18n";
import { UserProps } from "../../../../types/admin";
import { teamEmailFor } from "../../services/teamEmail";
import { TeamSetupFields } from "../TeamSetupFields";

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
    // The sample data and the departments, as on the first-run page (MIP-1709).
    const setup = useTeamSetupFields();
    // One create at a time (MIP-1189, the same family as MIP-1184): a second Enter or click
    // while the request runs used to create a second team. The ref answers at once, the
    // state shows it and keeps the dialog from being dismissed meanwhile.
    const creatingRef = useRef(false);
    const [isCreating, setIsCreating] = useState(false);
    const handleCreateTeam = () => {
        if (teamName.trim() && setup.problem === null && !creatingRef.current) {
            void createTeam();
        }
    };
    async function createTeam(): Promise<void> {
        creatingRef.current = true;
        setIsCreating(true);
        try {
            const createTeamResponse = await fetch(`${base_url}/team/create/`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${accessToken}`,
                },
                body: JSON.stringify({
                    team_name: teamName,
                    team_email: teamEmailFor(teamName),
                    owner_id: myself.userId,
                    // As `createTeam` sends them: the server wants the literal `true` to seed,
                    // and a department list only when some are named.
                    ...(setup.withStarter ? { with_starter: true } : {}),
                    ...(setup.departments.length > 0 ? { departments: setup.departments } : {}),
                }),
            });

            const createTeamData = await createTeamResponse.json();

            if (!createTeamResponse.ok) {
                console.error(createTeamData);
                // The form checks the list first, so this is the server's backstop.
                throw new Error(
                    createTeamData.code === "invalid_departments"
                        ? t.admin.auth.errors.invalidDepartments
                        : createTeamData.hint || t.admin.createTeamModal.creationFailed
                );
            } else {
                setMyself({ ...myself, teamId: createTeamData.teamId });
                setOpenCreateTeam(false);
                setIsNewTeamCreated(true);
            }
        } catch (error) {
            const err_msg = `${error}`;
            console.error(err_msg);
            setErrorMessage(err_msg);
        } finally {
            creatingRef.current = false;
            setIsCreating(false);
        }
    }

    return (
        <ModalFrame
            dismissible={!isCreating}
            open={openCreateTeam}
            size="sm"
            title={t.admin.createTeamModal.title}
            zIndex={10010}
            actions={
                <>
                    <Button
                        color="neutral"
                        disabled={isCreating}
                        variant="plain"
                        onClick={() => setOpenCreateTeam(false)}
                    >
                        {t.admin.createTeamModal.cancel}
                    </Button>
                    <Button
                        disabled={!teamName.trim() || setup.problem !== null}
                        loading={isCreating}
                        onClick={handleCreateTeam}
                    >
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
            <TeamSetupFields fields={setup} />
            {errorMessage && errorMessage !== "" && (
                <Alert color="danger" sx={{ mt: 1.5 }}>
                    {errorMessage}
                </Alert>
            )}
        </ModalFrame>
    );
};
