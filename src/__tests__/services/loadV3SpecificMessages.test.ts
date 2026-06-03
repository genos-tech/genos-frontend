import { afterEach, describe, expect, it, vi } from "vitest";

import { v3MessagesToLegacy } from "../../features/chat/adapters/v3ToLegacy";
import {
    loadV3SpecificMessages,
    readV3CachedMessages,
} from "../../features/chat/services/loadV3SpecificMessages";
import { channelService } from "../../services/channel/channelService";

// The snapshot lives on the mocked module so tests can mutate it in place
// and the same reference stays wired through `getSnapshot()`.
vi.mock("../../services/channel/channelService", () => {
    const snapshot = {
        messagesByChannel: new Map(),
        flagByMessageId: new Map(),
    };
    return {
        channelService: {
            __snapshot: snapshot,
            getSnapshot: vi.fn(() => snapshot),
            syncChannel: vi.fn().mockResolvedValue(undefined),
        },
    };
});

// Stub the adapter to a marker so assertions can verify WHICH slice was
// adapted without depending on the real legacy `MessageProps` shape.
vi.mock("../../features/chat/adapters/v3ToLegacy", () => ({
    v3MessagesToLegacy: vi.fn(({ channelId, messages }) =>
        messages.map((m: { id: string }) => ({ messageId: m.id, channelId }))
    ),
}));

const snapshot = (
    channelService as unknown as { __snapshot: { messagesByChannel: Map<string, unknown> } }
).__snapshot;
const syncChannelMock = channelService.syncChannel as ReturnType<typeof vi.fn>;
const adapterMock = v3MessagesToLegacy as unknown as ReturnType<typeof vi.fn>;

afterEach(() => {
    vi.clearAllMocks();
    snapshot.messagesByChannel.clear();
});

describe("readV3CachedMessages", () => {
    it("returns the adapted cached slice WITHOUT a network sync", () => {
        snapshot.messagesByChannel.set("chan-1", [{ id: "m1" }, { id: "m2" }]);

        const result = readV3CachedMessages("chan-1", 2);

        // The whole point of the chat-switch perf fix: no round-trip.
        expect(syncChannelMock).not.toHaveBeenCalled();
        expect(result).toEqual([
            { messageId: "m1", channelId: "chan-1" },
            { messageId: "m2", channelId: "chan-1" },
        ]);
    });

    it("adapts an empty slice for a never-cached channel (no throw, no sync)", () => {
        const result = readV3CachedMessages("missing", 1);

        expect(syncChannelMock).not.toHaveBeenCalled();
        expect(result).toEqual([]);
        expect(adapterMock).toHaveBeenCalledWith(
            expect.objectContaining({ channelId: "missing", messages: [] })
        );
    });
});

describe("loadV3SpecificMessages", () => {
    it("syncs the channel first, then returns the cached slice", async () => {
        snapshot.messagesByChannel.set("chan-2", [{ id: "x1" }]);

        const result = await loadV3SpecificMessages("chan-2", 3);

        expect(syncChannelMock).toHaveBeenCalledWith("chan-2");
        expect(result).toEqual([{ messageId: "x1", channelId: "chan-2" }]);
    });

    it("still returns cached messages when syncChannel rejects", async () => {
        syncChannelMock.mockRejectedValueOnce(new Error("network down"));
        snapshot.messagesByChannel.set("chan-3", [{ id: "y1" }]);

        const result = await loadV3SpecificMessages("chan-3", 1);

        expect(result).toEqual([{ messageId: "y1", channelId: "chan-3" }]);
    });
});
