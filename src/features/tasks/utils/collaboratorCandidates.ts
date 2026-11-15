import { UserProps } from "../../../types/admin";

/**
 * Who may be put on a task as a COLLABORATOR (MIP-1567, mirrors genos-api's
 * `may_collaborate`): someone who can open the task. That is a member or the
 * owner of its project, or the person who holds it as assignee or reporter.
 * Being on the team is NOT enough, although it is for the assignee and the
 * reporter fields themselves: a teammate off the project would be refused
 * (HTTP 400 on a save, silently dropped on a create).
 *
 * `holderIds` is the assignee and reporter the task will have: the server
 * counts the ones sent in the same save. A milestone passes none, because
 * its collaborators are judged on project membership alone.
 *
 * `memberIds` is `null` while the project's roster is not known. The rule
 * then fails CLOSED to the holders and the owner: offering the whole team in
 * the meantime is the bug itself, not a placeholder for it.
 */
export const allowedCollaboratorIds = (input: {
    memberIds: readonly string[] | null;
    ownerUserId?: string | null;
    holderIds: ReadonlyArray<string | null | undefined>;
}): Set<string> => {
    const allowed = new Set<string>();
    for (const id of input.memberIds ?? []) allowed.add(String(id));
    if (input.ownerUserId) allowed.add(String(input.ownerUserId));
    for (const id of input.holderIds) if (id) allowed.add(String(id));
    return allowed;
};

/**
 * `selected` without the people the rule does not admit: the one filter the
 * picker applies on a task being created and the one a project move applies
 * to the working copy, so the two cannot drift apart.
 */
export const keepAllowedCollaborators = <T extends { userId: string }>(
    selected: readonly T[],
    allowed: ReadonlySet<string>
): T[] => selected.filter((user) => allowed.has(String(user.userId)));

/**
 * The picker's options: the team members who are allowed, plus everyone
 * already chosen.
 *
 * Keeping the chosen in the list is what lets existing data that the rule
 * would not admit today (a teammate listed before it held, or one who left
 * the project) stay visible and removable: the picker has to be able to
 * render them. Once removed they are no longer chosen, so they fall out of
 * the options and cannot be added back.
 */
export const collaboratorOptions = (input: {
    teamMembers: readonly UserProps[];
    allowed: ReadonlySet<string>;
    selected: readonly UserProps[];
}): UserProps[] => {
    const seen = new Set<string>();
    const out: UserProps[] = [];
    const take = (user: UserProps) => {
        if (seen.has(user.userId)) return;
        seen.add(user.userId);
        out.push(user);
    };
    for (const member of input.teamMembers) {
        if (input.allowed.has(member.userId)) take(member);
    }
    for (const user of input.selected) take(user);
    return out;
};

/**
 * The `holderIds` of `allowedCollaboratorIds` for one form: the assignee and
 * reporter as the form holds them (the server judges the ones sent in the
 * same save), none for a milestone.
 */
export const collaboratorHolderIds = (input: {
    isMilestone?: boolean;
    assigneeId?: string | null;
    reporterId?: string | null;
}): string[] =>
    input.isMilestone
        ? []
        : [input.assigneeId, input.reporterId].filter((id): id is string => !!id);
