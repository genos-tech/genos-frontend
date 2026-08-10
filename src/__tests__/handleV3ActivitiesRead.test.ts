// @vitest-environment jsdom
//
// Read-cursor → sidebar activity auto-clear bridge
// (src/features/chat/services/handleV3ActivitiesRead.ts).
//
// When the read cursor sweeps past a message, the backend marks that
// message's unread sidebar activities read and echoes their ids on the
// `read.advanced` broadcast. This bridge flips those rows to
// `isRead: true` in the activity IDB store and dispatches
// `v3:activities:read` so the sidebar re-derives. Real in-memory
// IndexedDB, because what's under test is that the persisted flip
// actually lands (an un-persisted flip would resurrect on the next pop).

import "fake-indexeddb/auto";

import { deleteDB } from "idb";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { DB_NAME } from "../db/config";
import { ActivityService } from "../db/services";
import {
    handleV3ActivitiesRead,
    V3_ACTIVITIES_READ_EVENT,
} from "../features/chat/services/handleV3ActivitiesRead";
import type { ActivityMessageProps } from "../types/chat";

function fakeActivity(overrides: Partial<ActivityMessageProps> = {}): ActivityMessageProps {
    return {
        activityId: "a1",
        activityType: 5,
        chatType: 2,
        chatId: 0,
        chatName: "GM",
        dmPartnerUserId: "",
        dmPartnerUserName: "",
        dmPartnerUserEmail: "",
        isThread: false,
        threadId: 0,
        messageId: 0,
        messageUniqueKey: "",
        threadMessageUniqueKey: "",
        taskId: 0,
        firstLineContent: "hello",
        latestReaction: { emoji: "", sender: {} as never, tsSent: "" },
        senderId: "u2",
        receiver: {} as never,
        reactions: [],
        tsSent: "2026-01-01T00:00:00Z",
        isRead: false,
        ...overrides,
    };
}

describe("handleV3ActivitiesRead", () => {
    let service: ActivityService;

    beforeEach(async () => {
        await deleteDB(DB_NAME);
        service = new ActivityService();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it("flips the named unread rows to isRead in IDB and dispatches the refresh event", async () => {
        await service.batchInsertActivityMessages([
            fakeActivity({ activityId: "a1", isRead: false }),
            fakeActivity({ activityId: "a2", isRead: false }),
            fakeActivity({ activityId: "a3", isRead: false }),
        ]);

        const onEvent = vi.fn();
        window.addEventListener(V3_ACTIVITIES_READ_EVENT, onEvent);

        await handleV3ActivitiesRead(["a1", "a2"]);

        const byId = new Map(
            (await service.getAllActivityMessages()).map((r) => [r.activityId, r])
        );
        expect(byId.get("a1")?.isRead).toBe(true);
        expect(byId.get("a2")?.isRead).toBe(true);
        expect(byId.get("a3")?.isRead).toBe(false); // untouched

        expect(onEvent).toHaveBeenCalledTimes(1);
        const detail = (onEvent.mock.calls[0][0] as CustomEvent).detail;
        expect(detail.activityIds).toEqual(["a1", "a2"]);

        window.removeEventListener(V3_ACTIVITIES_READ_EVENT, onEvent);
    });

    it("leaves an already-read row untouched and never rewrites it", async () => {
        await service.batchInsertActivityMessages([
            fakeActivity({ activityId: "a1", isRead: true }),
        ]);
        const spy = vi.spyOn(service.constructor.prototype, "batchInsertActivityMessages");

        await handleV3ActivitiesRead(["a1"]);

        // Nothing to flip ⇒ no write, but the refresh event still fires.
        expect(spy).not.toHaveBeenCalled();
        const row = await service.getActivityMessage("a1");
        expect(row?.isRead).toBe(true);
    });

    it("tolerates ids that aren't in the local store (another team / aged out)", async () => {
        await service.batchInsertActivityMessages([
            fakeActivity({ activityId: "a1", isRead: false }),
        ]);
        const onEvent = vi.fn();
        window.addEventListener(V3_ACTIVITIES_READ_EVENT, onEvent);

        // "ghost" isn't present; a1 stays unread because it wasn't named.
        await handleV3ActivitiesRead(["ghost"]);

        expect((await service.getActivityMessage("a1"))?.isRead).toBe(false);
        // Event still fires — the listener just re-derives the same state.
        expect(onEvent).toHaveBeenCalledTimes(1);
        window.removeEventListener(V3_ACTIVITIES_READ_EVENT, onEvent);
    });

    it("no-ops on an empty id list without touching IDB or the event bus", async () => {
        const onEvent = vi.fn();
        window.addEventListener(V3_ACTIVITIES_READ_EVENT, onEvent);
        const getAllSpy = vi.spyOn(service.constructor.prototype, "getAllActivityMessages");

        await handleV3ActivitiesRead([]);

        expect(getAllSpy).not.toHaveBeenCalled();
        expect(onEvent).not.toHaveBeenCalled();
        window.removeEventListener(V3_ACTIVITIES_READ_EVENT, onEvent);
    });
});
