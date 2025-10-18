import { UserProps } from "../../types/admin";
import { INDEX_NAMES, STORES } from "../config";
import { BaseRepository } from "./base";

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
