import { createFilterOptions } from "@mui/joy/Autocomplete";

/**
 * The text a person-picker shows for one person: `Name` or `Name (You)`. Never the
 * email (MIP-1703): in a company of 100+ every colleague's address would be listed
 * to everyone. A person's email is on their profile.
 *
 * "Is this me" is decided by `userId`, never by email. An email is not an
 * identity: `myself.userEmail` is empty until the private profile has hydrated
 * (it is memory-only since MIP-619), and a roster row can lack one, so two
 * blanks compared equal and a teammate was badged "(You)". The pickers each
 * carried their own copy of the comparison; this is the one they share.
 */
export const personLabel = (
    person: { userId?: string | null; userName: string },
    myUserId: string | null | undefined,
    youSuffix: string
): string => {
    const isMe = !!myUserId && !!person.userId && person.userId === myUserId;
    return isMe ? `${person.userName} ${youSuffix}` : person.userName;
};

/**
 * What typing in a person picker matches: the name AND the email, although only the name is
 * shown (MIP-1703). Typing a colleague's address still finds them; the address is not
 * displayed. An Autocomplete filters on `getOptionLabel` by default, so a picker that
 * stopped showing the email there would silently stop matching it too.
 */
type Searchable = { userName: string; userEmail?: string | null };

const filterByNameAndEmail = createFilterOptions<Searchable>({
    stringify: (person) => `${person.userName} ${person.userEmail ?? ""}`,
});

export const personFilterOptions = <T extends Searchable>(
    options: T[],
    state: { inputValue: string; getOptionLabel: (option: T) => string }
): T[] =>
    filterByNameAndEmail(options, {
        inputValue: state.inputValue,
        getOptionLabel: (option) => state.getOptionLabel(option as T),
    }) as T[];
