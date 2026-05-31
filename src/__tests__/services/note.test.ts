import { beforeEach, describe, expect, it, vi } from "vitest";

import { loadAllMyNotes } from "../../features/notes/my-notes/services/loadAllMyNotes";
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

describe("loadAllMyNotes", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("should call GET /note/personal/all/ with correct query params", async () => {
        const mockData = [{ note_id: 1, title: "Note 1" }];
        const mockGet = vi.fn().mockResolvedValue({ data: mockData });
        (authApi as ReturnType<typeof vi.fn>).mockReturnValue({ get: mockGet });

        const result = await loadAllMyNotes(mockMyself, "token123");

        expect(authApi).toHaveBeenCalledWith("token123");
        expect(mockGet).toHaveBeenCalledWith("/note/personal/all/?team_id=team1&user_id=user1");
        expect(result).toEqual(mockData);
    });

    it("should return undefined when token is null", async () => {
        (authApi as ReturnType<typeof vi.fn>).mockReturnValue(null);

        const result = await loadAllMyNotes(mockMyself, null);
        expect(result).toBeUndefined();
    });

    it("should handle API errors gracefully", async () => {
        const mockGet = vi.fn().mockRejectedValue(new Error("Network error"));
        (authApi as ReturnType<typeof vi.fn>).mockReturnValue({ get: mockGet });

        const result = await loadAllMyNotes(mockMyself, "token123");
        expect(result).toBeUndefined();
    });
});
