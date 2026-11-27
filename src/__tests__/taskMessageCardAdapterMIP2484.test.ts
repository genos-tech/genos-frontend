/** Which thread messages are a task's card (MIP-2484). */
import { describe, expect, it } from "vitest";

import { v3ThreadMessageToLegacy } from "../features/chat/adapters/v3ToLegacy";

const adapt = (chatType: number, over: Record<string, unknown>) =>
    v3ThreadMessageToLegacy({
        channelId: "c",
        threadRootUuid: "r",
        chatType,
        message: {
            id: "m",
            seq: 1,
            body: [],
            bodyText: "x",
            isThreadReply: false,
            metadata: {},
            tsSent: "2026-11-28T00:00:00Z",
            tsUpdated: "2026-11-28T00:00:00Z",
            ...over,
        } as never,
    }).isTaskCard;

const card = { taskId: 5, taskStatus: "Open", systemUserId: "s" };

describe("isTaskCard", () => {
    it("is the root of a project-chat thread, not the comments under it", () => {
        expect(adapt(3, { taskId: 5 })).toBe(true);
        expect(adapt(3, { taskId: 5, isThreadReply: true, metadata: { taskCommentId: 8 } })).toBe(
            false
        );
    });

    it("is the copy posted into a DM or group thread, not a person's message", () => {
        expect(adapt(1, { isThreadReply: true, metadata: card })).toBe(true);
        // A project with no system user: the key is dropped from the stored JSON.
        expect(
            adapt(1, { isThreadReply: true, metadata: { taskId: 5, taskStatus: "Open" } })
        ).toBe(true);
        // The message a task was made from is linked to it and is still that message.
        expect(adapt(1, { taskId: 5 })).toBe(false);
        expect(adapt(2, { isThreadReply: true, taskId: 5 })).toBe(false);
    });
});
