import { beforeEach, describe, expect, it, vi } from "vitest";

import { deleteMessage } from "../../features/chat/services/deleteMessage";
import { updateReadStatus } from "../../features/chat/services/updateReadStatus";
import { authApi } from "../../services/api";

vi.mock("../../services/api", () => ({
    authApi: vi.fn(),
    nonAuthApi: vi.fn(),
}));

describe("deleteMessage", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("should call PUT /dm/message/ with is_deleted for DM (chatType=1)", async () => {
        const mockPut = vi.fn().mockResolvedValue({ data: { success: true } });
        (authApi as ReturnType<typeof vi.fn>).mockReturnValue({ put: mockPut });

        const result = await deleteMessage("token123", 1, 42, 7);

        expect(mockPut).toHaveBeenCalledWith("/dm/message/", {
            dm_id: 42,
            message_id: 7,
            is_deleted: true,
        });
        expect(result).toEqual({ success: true });
    });

    it("should call PUT /gm/message/ for GM (chatType=2)", async () => {
        const mockPut = vi.fn().mockResolvedValue({ data: { success: true } });
        (authApi as ReturnType<typeof vi.fn>).mockReturnValue({ put: mockPut });

        await deleteMessage("token123", 2, 10, 3);

        expect(mockPut).toHaveBeenCalledWith("/gm/message/", {
            gm_id: 10,
            message_id: 3,
            is_deleted: true,
        });
    });

    it("should call PUT /pm/message/ for PM (chatType=3)", async () => {
        const mockPut = vi.fn().mockResolvedValue({ data: { success: true } });
        (authApi as ReturnType<typeof vi.fn>).mockReturnValue({ put: mockPut });

        await deleteMessage("token123", 3, 5, 1);

        expect(mockPut).toHaveBeenCalledWith("/pm/message/", {
            project_id: 5,
            message_id: 1,
            is_deleted: true,
        });
    });

    it("should return undefined for null token", async () => {
        (authApi as ReturnType<typeof vi.fn>).mockReturnValue(null);

        const setError = vi.fn();
        const result = await deleteMessage(null, 1, 1, 1, setError);

        expect(result).toBeUndefined();
        expect(setError).toHaveBeenCalledWith("Unauthorized. Auth toke is not found.");
    });

    it("should handle unexpected chatType gracefully", async () => {
        const mockPut = vi.fn();
        (authApi as ReturnType<typeof vi.fn>).mockReturnValue({ put: mockPut });

        const result = await deleteMessage("token123", 99, 1, 1);

        expect(mockPut).not.toHaveBeenCalled();
        expect(result).toBeUndefined();
    });
});

describe("updateReadStatus", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

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

    it("should call PUT /chat/read/ with correct params", async () => {
        const mockPut = vi.fn().mockResolvedValue({ data: { success: true } });
        (authApi as ReturnType<typeof vi.fn>).mockReturnValue({ put: mockPut });

        const result = await updateReadStatus("token123", mockMyself, 1, 42, false, 0, 10);

        expect(mockPut).toHaveBeenCalledWith("/chat/read/", {
            team_id: "team1",
            user_id: "user1",
            chat_type: 1,
            chat_id: 42,
            is_thread: false,
            thread_id: 0,
            last_read_message_id: 10,
        });
        expect(result).toEqual({ success: true });
    });

    it("should return undefined when token is null", async () => {
        (authApi as ReturnType<typeof vi.fn>).mockReturnValue(null);

        const result = await updateReadStatus(null, mockMyself, 1, 1, false, 0, 1);
        expect(result).toBeUndefined();
    });
});
