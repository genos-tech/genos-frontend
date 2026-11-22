import { beforeEach, describe, expect, it, vi } from "vitest";

import { createTeam } from "../../features/admin/services/createTeam";
import { findTeam } from "../../features/admin/services/findTeam";
import { loadMyTeams } from "../../features/admin/services/loadMyTeams";
import { loadTeamMembers } from "../../features/admin/services/loadTeamMembers";
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
        expect(setError).toHaveBeenCalledWith("Unauthorized. Authentication token was not found.");
    });
});

describe("loadTeamMembers", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("should call GET /team/getTeamMembers/ with correct query", async () => {
        const mockMembers = [{ userId: "u1", userName: "User 1" }];
        const mockResponse = {
            server_time: "2026-05-25T12:00:00Z",
            data: { members: mockMembers },
        };
        const mockGet = vi.fn().mockResolvedValue({ data: mockResponse });
        (authApi as ReturnType<typeof vi.fn>).mockReturnValue({ get: mockGet });

        const result = await loadTeamMembers(mockMyself, "token123", null);

        // The roster is requested a page at a time (MIP-805); `limit` is the page
        // size and there is no `cursor` on the first request.
        expect(mockGet).toHaveBeenCalledWith(
            "/team/getTeamMembers/?team_id=team1&team_name=Team One&user_id=user1&limit=200"
        );
        expect(result).toEqual({
            serverTime: "2026-05-25T12:00:00Z",
            members: mockMembers,
            // An answer without the key (an older API) is an empty list.
            deletedUserIds: [],
        });
    });

    it("should return undefined when token is null", async () => {
        (authApi as ReturnType<typeof vi.fn>).mockReturnValue(null);

        const result = await loadTeamMembers(mockMyself, null, null);
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
            team_email: expect.stringMatching(/^new-team-[a-z0-9]{6}@teams\.genosai\.dev$/),
            owner_id: "user1",
        });
        expect(result).toEqual(mockData);
    });

    it("should return undefined and call setErrorMessage when token is null", async () => {
        (authApi as ReturnType<typeof vi.fn>).mockReturnValue(null);

        const setError = vi.fn();
        const result = await createTeam(null, "Team", "user1", setError);

        expect(result).toBeUndefined();
        expect(setError).toHaveBeenCalledWith({
            field: "form",
            message: "Unauthorized. Authentication token was not found.",
        });
    });

    it("sends the departments, and only when some are named", async () => {
        const mockPost = vi.fn().mockResolvedValue({ data: {} });
        (authApi as ReturnType<typeof vi.fn>).mockReturnValue({ post: mockPost });

        await createTeam("token123", "Acme", "user1", undefined, true, ["Payments", "Billing"]);
        expect(mockPost.mock.calls[0][1]).toMatchObject({
            with_starter: true,
            departments: ["Payments", "Billing"],
        });

        await createTeam("token123", "Acme", "user1", undefined, false, []);
        expect(mockPost.mock.calls[1][1]).not.toHaveProperty("departments");
        await createTeam("token123", "Acme", "user1");
        expect(mockPost.mock.calls[2][1]).not.toHaveProperty("departments");
    });

    it("says the departments were wrong, not that the name is taken, when the server refuses the list", async () => {
        const mockPost = vi.fn().mockRejectedValue({
            isAxiosError: true,
            response: { status: 400, data: { error: "x", code: "invalid_departments" } },
        });
        (authApi as ReturnType<typeof vi.fn>).mockReturnValue({ post: mockPost });
        const axios = await import("axios");
        vi.spyOn(axios.default, "isAxiosError").mockReturnValue(true);

        const setError = vi.fn();
        await createTeam("token123", "Acme", "user1", setError, true, ["###"]);

        expect(setError).toHaveBeenCalledWith({
            field: "departments",
            message: "Please check the department names.",
        });
    });

    it("a 400 with no field named is not blamed on the team name (MIP-1841)", async () => {
        const mockPost = vi.fn().mockRejectedValue({
            isAxiosError: true,
            response: { status: 400, data: { error: "duplicate" } },
        });
        (authApi as ReturnType<typeof vi.fn>).mockReturnValue({ post: mockPost });

        const axios = await import("axios");
        vi.spyOn(axios.default, "isAxiosError").mockReturnValue(true);

        const setError = vi.fn();
        await createTeam("token123", "Dup Team", "user1", setError);

        expect(setError).toHaveBeenCalledWith({
            field: "form",
            message: "Something went wrong. Please try again later.",
        });
    });

    it("a taken name is reported on the team-name field (MIP-1841)", async () => {
        const mockPost = vi.fn().mockRejectedValue({
            isAxiosError: true,
            response: {
                status: 400,
                data: {
                    team_name: ["team master with this team name already exists."],
                    hint: "Try with different team_name",
                },
            },
        });
        (authApi as ReturnType<typeof vi.fn>).mockReturnValue({ post: mockPost });

        const axios = await import("axios");
        vi.spyOn(axios.default, "isAxiosError").mockReturnValue(true);

        const setError = vi.fn();
        await createTeam("token123", "Dup Team", "user1", setError);

        expect(setError).toHaveBeenCalledWith({
            field: "teamName",
            message: "Please try with different team name.",
        });
    });
});

describe("findTeam", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("short-circuits to { exist: false } for an empty teamId without hitting the API", async () => {
        // The boot-time initCurrentTeam calls findTeam with myself.teamId,
        // which is "" right after login before a team is chosen. Guard against
        // the meaningless GET /team/exist/?team_id= (a 400 that would trip the
        // global request-error toast on an otherwise clean login).
        const mockGet = vi.fn();
        (authApi as ReturnType<typeof vi.fn>).mockReturnValue({ get: mockGet });

        const result = await findTeam("token123", "");

        expect(mockGet).not.toHaveBeenCalled();
        expect(result).toEqual({ exist: false });
    });

    it("probes GET /team/exist/ and suppresses the global toast when given an inline reporter", async () => {
        const mockData = { exist: true, teamDetails: { teamId: "team1" } };
        const mockGet = vi.fn().mockResolvedValue({ data: mockData });
        (authApi as ReturnType<typeof vi.fn>).mockReturnValue({ get: mockGet });

        const setError = vi.fn();
        const result = await findTeam("token123", "team1", setError);

        expect(mockGet).toHaveBeenCalledWith("/team/exist/?team_id=team1", {
            suppressErrorToast: true,
        });
        expect(result).toEqual(mockData);
    });

    it("keeps the global toast (suppress false) when no inline reporter is supplied", async () => {
        const mockData = { exist: true, teamDetails: { teamId: "team1" } };
        const mockGet = vi.fn().mockResolvedValue({ data: mockData });
        (authApi as ReturnType<typeof vi.fn>).mockReturnValue({ get: mockGet });

        const result = await findTeam("token123", "team1");

        expect(mockGet).toHaveBeenCalledWith("/team/exist/?team_id=team1", {
            suppressErrorToast: false,
        });
        expect(result).toEqual(mockData);
    });
});
