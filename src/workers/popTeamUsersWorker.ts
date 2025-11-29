import { UserService } from "../db/services/user.service";
import { UserProps } from "../types/admin";
import { getLocalCurrentTimestamp } from "../utils/dateUtils";

const checkIsOnline = (
    myself: UserProps,
    targetUserId: string,
    targetUserTsLastSeen: string
): boolean => {
    const lastSeen = new Date(targetUserTsLastSeen).getTime();
    const now = new Date(getLocalCurrentTimestamp()).getTime();
    if (myself.userId === targetUserId) {
        return true;
    } else if (targetUserTsLastSeen && targetUserTsLastSeen !== "") {
        const diffInMs = now - lastSeen;
        return diffInMs >= 0 && diffInMs <= 60 * 1000; // within 1 min
    } else {
        return false;
    }
};

self.onmessage = async (event) => {
    try {
        const myself: UserProps = event.data.myself;
        const userService = new UserService();
        const teamMembers: UserProps[] = await userService.getTeamMembers(myself.teamId);

        const allUsers: Record<string, UserProps> = {};

        if (teamMembers && teamMembers.length > 0) {
            teamMembers.forEach((user) => {
                allUsers[user.userId] = {
                    ...user,
                    isOnline: checkIsOnline(myself, user.userId, user.tsLastSeen),
                };
            });
        }

        self.postMessage(allUsers);
    } catch (err) {
        console.error("Worker error:", err);
        self.postMessage({ error: String(err) });
    }
};

export {};
