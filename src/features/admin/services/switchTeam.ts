import { UserProps } from "../../../types/admin";
import { getLocalCurrentTimestamp } from "../../../utils/dateUtils";
import { joinTeam } from "./joinTeam";

type SwitchTeamArgs = {
    accessToken: string | null;
    myself: UserProps;
    setMyself: (me: UserProps) => void;
    teamId: string;
    teamName: string;
};

/**
 * Make `teamId` the active team.
 *
 * Shared by the desktop TeamDropdown and the mobile account sheet. Both
 * pick from `membershipTeams`, so `teamId` is always a team the user holds
 * a membership row in. The `lastProjectId` removal matters: it belongs to
 * the team being left, and carrying it across would open a project the new
 * team can't see.
 */
export const switchTeam = ({
    accessToken,
    myself,
    setMyself,
    teamId,
    teamName,
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
        phoneNumber: myself.phoneNumber,
        currentLocation: myself.currentLocation,
        aboutMe: myself.aboutMe,
        customStatus: myself.customStatus,
        avatarImgPath: myself.avatarImgPath,
    });
    // `/team/join/` is how a switch re-affirms a membership row and picks
    // up the Genos Guide notes.
    void joinTeam(accessToken, teamId, myself.userId);
};
