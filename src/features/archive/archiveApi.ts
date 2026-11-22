/**
 * The owner's archive and restore of a project (MIP-1693). The server keeps everything; only
 * the archived mark moves. Group chats are archived through the channel service, which owns
 * the chat list.
 */
import { authApi } from "../../services/api";
import type { UserProps } from "../../types/admin";
import type { ProjectProps } from "../../types/tasks";
import { loadTeamProjects } from "../tasks/services/loadTeamProjects";
import { markProjectArchived, setArchivedProjects } from "./archiveState";

const projectApi = (accessToken: string | null) => {
    const api = authApi(accessToken);
    if (!api) throw new Error("Unauthorized. Auth token is not found.");
    return api;
};

/**
 * Archive a project. Resolves once the server accepted it; the local archived mark moves
 * with it. A refusal (not the owner, unknown project) throws and leaves the state untouched.
 */
export const archiveProject = async (
    accessToken: string | null,
    teamId: string,
    project: ProjectProps
): Promise<void> => {
    await projectApi(accessToken).post(
        `/project/archive/?team_id=${teamId}&project_id=${project.projectId}`
    );
    markProjectArchived(project, true);
};

/** Restore an archived project to the active lists. */
export const unarchiveProject = async (
    accessToken: string | null,
    teamId: string,
    project: ProjectProps
): Promise<void> => {
    await projectApi(accessToken).post(
        `/project/unarchive/?team_id=${teamId}&project_id=${project.projectId}`
    );
    markProjectArchived(project, false);
};

/**
 * Reads the archived projects: the full list (archived included) minus the active list the
 * caller already holds. A failed read leaves the state as it was.
 */
export const refreshArchivedProjects = async (
    myself: Pick<UserProps, "teamId" | "userId">,
    accessToken: string | null,
    active: readonly ProjectProps[]
): Promise<void> => {
    const all: ProjectProps[] | undefined = await loadTeamProjects(myself, accessToken, {
        includeArchived: true,
    });
    if (!all) return;
    const activeIds = new Set(active.map((p) => p.projectId));
    // Only projects the member joined: the team list also holds projects they never joined
    // (private ones too), which they cannot open (MIP-1921).
    setArchivedProjects(all.filter((p) => !activeIds.has(p.projectId) && p.isJoined === true));
};
