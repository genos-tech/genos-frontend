import { rememberedPerson } from "../components/ui/avatars/userDirectory";
import { getMessages } from "../i18n/getMessages";
import { isDeletedUser } from "./teamRoster";

/**
 * What the app calls a person whose account was deleted, in the reader's
 * language. Same string every other "Deleted user" surface uses.
 */
export const deletedUserLabel = (): string => getMessages().tasks.messageTemplate.deletedUser;

/**
 * The name to print for a mention node in PLAIN TEXT (inbox and notification
 * previews, a comment's first line, a note export), where no roster is at hand.
 *
 * A mention stores `props.userName` beside `userId`, and that stored copy
 * outlives the person: account deletion anonymises the account, not the text
 * that mentions it. So the stored name is shown only when the client has no
 * proof the account is deleted. Proof is a profile it holds that carries the
 * anonymised marks, or a stored name that already is the anonymised one.
 * "Not known" is not proof: someone who merely left the team keeps their name.
 *
 * Reads the directory without subscribing, like `resolveDisplayName`; chips use
 * that (live, roster-aware) path instead.
 */
export const storedMentionName = (userId: unknown, storedName: string): string => {
    const seen =
        typeof userId === "string" || typeof userId === "number"
            ? rememberedPerson(userId)
            : undefined;
    if ((seen && isDeletedUser(seen)) || isDeletedUser({ userName: storedName })) {
        return deletedUserLabel();
    }
    return storedName;
};
