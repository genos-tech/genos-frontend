import { Dispatch, SetStateAction, useEffect, useRef, useState } from "react";

import { usersChannel } from "../../db/workers/channels";
import { findTeam } from "../../features/admin/services/findTeam";
import { loadMyTeams } from "../../features/admin/services/loadMyTeams";
import { popTeamMembers } from "../../features/admin/services/popTeamMembers";
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
    // Track the active interval id so a `myself` change cancels the previous
    // interval before scheduling a new one. Without this, every re-run of the
    // effect would stack another interval on top of the old one.
    const intervalRef = useRef<number | null>(null);

    const funcSetTeamMembers = async () => {
        const teamMembers: UserProps[] = await popTeamMembers(myself);
        if (teamMembers) {
            setTeamMembers(teamMembers);
        }
    };

    const initCurrentTeam = async () => {
        const findTeamRes: FindTeamResponse = await findTeam(accessToken, myself.teamId);
        if (findTeamRes && findTeamRes.exist === true) {
            // `/team/exist/` answers "does this team exist and what is it
            // called" for anyone, so it cannot say whether WE belong to it.
            // The my-teams list can, and it is the heartbeat's endpoint —
            // already warm and server-cached. Without this flag a host-team
            // shell is indistinguishable from a small team, and every
            // member-only control renders for someone the server will
            // refuse. Failure leaves it undefined, i.e. treated as member,
            // which is what the app did before this existed.
            const teams: Team[] | undefined = await loadMyTeams(accessToken, myself.userId);
            const mine = teams?.find((tm) => tm.teamId === myself.teamId);
            setCurrentTeam({ ...findTeamRes.teamDetails, isGuest: mine?.isGuest });
        }
    };

    // Update team when myself changes
    useEffect(() => {
        initCurrentTeam();
        if (myself.teamId !== currentTeamId) {
            setCurrentTeamId(myself.teamId);
        }

        if (!myself.userId) return;

        const refresh = () => {
            usersChannel
                .request("popTeamUsers", { myself })
                .then((data) => {
                    if (data && typeof data === "object" && "error" in data) {
                        console.error("popTeamUsers failed:", data.error);
                        return;
                    }
                    const record = data as Record<string, UserProps>;
                    setTeamMemberProfiles(record);
                    const members = Object.values(record);
                    if (members.length > 0) {
                        setTeamMembers(members);
                    }
                })
                .catch((err) => {
                    console.error("popTeamUsers error:", err);
                });
        };

        refresh();
        intervalRef.current = window.setInterval(refresh, 60_000);

        return () => {
            if (intervalRef.current !== null) {
                window.clearInterval(intervalRef.current);
                intervalRef.current = null;
            }
        };
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
