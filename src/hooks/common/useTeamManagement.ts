import { useState, useEffect } from "react";
import { FindTeamResponse, Team, UserProps } from "../../types/admin";
import { popTeamMembers } from "../../features/chat/services/popTeamMembers";
import { findTeam } from "../../features/admin/services/findTeam";
import PopTeamUsersWorker from "../../workers/popTeamUsersWorker.ts?worker";

export interface TeamManagementState {
    currentTeamId: string;
    setCurrentTeamId: (id: string) => void;
    teamMembers: UserProps[];
    setTeamMembers: (members: UserProps[]) => void;
    teamMemberProfiles: Record<string, UserProps>;
    setTeamMemberProfiles: (profiles: Record<string, UserProps>) => void;
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

            // Initial load
            popTeamUsersWorker.postMessage({ myself });
            popTeamUsersWorker.onmessage = (event) => {
                const data = event.data;
                if (data.error) {
                    console.error("Worker failed:", data.error);
                } else {
                    setTeamMemberProfiles(data);
                }
            };

            // Run every minute
            const interval = setInterval(() => {
                popTeamUsersWorker.postMessage({ myself });
                popTeamUsersWorker.onmessage = (event) => {
                    const data = event.data;
                    if (data.error) {
                        console.error("Worker failed:", data.error);
                    } else {
                        setTeamMemberProfiles(data);
                    }
                };
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
