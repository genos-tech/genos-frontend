/**
 * The activity history follows the server's pages to the end (MIP-740).
 *
 * The endpoint returns the newest 200 and, since MIP-740, says whether there
 * is an older page (`has_more` + `next_cursor`). The loader's caller stores
 * the response's `server_time` as its next `since` and, on a full load, clears
 * the store first. Treating one page as the whole list would therefore lose
 * everything past the cut for good: not a missing "older" link, a permanent
 * hole. So the loader fetches every page BEFORE returning, and these tests
 * pin that against the real handler and a real (in-memory) IndexedDB.
 */

import "fake-indexeddb/auto";

import axios from "axios";
import { deleteDB } from "idb";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { DB_NAME } from "../db/config";
import { ActivityService } from "../db/services";
import { activityHandlers } from "../db/workers/handlers/activity.handlers";
import { loadActivityHistory } from "../features/chat/components/sidebar/activity/services/loadActivityHistory";
import type { UserProps } from "../types/admin";

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

// The v3 wire shape, trimmed to the fields the adapter reads.
const wire = (n: number) => ({
    id: `a-${n}`,
    activityType: 5,
    recipientUserId: "u-me",
    teamId: MY_TEAM,
    channelId: "c-1",
    channelKind: 2,
    messageId: `m-${n}`,
    actor: null,
    message: {
        id: `m-${n}`,
        channelId: "c-1",
        channelKind: 2,
        sender: null,
        isThreadReply: false,
        bodyText: `hello ${n}`,
    },
    meta: {},
    isRead: false,
    // Recent, and relative to now: the handler prunes anything older than its
    // 30-day retention right after storing, so a fixed past date would make
    // the store look empty for the wrong reason.
    tsCreated: new Date(Date.now() - n * 60_000).toISOString(),
});

/** A server holding `total` rows, newest first, `pageSize` per page. */
const serve = (total: number, pageSize: number) => {
    const all = Array.from({ length: total }, (_, i) => wire(i + 1));
    let clock = 0;
    vi.mocked(axios.get).mockImplementation(async (url: string) => {
        // The base is relative under jsdom, so read the query without `new URL`.
        const cursor = new URLSearchParams(url.split("?")[1] ?? "").get("cursor");
        const start = cursor ? Number(cursor) : 0;
        const page = all.slice(start, start + pageSize);
        const more = start + pageSize < total;
        clock += 1;
        return {
            data: {
                activities: page,
                // Each response carries a LATER clock than the one before it.
                server_time: `2026-08-04T00:00:0${clock}Z`,
                has_more: more,
                next_cursor: more ? String(start + pageSize) : null,
            },
        } as never;
    });
    return all;
};

const urlOf = (call: number) => String(vi.mocked(axios.get).mock.calls[call][0]);

