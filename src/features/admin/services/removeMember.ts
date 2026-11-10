import axios from "axios";

import { getMessages } from "../../../i18n";
import { authApi } from "../../../services/api";

/** What the confirm dialog names: how much open work the person holds. */
export type OpenWork = { tasks: number; milestones: number };

export type RemovalScope = "team" | "project";

const failure = (error: unknown): Error => {
    if (axios.isAxiosError(error)) {
        const message = (error.response?.data as { error?: string } | undefined)?.error;
        return new Error(message || getMessages().common.memberRemoval.failed);
    }
    return new Error(getMessages().common.memberRemoval.failed);
};

/**
 * How many open tasks and milestones `userId` holds in the team or project, for the confirm
 * dialog. `null` when it can't be read: the dialog then still lets the person remove, without
 * the unassign offer. (The server answers the same gate as the removal, so a 403/404 here
 * means the removal would be refused too.)
 */
export const loadOpenWork = async (
    accessToken: string | null,
    scope: RemovalScope,
    scopeId: string | number,
    userId: string
): Promise<OpenWork | null> => {
    const api = authApi(accessToken);
    if (!api) return null;
    try {
        const res = await api.get<{ openWork: OpenWork }>(
            scope === "team" ? "/team/member/remove/" : "/project/member/remove/",
            {
                params:
                    scope === "team"
                        ? { team_id: scopeId, user_id: userId }
                        : { project_id: scopeId, user_id: userId },
                suppressErrorToast: true,
            }
        );
        return res.data.openWork;
    } catch {
        return null;
    }
};

/**
 * Remove another member from a team or a project. Throws an Error carrying the server's
 * reason, which the confirm dialog shows (a throw keeps it open). `unassign` also takes them
 * off their open tasks and milestones; the server reads only a literal `true`.
 */
export const removeMember = async (
    accessToken: string | null,
    scope: RemovalScope,
    scopeId: string | number,
    userId: string,
    unassign: boolean
): Promise<OpenWork> => {
    const api = authApi(accessToken);
    if (!api) throw new Error(getMessages().common.memberRemoval.failed);
    try {
        const res = await api.post<{ unassigned: OpenWork }>(
            scope === "team" ? "/team/member/remove/" : "/project/member/remove/",
            scope === "team"
                ? { team_id: scopeId, user_id: userId, unassign_open_tasks: unassign }
                : { project_id: scopeId, user_id: userId, unassign_open_tasks: unassign },
            { suppressErrorToast: true }
        );
        return res.data.unassigned;
    } catch (error: unknown) {
        throw failure(error);
    }
};
