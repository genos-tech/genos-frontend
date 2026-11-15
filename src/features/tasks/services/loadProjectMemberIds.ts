import axios from "axios";

import { authApi } from "../../../services/api";

// The ids of the people on one project (members and, when the server lists
// it, the owner), from `GET /project/members/`. The only question the
// collaborator picker asks of it is "may this person be put on a task of the
// project": the server holds a collaborator to being able to open the task
// (MIP-1567), and a project member is the one case it can decide from the
// project alone.
//
// `null` means the answer is unknown (offline, 4xx, 5xx), which is not the
// same as an empty project: the caller has to fail CLOSED on it.
export const loadProjectMemberIds = async (
    projectId: number,
    accessToken: string | null
): Promise<string[] | null> => {
    try {
        const api = authApi(accessToken);
        if (!api) return null;
        const res = await api.get(`/project/members/?project_id=${projectId}`);
        const rows = res.data?.project_members;
        if (!Array.isArray(rows)) return null;
        return rows
            .map((row: { attendee__id?: unknown }) => row.attendee__id)
            .filter((id): id is string | number => id != null)
            .map((id) => String(id));
    } catch (error: unknown) {
        if (axios.isAxiosError(error)) {
            console.error("API error:", error.response?.status, error.response?.data);
        } else {
            console.error("Unexpected error:", error);
        }
        return null;
    }
};
