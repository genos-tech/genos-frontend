import { TaskDependencyRef } from "../../../types/tasks";

/**
 * Does a blocker still hold its task back? (MIP-1549)
 *
 * A blocker is resolved when it reads Closed or Deleted. "Reads" means the status the server's
 * closed-ancestor rule gives it: a blocker under a Closed or Deleted parent, grandparent or
 * milestone reads as Closed or Deleted whatever its own row says (MIP-1413). The server's
 * auto-Blocked flip uses the same rule (api MIP-1544), so the badge, the diagram's blocker count
 * and the task's own status agree.
 *
 * The dependency endpoints send that reading as `effectiveStatus`, next to the blocker's own
 * `status`. It is read from there and never worked out here from the ancestors: a blocker can sit
 * in a project this client has not loaded. A payload without the field (an older server) falls
 * back to the blocker's own status, as before.
 */
const RESOLVED = new Set(["closed", "deleted"]);

/** True when `status` (a blocker's effective or own status) leaves the task blocked. */
export const isOpenBlockerStatus = (status: string | null | undefined): boolean =>
    !RESOLVED.has((status ?? "").toLowerCase());

/** The status a dependency ref's task reads as: the server's reading when it sent one. */
export const refEffectiveStatus = (
    ref: Pick<TaskDependencyRef, "status" | "effectiveStatus">
): string | null | undefined => ref.effectiveStatus ?? ref.status?.status;

/** A `blockedBy` ref that still blocks (its task reads open). */
export const refBlocks = (ref: Pick<TaskDependencyRef, "status" | "effectiveStatus">): boolean =>
    isOpenBlockerStatus(refEffectiveStatus(ref));
