/**
 * People we have seen but do not have a roster for — i.e. everybody from
 * another team.
 *
 * `teamMemberProfiles` is the team's roster and is the right source for
 * anyone in it. It is loaded per team, so it can never hold a colleague of
 * the team that shared a project with you — and cross-team work is full of
 * those: the owner of a shared GM chat, the host's people in its member
 * list, the assignee of a task in a shared project. `useUserProfile`
 * returned `undefined` for every one of them, and a row with no name, no
 * email and a "?" avatar is what that looks like on screen.
 *
 * Widening the roster fetch was the other option and is worse: it would
 * hand every guest the host team's full staff list, which is exactly what
 * a share is supposed not to do. Nothing is fetched here. Payloads the
 * caller is already entitled to read carry these names denormalized
 * (`ChannelMember.user`, a share's participants), and this keeps the ones
 * that go past.
 *
 * Deliberately NOT presence: an external person's online state is not in
 * any payload we get, so they render offline rather than wrongly green.
 */
import { useSyncExternalStore } from "react";

import type { UserProps } from "../../../types/admin";

/** What a denormalized user looks like across the payloads that carry one. */
export type SeenPerson = {
    userId: string | number | null | undefined;
    userName?: string | null;
    userEmail?: string | null;
    email?: string | null;
    avatarImgPath?: string | null;
    avatarUrl?: string | null;
};

const people = new Map<string, UserProps>();
const listeners = new Set<() => void>();

const subscribe = (listener: () => void) => {
    listeners.add(listener);
    return () => listeners.delete(listener);
};

const asProfile = (person: SeenPerson): UserProps => ({
    teamId: "",
    teamName: "",
    userId: String(person.userId),
    userName: person.userName ?? "",
    userEmail: person.userEmail ?? person.email ?? "",
    avatarImgPath: person.avatarImgPath ?? person.avatarUrl ?? "",
    tsLastSeen: "",
    tsJoined: "",
});

const same = (a: UserProps, b: UserProps) =>
    a.userName === b.userName &&
    a.userEmail === b.userEmail &&
    a.avatarImgPath === b.avatarImgPath;

/**
 * Remember everyone in a payload that names them.
 *
 * Safe to call with a whole roster on every fetch: unchanged entries do
 * not notify, so this does not turn a chat sync into a re-render of every
 * avatar on screen. Entries without a name AND without an avatar are
 * skipped — they would displace nothing and resolve to the same blank.
 */
export const rememberPeople = (seen: readonly SeenPerson[] | null | undefined): void => {
    if (!seen || seen.length === 0) return;
    let changed = false;
    for (const person of seen) {
        if (person?.userId == null || person.userId === "") continue;
        const next = asProfile(person);
        if (!next.userName && !next.avatarImgPath && !next.userEmail) continue;
        const current = people.get(next.userId);
        if (current && same(current, next)) continue;
        people.set(next.userId, next);
        changed = true;
    }
    if (changed) for (const listener of listeners) listener();
};

/** The remembered profile, or undefined. Reads without subscribing. */
export const rememberedPerson = (
    userId: string | number | null | undefined
): UserProps | undefined => {
    if (userId == null || userId === "") return undefined;
    return people.get(String(userId));
};

/** Subscribing form, so a row fills in when the payload naming them lands. */
export const useRememberedPerson = (
    userId: string | number | null | undefined
): UserProps | undefined =>
    useSyncExternalStore(subscribe, () =>
        userId == null || userId === "" ? undefined : people.get(String(userId))
    );

/** Tests only. The store is module-level, so it outlives a render tree. */
export const forgetEveryone = (): void => {
    people.clear();
    for (const listener of listeners) listener();
};
