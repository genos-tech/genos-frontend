import { Dispatch, SetStateAction, useEffect, useState } from "react";

import PopTeamUsersWorker from "../../db/workers/popTeamUsersWorker.ts?worker";
import { findTeam } from "../../features/admin/services/findTeam";
import { popTeamMembers } from "../../features/chat/services/popTeamMembers";
import { FindTeamResponse, Team, UserProps } from "../../types/admin";

export interface TeamManagementState {
    currentTeamId: string;
    setCurrentTeamId: (id: string) => void;
    teamMembers: UserProps[];
    setTeamMembers: (members: UserProps[]) => void;
    teamMemberProfiles: Record<string, UserProps>;
    // Widened to React's Dispatch so call-sites can use the functional updater
    // form (`setTeamMemberProfiles((prev) => ({ ...prev, [id]: ... }))`)
    // without a cast. Single-arg callers continue to work.
    setTeamMemberProfiles: Dispatch<SetStateAction<Record<string, UserProps>>>;
    currentTeam: Team;
    setCurrentTeam: (team: Team) => void;
    funcSetTeamMembers: () => Promise<void>;
    initCurrentTeam: () => Promise<void>;
}
export const useTeamManagement = (
    myself: UserProps,
    accessToken: string | null
): TeamManagementState => {
    const [currentTeamId, setCurrentTeamId] = useState("");
    const [teamMembers, setTeamMembers] = useState<UserProps[]>([]);
    const [teamMemberProfiles, setTeamMemberProfiles] = useState<Record<string, UserProps>>({});
    const [currentTeam, setCurrentTeam] = useState<Team>({
        teamId: myself.teamId,
        teamName: myself.teamName,
        teamEmail: "",
        teamOwnerId: "",
        teamImgPath: localStorage.getItem("teamImgPath") || undefined,
    });

    const funcSetTeamMembers = async () => {
        const teamMembers: UserProps[] = await popTeamMembers(myself);
        if (teamMembers) {
            setTeamMembers(teamMembers);
        }
    };

    const initCurrentTeam = async () => {
        const findTeamRes: FindTeamResponse = await findTeam(accessToken, myself.teamId);
        if (findTeamRes && findTeamRes.exist === true) {
            setCurrentTeam(findTeamRes.teamDetails);
        }
    };

    // Update team when myself changes
    useEffect(() => {
        initCurrentTeam();
        if (myself.teamId !== currentTeamId) {
            setCurrentTeamId(myself.teamId);
        }

        if (myself.userId !== "") {
            const popTeamUsersWorker = new PopTeamUsersWorker();

            const handleWorkerResponse = (event: MessageEvent) => {
                const data = event.data;
                if (data.error) {
                    console.error("Worker failed:", data.error);
                } else {
                    setTeamMemberProfiles(data);
                    const members = Object.values(data) as UserProps[];
                    if (members.length > 0) {
                        setTeamMembers(members);
                    }
                }
            };

            // Initial load
            popTeamUsersWorker.postMessage({ myself });
            popTeamUsersWorker.onmessage = handleWorkerResponse;

            // Run every minute
            const interval = setInterval(() => {
                popTeamUsersWorker.postMessage({ myself });
                popTeamUsersWorker.onmessage = handleWorkerResponse;
            }, 60_000);

            return () => {
                popTeamUsersWorker.terminate();
                clearInterval(interval);
            };
        }
    }, [myself]);

    return {
        currentTeamId,
        setCurrentTeamId,
        teamMembers,
        setTeamMembers,
        teamMemberProfiles,
        setTeamMemberProfiles,
        currentTeam,
        setCurrentTeam,
        funcSetTeamMembers,
        initCurrentTeam,
    };
};
