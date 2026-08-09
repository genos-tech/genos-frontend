import { beforeEach, describe, expect, it, vi } from "vitest";

import { deleteMessage } from "../../features/chat/services/deleteMessage";
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
        expect(setError).toHaveBeenCalledWith("Could not delete: message ID unavailable.");
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

// Legacy `updateReadStatus` (axios PUT to `/chat/read/`) was removed
// with the chat worker handler trim — read cursors now route through
// `channelService.markRead` (covered by the channelService unit tests
// + the integration tests for `useReadStatusManagement`).
