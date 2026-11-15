import { fmt, getMessages } from "../../../i18n";
import { UserProps } from "../../../types/admin";

// genos-api answers a save that names a collaborator who could not open the
// task with HTTP 400 and (MIP-1567):
//   {"error": "`collaborators`: '<user id>' is not a member of this project,
//              so they could not open the task. Add them to the project first."}
// The picker no longer offers such people, so this only happens on a race (a
// member removed since the roster was read) or a stale form.
const COLLABORATOR_REFUSAL =
    /^`collaborators`:\s*['"]([^'"]+)['"] is not a member of this project, so they could not open the task/;

/** The id of the collaborator the server refused, or `null` when
 *  `serverText` is some other sentence. */
export const refusedCollaboratorId = (serverText: string | null | undefined): string | null =>
    (serverText ? COLLABORATOR_REFUSAL.exec(serverText)?.[1] : null) ?? null;

/**
 * What to show for that refusal: the same sentence with the person's NAME
 * instead of their id, in the UI language. `null` when `serverText` is some
 * other sentence or the person is not among `collaborators`, so the caller
 * shows the server's own words as before.
 */
export const collaboratorRefusalText = (
    serverText: string | null | undefined,
    collaborators: ReadonlyArray<Pick<UserProps, "userId" | "userName">> | undefined
): string | null => {
    const match = serverText ? COLLABORATOR_REFUSAL.exec(serverText) : null;
    if (!match) return null;
    const id = match[1].toLowerCase();
    const person = (collaborators ?? []).find((c) => String(c.userId).toLowerCase() === id);
    if (!person?.userName) return null;
    return fmt(getMessages().tasks.errors.collaboratorNotOnProject, { name: person.userName });
};
