import { beforeEach, describe, expect, it, vi } from "vitest";

import { deleteMessage } from "../../features/chat/services/deleteMessage";
import { updateReadStatus } from "../../features/chat/services/updateReadStatus";
import { authApi } from "../../services/api";
import { channelService } from "../../services/channel/channelService";

vi.mock("../../services/api", () => ({
    authApi: vi.fn(),
    nonAuthApi: vi.fn(),
}));

// `deleteMessage` was rewired from the legacy per-type axios PUTs
// (`/dm/message/`, `/gm/message/`, `/pm/message/`, `/mdm/message/`)
// to a single `channelService.deleteMessage` call. The unit test now
// asserts the v3 call shape — channelId + messageUuid + ChannelKind.
describe("deleteMessage (v3)", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("forwards (channelId, messageUuid, ChannelKind) to channelService.deleteMessage", async () => {
        const spy = vi
            .spyOn(channelService, "deleteMessage")
            .mockResolvedValue(undefined as unknown as void);

        await deleteMessage("token123", 1, "channel-uuid-abc", "msg-uuid-7");

        expect(spy).toHaveBeenCalledWith("msg-uuid-7", "channel-uuid-abc", 1);
        spy.mockRestore();
    });

    it("forwards GM kind code 2 through unchanged (channelService kind is the same int)", async () => {
        const spy = vi
            .spyOn(channelService, "deleteMessage")
            .mockResolvedValue(undefined as unknown as void);

        await deleteMessage("token123", 2, "channel-uuid-gm", "msg-uuid-gm");

        expect(spy).toHaveBeenCalledWith("msg-uuid-gm", "channel-uuid-gm", 2);
        spy.mockRestore();
    });

    it("no-ops with a setErrorMessage call when messageUuid is empty", async () => {
        const spy = vi.spyOn(channelService, "deleteMessage");
        const setError = vi.fn();

        await deleteMessage("token123", 1, "channel-uuid", "", setError);

        expect(spy).not.toHaveBeenCalled();
        expect(setError).toHaveBeenCalledWith("Could not delete: message id unavailable.");
        spy.mockRestore();
    });

    it("surfaces channelService failures via setErrorMessage", async () => {
        const spy = vi.spyOn(channelService, "deleteMessage").mockRejectedValue(new Error("boom"));
        const setError = vi.fn();

        await deleteMessage("token123", 1, "channel-uuid", "msg-uuid", setError);

        expect(setError).toHaveBeenCalledWith("Failed to delete message.");
        spy.mockRestore();
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
