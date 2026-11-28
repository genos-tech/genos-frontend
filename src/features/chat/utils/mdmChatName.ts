import { resolveDisplayName } from "../../../components/ui/avatars/avatarContextHelpers";
import { UserProps } from "../../../types/admin";
import { MDMMemberProps } from "../../../types/chat";

// A multi-person DM stores no title: its name is its members' names. Each is resolved live so a
// rename (including your own) shows instead of the cached member name.
export const mdmChatName = (
    members: MDMMemberProps[] | undefined,
    myself: UserProps | undefined,
    teamMemberProfiles: Record<string, UserProps> | undefined
): string =>
    members
        ?.map((m) => resolveDisplayName(m.userId, m.userName, myself, teamMemberProfiles))
        .join(", ") ?? "";
