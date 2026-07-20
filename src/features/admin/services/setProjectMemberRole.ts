import axios from "axios";

import { authApi } from "../../../services/api";
import { MemberRole } from "../../../utils/memberRoles";

/**
 * Set a project member's permission role (editor / viewer).
 *
 * Mirrors `setTeamMemberRole`. Not the user's `role` job title — see
 * `utils/memberRoles.ts`.
 */
export const setProjectMemberRole = async (
    projectId: number,
    userId: string,
    memberRole: MemberRole,
    accessToken: string | null
): Promise<boolean> => {
    try {
        const api = authApi(accessToken);
        if (!api) return false;
        await api.put(`/project/member-role/`, {
            project_id: projectId,
            user_id: userId,
            member_role: memberRole,
        });
        return true;
    } catch (error: unknown) {
        if (axios.isAxiosError(error)) {
            console.error(
                "[setProjectMemberRole] failed:",
                error.response?.status,
                error.response?.data
            );
        } else {
            console.error("[setProjectMemberRole] failed:", error);
        }
        return false;
    }
};
