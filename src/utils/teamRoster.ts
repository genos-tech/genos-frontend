import { UserProps } from "../types/admin";

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
 */
export const ownTeamOnly = (members: UserProps[]): UserProps[] =>
    members.filter((m) => m.isExternal !== true);
