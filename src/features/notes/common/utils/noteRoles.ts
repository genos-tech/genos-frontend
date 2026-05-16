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
