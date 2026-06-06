import { afterEach, describe, expect, it, vi } from "vitest";

import { v3ThreadMessagesToLegacy } from "../../features/chat/adapters/v3ToLegacy";
import {
    loadV3SpecificThreadMessages,
    readV3CachedThreadMessages,
} from "../../features/chat/services/loadV3SpecificThreadMessages";
import { channelService } from "../../services/channel/channelService";

// The snapshot lives on the mocked module so tests can mutate it in place
// and the same reference stays wired through `getSnapshot()`. Mirrors the
// `loadV3SpecificMessages` test harness.
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

// Stub the adapter to a marker so assertions can verify WHICH slice +
// thread root was adapted without depending on the real legacy
// `ThreadMessageProps` shape.
vi.mock("../../features/chat/adapters/v3ToLegacy", () => ({
    v3ThreadMessagesToLegacy: vi.fn(({ channelId, threadRootUuid, messages }) =>
        messages.map((m: { id: string }) => ({ messageId: m.id, channelId, threadRootUuid }))
    ),
}));

const snapshot = (
    channelService as unknown as { __snapshot: { messagesByChannel: Map<string, unknown> } }
).__snapshot;
const syncChannelMock = channelService.syncChannel as ReturnType<typeof vi.fn>;
const adapterMock = v3ThreadMessagesToLegacy as unknown as ReturnType<typeof vi.fn>;

afterEach(() => {
    vi.clearAllMocks();
    snapshot.messagesByChannel.clear();
});

describe("readV3CachedThreadMessages", () => {
    it("returns the adapted cached slice filtered to the thread root WITHOUT a network sync", () => {
        snapshot.messagesByChannel.set("chan-1", [{ id: "m1" }, { id: "m2" }]);

        const result = readV3CachedThreadMessages("chan-1", "root-1", 2);

        // The whole point of the activity-open perf fix: no round-trip.
        expect(syncChannelMock).not.toHaveBeenCalled();
        expect(result).toEqual([
            { messageId: "m1", channelId: "chan-1", threadRootUuid: "root-1" },
            { messageId: "m2", channelId: "chan-1", threadRootUuid: "root-1" },
        ]);
    });

    it("adapts an empty slice for a never-cached channel (no throw, no sync)", () => {
        const result = readV3CachedThreadMessages("missing", "root-9", 1);

        expect(syncChannelMock).not.toHaveBeenCalled();
        expect(result).toEqual([]);
        expect(adapterMock).toHaveBeenCalledWith(
            expect.objectContaining({
                channelId: "missing",
                messages: [],
                threadRootUuid: "root-9",
            })
        );
    });
});

describe("loadV3SpecificThreadMessages", () => {
    it("syncs the channel first, then returns the cached thread slice", async () => {
        snapshot.messagesByChannel.set("chan-2", [{ id: "x1" }]);

        const result = await loadV3SpecificThreadMessages("chan-2", "root-2", 3);

        expect(syncChannelMock).toHaveBeenCalledWith("chan-2");
        expect(result).toEqual([
            { messageId: "x1", channelId: "chan-2", threadRootUuid: "root-2" },
        ]);
    });

    it("still returns cached thread messages when syncChannel rejects", async () => {
        syncChannelMock.mockRejectedValueOnce(new Error("network down"));
        snapshot.messagesByChannel.set("chan-3", [{ id: "y1" }]);

        const result = await loadV3SpecificThreadMessages("chan-3", "root-3", 1);

        expect(result).toEqual([
            { messageId: "y1", channelId: "chan-3", threadRootUuid: "root-3" },
        ]);
    });
});
