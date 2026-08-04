import { UserProps } from "../../../types/admin";
import { getLocalCurrentTimestamp } from "../../../utils/dateUtils";
import { joinTeam } from "./joinTeam";

type SwitchTeamArgs = {
    accessToken: string | null;
    myself: UserProps;
    setMyself: (me: UserProps) => void;
    teamId: string;
    teamName: string;
    /**
     * True for a host team the user reaches through a cross-team share
     * rather than a membership (`Team.isGuest` from `loadMyTeams`).
     */
    isGuest?: boolean;
};

/**
 * Make `teamId` the active team.
 *
 * Shared by the desktop TeamDropdown and the mobile account sheet. The
 * `lastProjectId` removal matters: it belongs to the team being left, and
 * carrying it across would open a project the new team can't see.
 */
export const switchTeam = ({
    accessToken,
    myself,
    setMyself,
    teamId,
    teamName,
    isGuest = false,
}: SwitchTeamArgs): void => {
    localStorage.setItem("teamId", teamId);
    localStorage.setItem("teamName", teamName);
    localStorage.removeItem("lastProjectId");
    setMyself({
        teamId: teamId,
        teamName: teamName,
        userId: myself.userId,
        userName: myself.userName,
        userEmail: myself.userEmail,
        tsLastSeen: getLocalCurrentTimestamp(),
        tsJoined: myself.tsJoined,
        isOfflineForced: myself.isOfflineForced,
        role: myself.role,
        baseCountry: myself.baseCountry,
        customStatus: myself.customStatus,
        avatarImgPath: myself.avatarImgPath,
    });
    // `/team/join/` is how a switch re-affirms a membership row and picks
    // up the Genos Guide notes. A guest has no membership row to re-affirm
    // — they are here through a shared chat, project or note folder — so
    // the call can only come back 403. Skipping it keeps the switch quiet
    // and keeps the endpoint's meaning intact: nothing about arriving in a
    // host team's context should look like joining it.
    if (!isGuest) {
        void joinTeam(accessToken, teamId, myself.userId);
    }
};
