/**
 * The text a person-picker shows for one person: `Name`, `Name (You)`, and the
 * email after a dash when there is one.
 *
 * "Is this me" is decided by `userId`, never by email. An email is not an
 * identity: `myself.userEmail` is empty until the private profile has hydrated
 * (it is memory-only since MIP-619), and a roster row can lack one, so two
 * blanks compared equal and a teammate was badged "(You)". The pickers each
 * carried their own copy of the comparison; this is the one they share.
 */
export const personLabel = (
    person: { userId?: string | null; userName: string; userEmail?: string | null },
    myUserId: string | null | undefined,
    youSuffix: string
): string => {
    const isMe = !!myUserId && !!person.userId && person.userId === myUserId;
    const name = isMe ? `${person.userName} ${youSuffix}` : person.userName;
    return person.userEmail ? `${name} - ${person.userEmail}` : name;
};
