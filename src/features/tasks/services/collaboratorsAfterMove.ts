import { UserProps } from "../../../types/admin";
import { TaskProps } from "../../../types/tasks";
import {
    allowedCollaboratorIds,
    collaboratorHolderIds,
    keepAllowedCollaborators,
} from "../utils/collaboratorCandidates";
import { loadProjectMemberIds } from "./loadProjectMemberIds";
import { loadProjectTaskFieldRules } from "./projectTaskFieldRules";

/**
 * Who is still a collaborator of `task` after the save that MOVED it to
 * another project (MIP-1587).
 *
 * genos-api drops the collaborators who cannot open the task in the
 * destination (project member or owner, the task's assignee, its reporter).
 * The working copy still lists them, and the next save that re-sends one is
 * refused as a person newly added who is not on the project (HTTP 400).
 * `task` is the working copy as it was saved: its project is the
 * destination.
 *
 * In order of preference:
 *   1. the save's own answer, `task.collaborators` (the ids the server holds
 *      for the task once the move is done), when it carries one;
 *   2. the picker's rule (`allowedCollaboratorIds`) over the destination's
 *      roster and owner, read now.
 *
 * `null` means it could not be told (the answer has no list and the roster
 * or the owner could not be read): the caller leaves the copy alone, and the
 * refusal handling in `useSendUpdatedTask` still drops the person if a later
 * save is refused. Never throws.
 */
export const collaboratorsAfterMove = async (input: {
    myself: UserProps;
    accessToken: string | null;
    task: TaskProps;
    /** `response.data.task.collaborators` of the save, when there is one. */
    storedCollaboratorIds?: unknown;
}): Promise<UserProps[] | null> => {
    const sent = input.task.collaborators ?? [];
    if (sent.length === 0) return sent;

    // The answer's list is the primary key array DRF writes for the M2M. Any
    // other shape (objects, mixed entries) is not understood, so it counts as
    // "no list" rather than as "nobody is left".
    const { storedCollaboratorIds } = input;
    if (
        Array.isArray(storedCollaboratorIds) &&
        storedCollaboratorIds.every((id) => typeof id === "string" || typeof id === "number")
    ) {
        const stored = new Set(storedCollaboratorIds.map((id) => String(id).toLowerCase()));
        return sent.filter((c) => stored.has(String(c.userId).toLowerCase()));
    }

    const projectId = input.task.project?.projectId;
    if (projectId == null) return null;
    try {
        const [memberIds, rules] = await Promise.all([
            loadProjectMemberIds(projectId, input.accessToken),
            loadProjectTaskFieldRules(input.myself, projectId, input.accessToken),
        ]);
        // Fail CLOSED on "not known": a roster that failed to load is not an
        // empty project, and the owner may hold no membership row.
        if (memberIds === null || rules === null) return null;
        const allowed = allowedCollaboratorIds({
            memberIds,
            ownerUserId: rules.ownerUserId,
            holderIds: collaboratorHolderIds({
                assigneeId: input.task.assignee?.userId,
                reporterId: input.task.reporter?.userId,
            }),
        });
        return keepAllowedCollaborators(sent, allowed);
    } catch {
        return null;
    }
};
