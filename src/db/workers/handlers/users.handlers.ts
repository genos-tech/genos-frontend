// Users-channel handlers. Consolidates the 5 single-purpose user workers
// (addUser, loadTeamMembers, popSpecificUser, popTeamMembers, popTeamUsers).

import { loadTeamMembers } from "../../../features/admin/services/loadTeamMembers";
import type { UserProps } from "../../../types/admin";
import { getLocalCurrentTimestamp } from "../../../utils/dateUtils";
import { UserRepository } from "../../repositories";
import { UserService } from "../../services";
import type { UsersRequests } from "../contracts";
import type { HandlerMap } from "../poolWorker";
import { syncWithCheckpoint } from "../utils/syncWithCheckpoint";

const BATCH_SIZE = 1000;
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
    },

    loadTeamMembers: async ({ myself, accessToken }) => {
        // For backward compatibility (callers expect the list back to
        // detect "no team members were loaded" failures), capture the
        // current set after the sync completes and return it.
        await syncWithCheckpoint({
            key: "teamMembers",
            fetcher: async (since) => {
                const response = await loadTeamMembers(myself, accessToken, since);
                if (!response) {
                    throw new Error("Failed to load team members");
                }
                return {
                    serverTime: response.serverTime,
                    data: response.members,
                    forceFull: response.forceFull,
                };
            },
            applier: async (members, hadCheckpoint) => {
                // USER_INFO is intentionally excluded from team-scoped
                // wipe (it spans teams for offline access), so a full
                // load just upserts without clearing — preserves entries
                // from other teams. This matches the existing legacy
                // behavior.
                const toUpsert: UserProps[] = [];
                for (const m of members) {
                    if (m.isDeleted) {
                        await userRepo.delete(m.userId);
                    } else {
                        const { isDeleted: _ignored, ...rest } = m;
                        toUpsert.push(rest);
                    }
                }
                for (let i = 0; i < toUpsert.length; i += BATCH_SIZE) {
                    await userRepo.batchInsert(toUpsert.slice(i, i + BATCH_SIZE));
                }
                void hadCheckpoint;
            },
        });
        return await userService.getTeamMembers(myself.teamId);
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
