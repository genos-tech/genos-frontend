import React, { useEffect, useRef, useState } from "react";
import { Alert, Button, FormControl, FormHelperText, Input } from "@mui/joy";

import { ModalFrame } from "../../../../components/ui/modal/ModalFrame";
import { useAuth } from "../../../../context/authState";
import { useTeamSetupFields } from "../../../../hooks/common/useTeamSetupFields";
import { useTranslation } from "../../../../i18n";
import { UserProps } from "../../../../types/admin";
import {
    classifyTeamCreateFailure,
    teamCreateCopy,
    type TeamCreateFailure,
} from "../../services/teamCreateFailure";
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

    // Where the last refused create belongs (MIP-1841): the team name, the departments, or the form.
    const [failure, setFailure] = useState<TeamCreateFailure | null>(null);
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
    // A refusal about the departments goes once they are edited (MIP-1841).
    useEffect(() => {
        setFailure(null);
    }, [setup.departmentsText]);

    async function createTeam(): Promise<void> {
        creatingRef.current = true;
        setIsCreating(true);
        setFailure(null);
        const copy = teamCreateCopy(t);
        try {
            let response: Response;
            try {
                response = await fetch(`${base_url}/team/create/`, {
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
                        ...(setup.departments.length > 0
                            ? { departments: setup.departments }
                            : {}),
                    }),
                });
            } catch (error) {
                // No response at all: the connection, not the form.
                console.error(error);
                setFailure(classifyTeamCreateFailure({ status: null, data: undefined }, copy));
                return;
            }

            // A 5xx can arrive as an HTML page, so the body is read defensively.
            const data: unknown = await response.json().catch(() => undefined);
            if (!response.ok) {
                console.error(data);
                setFailure(classifyTeamCreateFailure({ status: response.status, data }, copy));
                return;
            }
            // The created team comes back as `{ teamDetails: { teamId, ... } }` (team_views.py).
            const teamId = (data as { teamDetails?: { teamId?: string } } | undefined)?.teamDetails
                ?.teamId;
            setMyself({ ...myself, teamId: teamId ?? myself.teamId });
            setOpenCreateTeam(false);
            setIsNewTeamCreated(true);
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
            <FormControl error={failure?.field === "teamName"}>
                <Input
                    placeholder={t.admin.createTeamModal.teamNamePlaceholder}
                    value={teamName}
                    onChange={(e) => {
                        setTeamName(e.target.value);
                        if (failure?.field === "teamName") setFailure(null);
                    }}
                    onKeyDown={(e) => {
                        if (e.key === "Enter" && teamName.trim()) {
                            handleCreateTeam();
                        }
                    }}
                />
                {failure?.field === "teamName" && (
                    <FormHelperText>{failure.message}</FormHelperText>
                )}
            </FormControl>
            <TeamSetupFields
                departmentsError={failure?.field === "departments" ? failure.message : null}
                fields={setup}
            />
            {failure?.field === "form" && (
                <Alert color="danger" sx={{ mt: 1.5 }}>
                    {failure.message}
                </Alert>
            )}
        </ModalFrame>
    );
};
