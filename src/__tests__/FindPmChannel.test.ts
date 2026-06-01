import { describe, expect, it } from "vitest";

import { findPmChannelForProject } from "../features/tasks/services/findPmChannel";
import { Channel, ChannelKind } from "../types/channel";

const makeChannel = (overrides: Partial<Channel>): Channel =>
    ({
        id: "ch",
        kind: ChannelKind.PM,
        title: "",
        profileImageUrl: "",
        projectId: null,
        ownerId: null,
        isPrivate: false,
        legacyChatId: null,
        latestMessage: null,
        unreadCount: 0,
        tsCreated: "2026-01-01T00:00:00Z",
        ...overrides,
    }) as Channel;

describe("findPmChannelForProject", () => {
    it("matches the PM channel for the project (number === number)", () => {
        const pm = makeChannel({ id: "pm-1", kind: ChannelKind.PM, projectId: 1 });
        const channels = [makeChannel({ id: "gm", kind: ChannelKind.GM, projectId: null }), pm];
        expect(findPmChannelForProject(channels, 1)).toBe(pm);
    });

    it("normalizes string/number skew on either side", () => {
        const pm = makeChannel({ id: "pm-1", projectId: 1 });
        // channel projectId number, task projectId string
        expect(findPmChannelForProject([pm], "1")).toBe(pm);
        // channel projectId string-ish (defensive), task projectId number
        const pmStr = makeChannel({ id: "pm-2", projectId: "2" as unknown as number });
        expect(findPmChannelForProject([pmStr], 2)).toBe(pmStr);
    });

    it("ignores non-PM channels even if their projectId matches", () => {
        const gm = makeChannel({ id: "gm", kind: ChannelKind.GM, projectId: 1 });
        expect(findPmChannelForProject([gm], 1)).toBeUndefined();
    });

    it("never matches a PM channel with a null projectId", () => {
        const pmNull = makeChannel({ id: "pm-null", kind: ChannelKind.PM, projectId: null });
        expect(findPmChannelForProject([pmNull], 1)).toBeUndefined();
    });

    it("returns undefined when no PM channel exists for the project", () => {
        const pmOther = makeChannel({ id: "pm-9", projectId: 9 });
        expect(findPmChannelForProject([pmOther], 1)).toBeUndefined();
    });
});
