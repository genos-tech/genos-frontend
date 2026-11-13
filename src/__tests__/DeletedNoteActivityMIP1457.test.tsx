/**
 * MIP-1457: the @mention rows of a deleted note leave the Activity feed.
 *
 * Before, only the Unread list knew about a delete (and only one made while it was mounted): the
 * Activity row stayed, and clicking it did nothing. Now the feed and IndexedDB drop the note's
 * rows on the `noteDeleted` announcement, and a row of a note deleted earlier (the server still
 * returns it) is dropped by the click that finds a 404. These run the real worker handler on a
 * real (in-memory) IndexedDB and the real hook.
 */

import "fake-indexeddb/auto";

import { act, renderHook } from "@testing-library/react";
import { deleteDB } from "idb";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { DB_NAME } from "../db/config";
import { ActivityService } from "../db/services";
import { activityHandlers } from "../db/workers/handlers/activity.handlers";
import { withoutNoteActivities } from "../features/chat/components/sidebar/activity/services/dropNoteActivities";
import { useNoteMentionUnread } from "../features/notes/common/hooks/useNoteMentionUnread";
import { emitNoteDeleted } from "../features/notes/common/utils/noteDeleted";
import type { UserProps } from "../types/admin";
import type { ActivityMessageProps } from "../types/chat";

// The real handler runs here instead of a Worker.
vi.mock("../db/workers/channels", () => ({
    activityChannel: {
        request: vi.fn(async (type: string, payload: never) =>
            (activityHandlers as Record<string, (p: never) => unknown>)[type](payload)
        ),
    },
}));

const myself = { userId: "u-me", teamId: "t1" } as UserProps;

const row = (chatType: number, chatId: number, extra: Partial<ActivityMessageProps> = {}) =>
    ({
        activityId: `a-${chatType}-${chatId}`,
        chatType,
        chatId,
        chatName: `Note ${chatId}`,
        isRead: false,
        senderId: "someone",
        tsSent: "2026-11-13T00:00:00Z",
        ...extra,
    }) as ActivityMessageProps;

describe("withoutNoteActivities", () => {
    const feed = [row(6, 7), row(6, 8), row(7, 7), row(1, 7)];

    it("drops only the given note ids of the given family", () => {
        // note type 1 -> chatType 6: the task note 7 (chatType 7) and the chat row 7 stay
        expect(withoutNoteActivities(feed, 1, [7]).map((a) => a.activityId)).toEqual([
            "a-6-8",
            "a-7-7",
            "a-1-7",
        ]);
    });

    it("returns the same array when there is nothing to drop", () => {
        expect(withoutNoteActivities(feed, 3, [7])).toBe(feed);
    });
});

describe("a note deleted while the app is open", () => {
    beforeEach(async () => {
        await deleteDB(DB_NAME);
    });

    it("leaves the feed and IndexedDB, and keeps the other rows", async () => {
        const rows = [row(6, 7), row(6, 7, { activityId: "a-6-7-b" }), row(6, 8), row(7, 7)];
        const service = new ActivityService();
        await service.batchInsertActivityMessages(rows);
        const setActivityMessages = vi.fn();
        const useCM = { activityMessages: rows, setActivityMessages } as never;

        renderHook(() => useNoteMentionUnread(useCM, myself, "token"));
        act(() => emitNoteDeleted({ noteType: 1, noteIds: [7] }));

        expect(setActivityMessages).toHaveBeenCalledTimes(1);
        expect(
            setActivityMessages.mock.calls[0][0].map((a: ActivityMessageProps) => a.activityId)
        ).toEqual(["a-6-8", "a-7-7"]);
        await vi.waitFor(async () => {
            const left = (await service.getAllActivityMessages()).map((a) => a.activityId).sort();
            expect(left).toEqual(["a-6-8", "a-7-7"]);
        });
    });

    it("does not touch the feed for a delete that matches no row", () => {
        const setActivityMessages = vi.fn();
        const useCM = { activityMessages: [row(6, 8)], setActivityMessages } as never;
        renderHook(() => useNoteMentionUnread(useCM, myself, "token"));
        act(() => emitNoteDeleted({ noteType: 1, noteIds: [99] }));
        expect(setActivityMessages).not.toHaveBeenCalled();
    });
});
