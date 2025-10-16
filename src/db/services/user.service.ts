import { UserRepository } from "../repositories";
import { User } from "../types";

// User service for business logic related to users
export class UserService {
    private userRepo: UserRepository;

    constructor() {
        this.userRepo = new UserRepository();
    }

    // Get user by ID
    async getUser(userId: string): Promise<User | null> {
        return this.userRepo.getUser(userId);
    }

    // Get all users
    async getAllUsers(): Promise<User[]> {
        return this.userRepo.getAllUsers();
    }

    // Get team members by team ID
    async getTeamMembers(teamId: string): Promise<User[]> {
        return this.userRepo.getTeamMembers(teamId);
    }

    // Add or update user
    async saveUser(user: User): Promise<boolean> {
        return this.userRepo.saveUser(user);
    }

    // Delete user
    async deleteUser(userId: string): Promise<boolean> {
        return this.userRepo.deleteUser(userId);
    }

    // Check if user exists
    async userExists(userId: string): Promise<boolean> {
        return this.userRepo.userExists(userId);
    }

    // Get user by email (if email is stored)
    async getUserByEmail(email: string): Promise<User | null> {
        const users = await this.getAllUsers();
        return users.find((user) => user.userEmail === email) || null;
    }

    // Search users by name
    async searchUsersByName(searchTerm: string): Promise<User[]> {
        const users = await this.getAllUsers();
        return users.filter((user) =>
            user.userName.toLowerCase().includes(searchTerm.toLowerCase())
        );
    }

    // Get users by multiple IDs
    async getUsersByIds(userIds: string[]): Promise<User[]> {
        const users = await Promise.all(userIds.map((id) => this.getUser(id)));
        return users.filter((user) => user !== null) as User[];
    }
}
