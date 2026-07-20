import axios from "axios";

import { authApi } from "../../../services/api";
import { MemberRole } from "../../../utils/memberRoles";

/**
 * Set a team member's permission role (editor / viewer).
 *
 * Not the user's `role` job title — see `utils/memberRoles.ts`. The
 * backend re-checks that the caller is the owner or an editor, that the
 * target isn't the owner, and that the role is assignable, so a rejected
 * write surfaces here as `false` and the caller reverts its optimistic
 * update.
 */
export const setTeamMemberRole = async (
    teamId: string,
    userId: string,
    memberRole: MemberRole,
    accessToken: string | null
): Promise<boolean> => {
    try {
        const api = authApi(accessToken);
        if (!api) return false;
        await api.put(`/team/member-role/`, {
            team_id: teamId,
            user_id: userId,
            member_role: memberRole,
        });
        return true;
    } catch (error: unknown) {
        if (axios.isAxiosError(error)) {
            console.error(
                "[setTeamMemberRole] failed:",
                error.response?.status,
                error.response?.data
            );
        } else {
            console.error("[setTeamMemberRole] failed:", error);
        }
        return false;
    }
};
