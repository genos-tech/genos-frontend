import { UserProps } from "../../../types/admin";
import { deletedUserLabel } from "../../../utils/mentionName";
import { isDeletedUser } from "../../../utils/teamRoster";
import { rememberedPerson } from "./userDirectory";

/**
 * Live display name for a user id, falling back to a cached name.
 *
 * Names are denormalized at write time — `message.sender.userName`,
 * `chat.mdmMembers[].userName`, mention props, `comment.senderName`, task
 * `assigneeName`, etc. — so a profile rename never retroactively rewrites
 * those stored strings. This resolves the *current* name at render instead
 * (self via `myself`, others via `teamMemberProfiles`), falling back to the
 * stored name when the user isn't in either source.
 *
 * Pure (not a hook) so it can run inside `.map()` callbacks: read `myself` /
 * `teamMemberProfiles` once at the component top and pass them in.
 */
export const resolveDisplayName = (
    userId: string | number | null | undefined,
    fallbackName: string,
    myself: UserProps | undefined,
    teamMemberProfiles: Record<string, UserProps> | undefined
): string => {
    if (userId == null || userId === "") return fallbackName;
    const idStr = String(userId);
    if (myself && idStr === String(myself.userId)) return myself.userName || fallbackName;
    // The roster, then somebody from another team whom no roster here can
    // name. The directory is read without subscribing: this is a pure
    // function so it can run in a `.map()`.
    //
    // A profile we HOLD that carries the anonymised marks is a deleted
    // account, and reads as the localised "Deleted user" (the stored `userName`
    // inside a mention or message is the real name it had when typed, which
    // account deletion must not leave on screen). An id we hold no profile for
    // proves nothing (it may be someone who just left the team), so it keeps
    // the stored name below, unless that stored name is itself the anonymised
    // one.
    for (const profile of [teamMemberProfiles?.[idStr], rememberedPerson(idStr)]) {
        if (!profile) continue;
        if (isDeletedUser(profile)) return deletedUserLabel();
        if (profile.userName) return profile.userName;
    }
    return isDeletedUser({ userName: fallbackName }) ? deletedUserLabel() : fallbackName;
};
