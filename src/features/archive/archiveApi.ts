/**
 * The owner's archive and restore of a project (MIP-1693). The server keeps everything; only
 * the archived mark moves. Group chats are archived through the channel service, which owns
 * the chat list.
 */
import { authApi } from "../../services/api";
import type { ProjectProps } from "../../types/tasks";
import { markProjectArchived } from "./archiveState";

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
 * The archived projects the member can open, from the rows of the full list (MIP-1853: each row
 * says whether it is archived). Only projects the member joined: the team list also holds projects
 * they never joined (private ones too), which they cannot open (MIP-1921).
 */
export const archivedJoinedProjects = (all: readonly ProjectProps[]): ProjectProps[] =>
    all.filter((p) => p.archived === true && p.isJoined === true);
