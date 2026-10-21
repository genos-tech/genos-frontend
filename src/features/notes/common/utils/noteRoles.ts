import { NoteRoleMember } from "../../../../types/notes";

/**
 * Note role helpers — single source of truth for "what role does the
 * current user have on the currently loaded note, and may they edit
 * it?".
 *
 * Role ids are the integers defined by the backend and surfaced via
 * `useNM.currentNoteMembers` (see `ModalNoteSharing` for the canonical
 * user-facing labels).
 *
 * `getMyNoteRoleId` returns `null` when the user isn't in the
 * explicit members list — that's the implicit-owner case for a
 * Personal Note that's never been shared, and the editable check
 * treats it as full access.
 */

export const NOTE_ROLE_OWNER = 1;
export const NOTE_ROLE_EDITOR = 2;
export const NOTE_ROLE_VIEWER = 3;

export const getMyNoteRoleId = (members: NoteRoleMember[], myselfUserId: string): number | null =>
    members.find((m) => String(m.userId) === String(myselfUserId))?.roleId ?? null;

export const isNoteEditableForRole = (roleId: number | null): boolean =>
    roleId !== NOTE_ROLE_VIEWER;

/**
 * Whether the editor should accept typing: the explicit role AND the
 * scope the collab server granted the connection (`authorizedScope`).
 *
 * The explicit list misses every role that doesn't come from a
 * `NotePermissionMaster` row: a Team Note folder grant, project or chat
 * membership. The server resolves all of them, and since MIP-714 opens a
 * Viewer's connection `"readonly"` and drops their edits — so a null
 * explicit role must not be read as "editable" once the server has said
 * otherwise. `undefined` (not authenticated yet, or no collab connection)
 * leaves the explicit role in charge.
 */
export const isNoteEditable = (roleId: number | null, collabScope: string | undefined): boolean =>
    isNoteEditableForRole(roleId) && collabScope !== "readonly";
