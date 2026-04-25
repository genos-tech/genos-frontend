import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../services/api", () => ({
    authApi: vi.fn(),
    nonAuthApi: vi.fn(),
}));

import { authApi } from "../../services/api";
import { loadMyTeams } from "../../features/admin/services/loadMyTeams";
import { loadTeamMembers } from "../../features/admin/services/loadTeamMembers";
import { createTeam } from "../../features/admin/services/createTeam";

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

describe("loadMyTeams", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("should call GET /team/getMyTeams/ with user_id", async () => {
        const mockData = [{ team_id: "t1", team_name: "Team 1" }];
        const mockGet = vi.fn().mockResolvedValue({ data: mockData });
        (authApi as ReturnType<typeof vi.fn>).mockReturnValue({ get: mockGet });

        const result = await loadMyTeams("token123", "user1");

        expect(authApi).toHaveBeenCalledWith("token123");
        expect(mockGet).toHaveBeenCalledWith("/team/getMyTeams/?user_id=user1");
        expect(result).toEqual(mockData);
    });

    it("should return undefined and call setErrorMessage when token is null", async () => {
        (authApi as ReturnType<typeof vi.fn>).mockReturnValue(null);

        const setError = vi.fn();
        const result = await loadMyTeams(null, "user1", setError);

        expect(result).toBeUndefined();
        expect(setError).toHaveBeenCalledWith("Unauthorized. Auth toke is not found.");
    });
});

describe("loadTeamMembers", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("should call GET /team/getTeamMembers/ with correct query", async () => {
        const mockData = [{ userId: "u1", userName: "User 1" }];
        const mockGet = vi.fn().mockResolvedValue({ data: mockData });
        (authApi as ReturnType<typeof vi.fn>).mockReturnValue({ get: mockGet });

        const result = await loadTeamMembers(mockMyself, "token123");

        expect(mockGet).toHaveBeenCalledWith(
            "/team/getTeamMembers/?team_id=team1&team_name=Team One&user_id=user1"
        );
        expect(result).toEqual(mockData);
    });

    it("should return undefined when token is null", async () => {
        (authApi as ReturnType<typeof vi.fn>).mockReturnValue(null);

        const result = await loadTeamMembers(mockMyself, null);
        expect(result).toBeUndefined();
    });
});

describe("createTeam", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("should call POST /team/create/ with team data", async () => {
        const mockData = { team_id: "new-team-id", team_name: "New Team" };
        const mockPost = vi.fn().mockResolvedValue({ data: mockData });
        (authApi as ReturnType<typeof vi.fn>).mockReturnValue({ post: mockPost });

        const result = await createTeam("token123", "New Team", "user1");

        expect(mockPost).toHaveBeenCalledWith("/team/create/", {
            team_name: "New Team",
            team_email: "New Team@genos.tech",
            owner_id: "user1",
        });
        expect(result).toEqual(mockData);
    });

    it("should return undefined and call setErrorMessage when token is null", async () => {
        (authApi as ReturnType<typeof vi.fn>).mockReturnValue(null);

        const setError = vi.fn();
        const result = await createTeam(null, "Team", "user1", setError);

        expect(result).toBeUndefined();
        expect(setError).toHaveBeenCalledWith("Unauthorized. Auth toke is not found.");
    });

    it("should call setErrorMessage on 400 error", async () => {
        const mockPost = vi.fn().mockRejectedValue({
            isAxiosError: true,
            response: { status: 400, data: { error: "duplicate" } },
        });
        (authApi as ReturnType<typeof vi.fn>).mockReturnValue({ post: mockPost });

        const axios = await import("axios");
        vi.spyOn(axios.default, "isAxiosError").mockReturnValue(true);

        const setError = vi.fn();
        await createTeam("token123", "Dup Team", "user1", setError);

        expect(setError).toHaveBeenCalledWith("Please try with different team name.");
    });
});
