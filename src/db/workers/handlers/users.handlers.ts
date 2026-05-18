// Users-channel handlers. Consolidates the 5 single-purpose user workers
// (addUser, loadTeamMembers, popSpecificUser, popTeamMembers, popTeamUsers).

import { loadTeamMembers } from "../../../features/admin/services/loadTeamMembers";
import type { UserProps } from "../../../types/admin";
import { getLocalCurrentTimestamp } from "../../../utils/dateUtils";
import { UserRepository } from "../../repositories";
import { UserService } from "../../services";
import type { UsersRequests } from "../contracts";
import type { HandlerMap } from "../poolWorker";

const userService = new UserService();
const userRepo = new UserRepository();

const checkIsOnline = (
    myself: UserProps,
    targetUserId: string,
    targetUserTsLastSeen: string
): boolean => {
    if (myself.userId === targetUserId) return true;
    if (!targetUserTsLastSeen) return false;
    const lastSeen = new Date(targetUserTsLastSeen).getTime();
    const now = new Date(getLocalCurrentTimestamp()).getTime();
    const diffInMs = now - lastSeen;
    return diffInMs >= 0 && diffInMs <= 60 * 1000;
};

export const usersHandlers: HandlerMap<UsersRequests> = {
    addUser: async ({ user }) => {
        await userService.saveUser(user);
        return "done";
    },

    loadTeamMembers: async ({ myself, accessToken }) => {
        const memberList: UserProps[] = await loadTeamMembers(myself, accessToken);
        if (memberList?.length) {
            await userRepo.batchInsert(memberList);
        }
        return memberList ?? [];
    },

    popSpecificUser: async ({ userId }) => {
        if (!userId) return null;
        const user = await userService.getUser(userId.toString());
        return user ?? null;
    },

    popTeamMembers: async ({ myself }) => {
        const teamMembers = await userService.getTeamMembers(myself.teamId);
        return teamMembers ?? [];
    },

    popTeamUsers: async ({ myself }) => {
        try {
            const teamMembers: UserProps[] = await userService.getTeamMembers(myself.teamId);
            const allUsers: Record<string, UserProps> = {};
            if (teamMembers?.length) {
                teamMembers.forEach((u) => {
                    allUsers[u.userId] = {
                        ...u,
                        isOnline: checkIsOnline(myself, u.userId, u.tsLastSeen),
                    };
                });
            }
            return allUsers;
        } catch (err) {
            console.error("[users:popTeamUsers]", err);
            return { error: String(err) };
        }
    },
};
