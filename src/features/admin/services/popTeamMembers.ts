import { usersChannel } from "../../../db/workers/channels";
import { UserProps } from "../../../types/admin";

// Loads the team members through the persistent users channel and post-
// sorts: pin the current user to the top, then sort the rest by display
// name (locale-aware, case-insensitive). This is the contract callers
// (assignee dropdown, mention list, etc.) rely on.
export const popTeamMembers = async (myself: UserProps): Promise<UserProps[]> => {
    const members = (await usersChannel.request("popTeamMembers", { myself })) ?? [];
    const myselfId = String(myself.userId);
    return [...members].sort((a, b) => {
        const aIsMe = String(a.userId) === myselfId;
        const bIsMe = String(b.userId) === myselfId;
        if (aIsMe && !bIsMe) return -1;
        if (!aIsMe && bIsMe) return 1;
        return (a.userName ?? "").localeCompare(b.userName ?? "", undefined, {
            sensitivity: "base",
        });
    });
};
