/**
 * The activity feed belongs to ONE team.
 *
 * Someone in two teams has entries in both, and the sidebar shows one
 * team at a time — but the feed was scoped by recipient only, at every
 * layer: the history request named no team, the live `activity.created`
 * push arrives in the recipient's per-USER socket room (so it lands
 * whichever team is on screen), and the store handed back every row it
 * held. The result was team A's mentions and replies rendering in team
 * B's sidebar.
 *
 * Real in-memory IndexedDB for the store read, because what's under test
 * is which rows come back out.
 */

import "fake-indexeddb/auto";

import axios from "axios";
import { deleteDB } from "idb";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { DB_NAME } from "../db/config";
import { ActivityService } from "../db/services";
import { activityHandlers } from "../db/workers/handlers/activity.handlers";
import { v3ActivityToLegacy } from "../features/chat/adapters/v3ActivityToLegacy";
import { addActivityMessage } from "../features/chat/components/sidebar/activity/services/addActivityMessage";
import { loadActivityHistory } from "../features/chat/components/sidebar/activity/services/loadActivityHistory";
import { handleV3Activity } from "../features/chat/services/handleV3Activity";
import type { UserProps } from "../types/admin";
import type { ActivityMessageProps } from "../types/chat";

vi.mock("axios", () => ({
    default: {
        get: vi.fn(),
        isAxiosError: () => false,
    },
}));

vi.mock("../features/chat/components/sidebar/activity/services/addActivityMessage", () => ({
    addActivityMessage: vi.fn(),
}));

const MY_TEAM = "11111111-1111-1111-1111-111111111111";
const OTHER_TEAM = "22222222-2222-2222-2222-222222222222";

// jsdom under vitest doesn't give us a working `localStorage`, and the
// push handler needs one to know who is signed in.
const storage = (() => {
    const values = new Map<string, string>();
    return {
        getItem: (key: string) => values.get(key) ?? null,
        setItem: (key: string, value: string) => {
            values.set(key, value);
        },
        removeItem: (key: string) => {
            values.delete(key);
        },
        clear: () => values.clear(),
        key: () => null,
        length: 0,
    } as unknown as Storage;
})();

const myself = {
    userId: "u-me",
    userName: "Me",
    userEmail: "me@example.com",
    teamId: MY_TEAM,
    teamName: "Team A",
    avatarImgPath: "",
    tsLastSeen: "",
    tsJoined: "",
} as UserProps;

const row = (over: Partial<ActivityMessageProps>): ActivityMessageProps =>
    ({
        activityId: "a-1",
        activityType: 5,
        chatType: 2,
        chatId: 1,
        chatName: "Design",
        senderId: "u-them",
        isRead: false,
        tsSent: "2026-08-01T00:00:00Z",
        ...over,
    }) as ActivityMessageProps;

// The v3 wire shape, trimmed to the fields the adapter reads.
const wire = (over: Record<string, unknown> = {}) => ({
    id: "a-1",
    activityType: 5,
    recipientUserId: "u-me",
    teamId: MY_TEAM,
    channelId: "c-1",
    channelKind: 2,
    messageId: "m-1",
    actor: null,
    message: {
        id: "m-1",
        channelId: "c-1",
        channelKind: 2,
        sender: null,
        isThreadReply: false,
        bodyText: "hello",
    },
    meta: {},
    isRead: false,
    tsCreated: "2026-08-01T00:00:00Z",
    ...over,
});

describe("the history request names a team", () => {
    beforeEach(() => {
        vi.mocked(axios.get).mockReset();
        vi.mocked(axios.get).mockResolvedValue({
            data: { activities: [], server_time: "2026-08-04T00:00:00Z" },
        } as never);
    });

    it("asks only for the team the user is looking at", async () => {
        await loadActivityHistory(myself, "token", null);

        const url = vi.mocked(axios.get).mock.calls[0][0];
        expect(url).toContain(`team_id=${MY_TEAM}`);
    });

    it("leaves the parameter off when there is no team yet", async () => {
        // Pre-auth boot: `myself` hydrates before the team does, and an
        // empty `team_id` would name no team and empty the feed.
        await loadActivityHistory({ ...myself, teamId: "" }, "token", null);

        expect(vi.mocked(axios.get).mock.calls[0][0]).not.toContain("team_id=");
    });
});

describe("the adapter keeps the team on the row", () => {
    it("carries it for a channel-backed entry", () => {
        expect(v3ActivityToLegacy(wire() as never, myself).teamId).toBe(MY_TEAM);
    });

    it("carries it for a channel-less note mention", () => {
        const surface = wire({
            surfaceType: 6,
            message: null,
            meta: { noteId: 7, noteTitle: "Spec" },
        });
        expect(v3ActivityToLegacy(surface as never, myself).teamId).toBe(MY_TEAM);
    });
});

describe("the store hands back one team's feed", () => {
    const pop = (me: UserProps = myself) =>
        activityHandlers.popActivityMessages({ myself: me } as never);

    beforeEach(async () => {
        await deleteDB(DB_NAME);
    });

    it("drops the other team's entries", async () => {
        const service = new ActivityService();
        await service.addActivityMessage(row({ activityId: "mine", teamId: MY_TEAM }));
        await service.addActivityMessage(row({ activityId: "theirs", teamId: OTHER_TEAM }));

        expect((await pop()).map((m) => m.activityId)).toEqual(["mine"]);
    });

    it("keeps an entry cached before the team was recorded", async () => {
        // A row from before the field existed. Hiding it would empty the
        // feed of a client whose API hasn't been deployed yet; the next
        // history sync refetches it with a team.
        const service = new ActivityService();
        await service.addActivityMessage(row({ activityId: "legacy", teamId: undefined }));

        expect((await pop()).map((m) => m.activityId)).toEqual(["legacy"]);
    });

    it("still hides a reaction aimed at someone else", async () => {
        const service = new ActivityService();
        await service.addActivityMessage(
            row({ activityId: "not-mine", activityType: 2, senderId: "u-them", teamId: MY_TEAM })
        );

        expect(await pop()).toEqual([]);
    });
});

describe("a live push respects the team on screen", () => {
    beforeEach(() => {
        vi.mocked(addActivityMessage).mockReset();
        // The push handler fires from the socket router, outside React, so
        // it reads the signed-in user out of `localStorage`.
        vi.stubGlobal("localStorage", storage);
        storage.setItem("userId", myself.userId);
        storage.setItem("teamId", MY_TEAM);
    });

    it("ignores an entry from the user's other team", async () => {
        const dispatched = vi.fn();
        window.addEventListener("v3:activity:created", dispatched);

        await handleV3Activity(wire({ teamId: OTHER_TEAM }));

        expect(addActivityMessage).not.toHaveBeenCalled();
        expect(dispatched).not.toHaveBeenCalled();
        window.removeEventListener("v3:activity:created", dispatched);
    });

    it("lands an entry from this team", async () => {
        const dispatched = vi.fn();
        window.addEventListener("v3:activity:created", dispatched);

        await handleV3Activity(wire());

        expect(addActivityMessage).toHaveBeenCalledTimes(1);
        expect(dispatched).toHaveBeenCalledTimes(1);
        window.removeEventListener("v3:activity:created", dispatched);
    });
});