describe("loadActivityHistory follows the pages", () => {
    beforeEach(() => {
        vi.mocked(axios.get).mockReset();
    });

    it("returns every row of a list larger than one page", async () => {
        serve(25, 10);

        const res = await loadActivityHistory(myself, "tok", null);

        expect(res?.activity).toHaveLength(25);
        expect(res?.activity.map((a) => a.activityId)).toEqual(
            Array.from({ length: 25 }, (_, i) => `a-${i + 1}`)
        );
        expect(axios.get).toHaveBeenCalledTimes(3);
    });

    it("sends the cursor on every page after the first, and not on the first", async () => {
        serve(25, 10);

        await loadActivityHistory(myself, "tok", null);

        expect(urlOf(0)).not.toContain("cursor=");
        expect(urlOf(1)).toContain("cursor=10");
        expect(urlOf(2)).toContain("cursor=20");
    });

    it("keeps the team and since on every page", async () => {
        serve(25, 10);

        await loadActivityHistory(myself, "tok", "2026-07-01T00:00:00Z");

        for (let i = 0; i < 3; i += 1) {
            expect(urlOf(i)).toContain(`team_id=${MY_TEAM}`);
            expect(urlOf(i)).toContain("since=2026-07-01T00%3A00%3A00Z");
        }
    });

    it("uses the FIRST page's clock, so rows created while paging are not skipped", async () => {
        serve(25, 10);

        const res = await loadActivityHistory(myself, "tok", null);

        expect(res?.serverTime).toBe("2026-08-04T00:00:01Z");
    });

    it("makes one request for a list that fits in a page", async () => {
        serve(5, 10);

        const res = await loadActivityHistory(myself, "tok", null);

        expect(res?.activity).toHaveLength(5);
        expect(axios.get).toHaveBeenCalledTimes(1);
    });

    it("treats a server that predates has_more as a single page, as before", async () => {
        vi.mocked(axios.get).mockResolvedValue({
            data: { activities: [wire(1), wire(2)], server_time: "2026-08-04T00:00:00Z" },
        } as never);

        const res = await loadActivityHistory(myself, "tok", null);

        expect(res?.activity).toHaveLength(2);
        expect(axios.get).toHaveBeenCalledTimes(1);
    });

    it("stops if has_more arrives without a cursor, rather than looping", async () => {
        vi.mocked(axios.get).mockResolvedValue({
            data: {
                activities: [wire(1)],
                server_time: "2026-08-04T00:00:00Z",
                has_more: true,
                next_cursor: null,
            },
        } as never);

        const res = await loadActivityHistory(myself, "tok", null);

        expect(res?.activity).toHaveLength(1);
        expect(axios.get).toHaveBeenCalledTimes(1);
    });

    it("gives up on a server that never says it is done, and returns nothing", async () => {
        vi.spyOn(console, "error").mockImplementation(() => {});
        vi.mocked(axios.get).mockResolvedValue({
            data: {
                activities: [wire(1)],
                server_time: "2026-08-04T00:00:00Z",
                has_more: true,
                next_cursor: "again",
            },
        } as never);

        const res = await loadActivityHistory(myself, "tok", null);

        // `undefined` is what the worker handler turns into a thrown error,
        // which leaves the checkpoint where it was.
        expect(res).toBeUndefined();
        expect(vi.mocked(axios.get).mock.calls.length).toBeLessThanOrEqual(50);
    });

    it("returns nothing if a later page fails, instead of a short list", async () => {
        vi.spyOn(console, "error").mockImplementation(() => {});
        const first = {
            data: { activities: [wire(1)], server_time: "t", has_more: true, next_cursor: "10" },
        };
        vi.mocked(axios.get)
            .mockResolvedValueOnce(first as never)
            .mockRejectedValueOnce(new Error("boom"));

        const res = await loadActivityHistory(myself, "tok", null);

        expect(res).toBeUndefined();
    });
});

describe("the worker handler stores every row of a long history", () => {
    beforeEach(async () => {
        vi.mocked(axios.get).mockReset();
        await deleteDB(DB_NAME);
    });

    it("a team larger than one page shows every row and nothing is evicted", async () => {
        serve(25, 10);

        await activityHandlers.loadActivityHistory({
            myself,
            accessToken: "tok",
            forceFull: true,
        } as never);

        const stored = await new ActivityService().getAllActivityMessages();
        expect(stored).toHaveLength(25);
        expect(new Set(stored.map((a) => a.activityId)).size).toBe(25);
    });

    it("a failed later page leaves the store as it was", async () => {
        vi.spyOn(console, "error").mockImplementation(() => {});
        await new ActivityService().batchInsertActivityMessages([
            {
                activityId: "keep-me",
                activityType: 5,
                chatType: 2,
                chatId: 1,
                chatName: "x",
                senderId: "u",
                isRead: false,
                tsSent: "2026-08-01T00:00:00Z",
            } as never,
        ]);
        const first = {
            data: { activities: [wire(1)], server_time: "t", has_more: true, next_cursor: "10" },
        };
        vi.mocked(axios.get)
            .mockResolvedValueOnce(first as never)
            .mockRejectedValueOnce(new Error("boom"));

        await expect(
            activityHandlers.loadActivityHistory({
                myself,
                accessToken: "tok",
                forceFull: true,
            } as never)
        ).rejects.toThrow();

        const stored = await new ActivityService().getAllActivityMessages();
        expect(stored.map((a) => a.activityId)).toEqual(["keep-me"]);
    });
});
