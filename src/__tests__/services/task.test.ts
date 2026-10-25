import { beforeEach, describe, expect, it, vi } from "vitest";

import { loadTeamTasks } from "../../features/tasks/services/loadTeamTasks";
import { authApi } from "../../services/api";

vi.mock("../../services/api", () => ({
    authApi: vi.fn(),
    nonAuthApi: vi.fn(),
}));

const mockMyself = {
    teamId: "team1",
    teamName: "Team One",
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

    // The paged route (MIP-807). Paging and the fallback to the old route are
    // covered in teamTasksPaging.test.ts.
    it("should call GET /task/getTeamTasksPage/ with team_id and a page size", async () => {
        const mockData = [{ id: "1", title: "Task 1" }];
        const mockGet = vi.fn().mockResolvedValue({
            data: { tasks: mockData, has_more: false, next_cursor: null },
        });
        (authApi as ReturnType<typeof vi.fn>).mockReturnValue({ get: mockGet });

        const result = await loadTeamTasks(mockMyself, "token123");

        expect(authApi).toHaveBeenCalledWith("token123");
        expect(mockGet).toHaveBeenCalledWith("/task/getTeamTasksPage/?team_id=team1&limit=500");
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
