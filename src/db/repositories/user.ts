import { UserProps } from "../../types/admin";
import { INDEX_NAMES, STORES } from "../config";
import { BatchOperationResult, OperationResult } from "../types";
import { BaseRepository } from "./base";

/**
 * A teammate as the roster stores them: without their phone number.
 *
 * The roster sits in IndexedDB, which outlives sign-out until the next user
 * switch, so on a shared or lost device it would hold the whole team's phone
 * numbers (MIP-768). The profile card does not need them stored: opening it
 * re-fetches the member's authoritative row (`getTeamMemberInfo`, which carries
 * the phone) and overlays it on the roster row. Enforced here, at the one place
 * that writes the store, so no write path (the roster load, a presence beat,
 * anything added later) can put one back.
 *
 * `userEmail` is NOT stripped: 61 files read it, several as an identity key.
 */
export const withoutStoredPhone = (user: UserProps): UserProps => {
    if (!("phoneNumber" in user)) return user;
    const { phoneNumber: _dropped, ...rest } = user;
    return rest;
};

// Whether a stored row still has something to remove. A row that carries the
// key with no value (`phoneNumber: undefined`, which IndexedDB keeps) holds no
// phone number, so sweeping it would only rewrite it on every load.
const holdsAPhone = (user: UserProps): boolean => Boolean(user.phoneNumber);

// User repository for managing user data
export class UserRepository extends BaseRepository<UserProps> {
    constructor() {
        super(STORES.USER_INFO);
    }

    // Get user by ID
    async getUser(userId: string): Promise<UserProps | null> {
        const result = await this.get(userId);
        return result.success && result.data ? result.data : null;
    }

    // Get all users
    async getAllUsers(): Promise<UserProps[]> {
        const result = await this.getAll();
        return result.success && result.data ? result.data : [];
    }

    // Get team members by team ID
    async getTeamMembers(teamId: string): Promise<UserProps[]> {
        try {
            const db = await this.getDB();
            const tx = db.transaction(this.storeName, "readonly");
            const store = tx.objectStore(this.storeName);
            const index = store.index(INDEX_NAMES.USER_INFO);
            const members = await index.getAll(teamId);
            return members;
        } catch {
            return [];
        }
    }

    // Every write path into the store goes through these three, so the phone
    // number is dropped here and nowhere else needs to remember to.
    override async add(user: UserProps): Promise<OperationResult<UserProps>> {
        return super.add(withoutStoredPhone(user));
    }

    override async put(user: UserProps): Promise<OperationResult<UserProps>> {
        return super.put(withoutStoredPhone(user));
    }

    override async batchInsert(users: UserProps[]): Promise<BatchOperationResult> {
        return super.batchInsert(users.map(withoutStoredPhone));
    }

    /**
     * Rewrite every stored row without its phone number: the one-time cleanup
     * for rows written before this change. Idempotent, and cheap when there is
     * nothing to do (it only writes rows that still carry one). Returns how many
     * rows it rewrote.
     */
    async stripStoredPhones(): Promise<number> {
        const all = await this.getAllUsers();
        const dirty = all.filter(holdsAPhone);
        if (dirty.length === 0) return 0;
        const result = await super.batchInsert(dirty.map(withoutStoredPhone));
        return result.inserted;
    }

    // Add or update user
    async saveUser(user: UserProps): Promise<boolean> {
        const result = await this.put(user);
        return result.success;
    }

    // Delete user
    async deleteUser(userId: string): Promise<boolean> {
        const result = await this.delete(userId);
        return result.success;
    }

    // Check if user exists
    async userExists(userId: string): Promise<boolean> {
        return this.exists(userId);
    }
}
