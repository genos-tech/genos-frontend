import PopTeamMembersWorker from "../../../db/workers/popTeamMembersWorker.ts?worker";
import { UserProps } from "../../../types/admin";

export const popTeamMembers = (myself: UserProps): Promise<UserProps[]> => {
    return new Promise((resolve, reject) => {
        const popTeamMembersWorker = new PopTeamMembersWorker();

        popTeamMembersWorker.postMessage({ myself });

        popTeamMembersWorker.onmessage = (event) => {
            popTeamMembersWorker.terminate();
            // Pin the current user to the top of the list, then sort
            // the rest by display name (case-insensitive, locale-aware
            // so non-ASCII names like "Ångström" / Japanese kana fall
            // where users expect). This is consumed by member pickers
            // (assignee dropdown, mention list, etc.) where surfacing
            // "me" first is the standard UX.
            const members = (event.data as UserProps[]) ?? [];
            const myselfId = String(myself.userId);
            const sorted = [...members].sort((a, b) => {
                const aIsMe = String(a.userId) === myselfId;
                const bIsMe = String(b.userId) === myselfId;
                if (aIsMe && !bIsMe) return -1;
                if (!aIsMe && bIsMe) return 1;
                return (a.userName ?? "").localeCompare(b.userName ?? "", undefined, {
                    sensitivity: "base",
                });
            });
            resolve(sorted);
        };

        popTeamMembersWorker.onerror = (error) => {
            popTeamMembersWorker.terminate();
            console.error(error);
            reject(error);
        };
    });
};
