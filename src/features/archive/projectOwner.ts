/**
 * Whether the signed-in person owns the project that is open (MIP-1693).
 *
 * The task-field rules carry the project's owner. They load per project, so until they arrive
 * for THIS project nothing here claims ownership: a menu item stays hidden rather than offered
 * to a person who may not own it. The API still decides; this only chooses what is offered.
 */
export const isOwnerOfProject = (
    rules: { projectId: number; ownerUserId?: string | null } | null | undefined,
    projectId: number | null | undefined,
    userId: string | null | undefined
): boolean =>
    rules != null &&
    projectId != null &&
    rules.projectId === projectId &&
    rules.ownerUserId != null &&
    rules.ownerUserId === userId;
