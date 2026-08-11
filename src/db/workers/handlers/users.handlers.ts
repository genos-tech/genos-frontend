// Users-channel handlers. Consolidates the 5 single-purpose user workers
// (addUser, loadTeamMembers, popSpecificUser, popTeamMembers, popTeamUsers).

import { loadTeamMembers } from "../../../features/admin/services/loadTeamMembers";
import type { UserProps } from "../../../types/admin";
import { getLocalCurrentTimestamp } from "../../../utils/dateUtils";
import { isDeletedUser } from "../../../utils/teamRoster";
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

// Which team a stored row belongs to, and what it says about the person's
// own team, are the roster's answers — never a heartbeat's.
//
// A heartbeat carries the SENDER's `myself`, so its `teamId` is whichever
// team that person is looking at right now. Written straight over the
// stored row (one row per `userId`, keyed on it, indexed by `teamId`) it
// moves them off the roster they were read from: `getTeamMembers(myTeam)`
// stops returning them and every avatar drawn from that roster goes blank
// until the next full roster load. For someone from another team that is
// the common case rather than an edge one — their `myself` says their own
// team, and the row saying so drops them out of mine, along with the
// `isExternal` / `homeTeam*` fields that told the UI they were a guest at
// all.
//
// `timezone` needs the same protection, for a narrower reason. A beat
// carries the sender's `myself`, and `myself` has no `timezone` key at
// all — it is browser-derived and deliberately never mirrored into the
// identity object (see `useAuth`). So EVERY beat, including the sender's
// own, arrives with `timezone` undefined; spreading it over the stored
// row dropped the field, and the profile card's location and local-time
// rows (which resolve `currentLocation or timezone`) went blank within
// one beat — ≤60s — of a full roster load. The roster is the authority
// on it, so carry the stored value through.
//
// The OTHER profile fields (`currentLocation`, `aboutMe`, `role`, …) are
// deliberately NOT pinned here: they DO ride the beat via `...myself`, so
// the beat is the sender describing themselves with their current values,
// which is exactly what should win — pinning the stored copy instead would
// make a user's own profile edit invisible to teammates until the next
// roster poll.
const withStoredIdentity = async (user: UserProps): Promise<UserProps> => {
    const stored = await userService.getUser(user.userId);
    if (!stored) return user;
    return {
        ...user,
        teamId: stored.teamId,
        teamName: stored.teamName,
        memberRole: stored.memberRole,
        isExternal: stored.isExternal,
        homeTeamId: stored.homeTeamId,
        homeTeamName: stored.homeTeamName,
        homeTeamImgPath: stored.homeTeamImgPath,
        timezone: stored.timezone,
    };
};

export const usersHandlers: HandlerMap<UsersRequests> = {
    // Presence only (the `userStatus` socket message is the sole caller).
    addUser: async ({ user }) => {
        await userService.saveUser(await withStoredIdentity(user));
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
                    // Evict on the incremental tombstone, and also when a
                    // row arrives already anonymised (`Deleted user` /
                    // `@deleted.invalid`) — a dead account should never
                    // reach the cache regardless of which signal carries it.
                    if (m.isDeleted || isDeletedUser(m)) {
                        await userRepo.delete(m.userId);
                    } else {
                        const { isDeleted: _ignored, ...rest } = m;
                        toUpsert.push(rest);
                    }
                }
                for (let i = 0; i < toUpsert.length; i += BATCH_SIZE) {
                    await userRepo.batchInsert(toUpsert.slice(i, i + BATCH_SIZE));
                }
                // A full load is an authoritative live snapshot — the
                // server omits deleted users from it entirely, so a row
                // anonymised AFTER it was last cached never gets an
                // eviction tombstone and would otherwise linger forever.
                // Sweep those ghosts here. Only anonymised (dead) rows are
                // dropped, so the cross-team live entries the store is kept
                // un-wiped to preserve are untouched.
                if (!hadCheckpoint) {
                    const cached = await userRepo.getAllUsers();
                    for (const u of cached) {
                        if (isDeletedUser(u)) {
                            await userRepo.delete(u.userId);
                        }
                    }
                }
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
