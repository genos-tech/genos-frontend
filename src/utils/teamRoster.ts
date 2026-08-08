/**
 * The roster, minus the other teams' people in it.
 *
 * The roster is the client's people directory, so it deliberately includes
 * anyone a cross-team share put you on an object with: that is what lets
 * their name, face and team show up wherever they appear. It does NOT make
 * them yours to hand things to. Access across a team boundary comes from a
 * share and the participants the other team admits to it — never from
 * adding someone to your chat, folder or project, which the server refuses
 * and which would read to the person doing it as a bug in the picker.
 *
 * So: every "add / invite someone" list filters through here. Lists that
 * merely NAME people (mentions, assignee cells, filters, search) must not
 * — that is the blank-avatar problem this whole feature exists to fix.
 *
 * Generic over the row rather than typed to `UserProps`, because the roster
 * reaches the sharing surfaces as a three-field subset of it and they need
 * this rule just as much.
 */
export const ownTeamOnly = <T extends { isExternal?: boolean }>(members: T[]): T[] =>
    members.filter((m) => m.isExternal !== true);

/**
 * A deleted account, recognised from the marks the server stamps on it.
 *
 * Deleting an account doesn't drop the person's rows — the work they did
 * with others has to stay attributed — it ANONYMISES them: the username
 * becomes the literal "Deleted user" and the email is reissued under the
 * `@deleted.invalid` domain (`origin/services/account_deletion.py`). The
 * client never receives an `isDeleted` flag on a user object — it's a
 * tombstone signal on the sync channel that the cache acts on and then
 * strips — so those two anonymised marks ARE the client-side signal.
 *
 * The email suffix is the reliable one (a fixed, server-controlled
 * domain); the username is a fallback for rows that reach a picker with
 * no email. Both spellings of the fields are accepted because the roster
 * shape (`userEmail`/`userName`) and the task-assignee shape
 * (`email`/`name`) both flow through member pickers.
 */
const DELETED_EMAIL_SUFFIX = "@deleted.invalid";
const DELETED_USERNAME = "Deleted user";

export const isDeletedUser = (member: {
    userEmail?: string | null;
    userName?: string | null;
    email?: string | null;
    name?: string | null;
}): boolean => {
    const email = (member.userEmail ?? member.email ?? "").toLowerCase();
    const name = member.userName ?? member.name ?? "";
    return email.endsWith(DELETED_EMAIL_SUFFIX) || name === DELETED_USERNAME;
};

/**
 * The roster, minus anyone whose account has been deleted.
 *
 * A gone person shouldn't appear in a list of people, so every member
 * list and member picker filters through here. Unlike `ownTeamOnly` this
 * is safe on NAMING surfaces too — a deleted account has nothing to name.
 */
export const withoutDeletedUsers = <T extends Parameters<typeof isDeletedUser>[0]>(
    members: T[]
): T[] => members.filter((m) => !isDeletedUser(m));
