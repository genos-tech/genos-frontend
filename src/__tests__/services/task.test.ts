import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../services/api", () => ({
    authApi: vi.fn(),
    nonAuthApi: vi.fn(),
}));

import { authApi } from "../../services/api";
import { loadTeamTasks } from "../../features/tasks/services/loadTeamTasks";

const mockMyself = {
    teamId: "team1",
    userId: "user1",
    userName: "Test User",
    userEmail: "test@test.com",
    avatarImgPath: "",
    tsLastSeen: "",
    tsJoined: "",
    customStatus: "",
};

describe("loadTeamTasks", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("should call GET /task/getTeamTasks/ with team_id", async () => {
        const mockData = [{ id: "1", title: "Task 1" }];
        const mockGet = vi.fn().mockResolvedValue({ data: mockData });
        (authApi as ReturnType<typeof vi.fn>).mockReturnValue({ get: mockGet });

        const result = await loadTeamTasks(mockMyself, "token123");

        expect(authApi).toHaveBeenCalledWith("token123");
        expect(mockGet).toHaveBeenCalledWith("/task/getTeamTasks/?team_id=team1");
        expect(result).toEqual(mockData);
    });

    it("should return undefined when token is null", async () => {
        (authApi as ReturnType<typeof vi.fn>).mockReturnValue(null);

        const result = await loadTeamTasks(mockMyself, null);
        expect(result).toBeUndefined();
    });

    it("should handle API errors gracefully", async () => {
        const mockGet = vi.fn().mockRejectedValue(new Error("Network error"));
        (authApi as ReturnType<typeof vi.fn>).mockReturnValue({ get: mockGet });

        const result = await loadTeamTasks(mockMyself, "token123");
        expect(result).toBeUndefined();
    });
});
