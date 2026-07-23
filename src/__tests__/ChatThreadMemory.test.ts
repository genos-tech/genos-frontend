import { beforeEach, describe, expect, it } from "vitest";

import {
    forgetThread,
    recallThread,
    rememberThread,
    threadUrlToken,
} from "../features/chat/utils/threadMemory";
import { ThreadProps } from "../types/chat";

// Per-chat "which thread was open here" memory, the state behind
// "closing a chat closes its thread; reopening the chat brings the
// thread back unless the user closed it by hand".

const makeThread = (): ThreadProps =>
    ({
        chatId: "chat-a",
        chatName: "Chat A",
        chatType: 1,
        messages: [],
        taskId: null,
        threadId: "thread-x",
        TSLastMessage: "",
    }) as unknown as ThreadProps;

describe("threadMemory", () => {
    beforeEach(() => {
        localStorage.clear();
    });

    it("recalls a remembered thread for the same chat", () => {
        rememberThread(1, "chat-a", "thread-x");
        expect(recallThread(1, "chat-a")).toBe("thread-x");
    });

    it("scopes memory per chat, so another chat does not inherit it", () => {
        rememberThread(1, "chat-a", "thread-x");
        expect(recallThread(1, "chat-b")).toBeUndefined();
    });

    it("scopes memory per chat TYPE, so a colliding id is not confused", () => {
        rememberThread(1, "7", "thread-dm");
        rememberThread(2, "7", "thread-gm");
        expect(recallThread(1, "7")).toBe("thread-dm");
        expect(recallThread(2, "7")).toBe("thread-gm");
    });

    it("treats numeric and string chat ids as the same chat", () => {
        rememberThread(3, 42, 99);
        expect(recallThread(3, "42")).toBe(99);
    });

    it("forgets on an explicit close, which is what stops the reopen", () => {
        rememberThread(1, "chat-a", "thread-x");
        forgetThread(1, "chat-a");
        expect(recallThread(1, "chat-a")).toBeUndefined();
    });

    it("overwrites the entry when a different thread is opened in the chat", () => {
        rememberThread(1, "chat-a", "thread-x");
        rememberThread(1, "chat-a", "thread-y");
        expect(recallThread(1, "chat-a")).toBe("thread-y");
    });

    it("survives a corrupted storage value instead of throwing", () => {
        localStorage.setItem("chatThreadMemory", "not json{{");
        expect(recallThread(1, "chat-a")).toBeUndefined();
        // …and can still be written to afterwards.
        rememberThread(1, "chat-a", "thread-x");
        expect(recallThread(1, "chat-a")).toBe("thread-x");
    });

    it("survives a non-object storage value", () => {
        localStorage.setItem("chatThreadMemory", "[1,2,3]");
        expect(recallThread(1, "chat-a")).toBeUndefined();
    });
});

describe("threadUrlToken", () => {
    // The URL addresses a PM thread by its numeric task id but a
    // DM/GM/MDM thread by the thread-root UUID. Storing the wrong one
    // yields a /thread/… path that can't be resolved, so the reopen
    // fails silently — this is the regression guard for that.
    it("uses the task id for a PM thread", () => {
        const thread = makeThread();
        expect(threadUrlToken({ ...thread, chatType: 3, taskId: 512 })).toBe(512);
    });

    it("uses the thread root id for DM / GM / MDM threads", () => {
        const thread = makeThread();
        expect(threadUrlToken({ ...thread, chatType: 1, threadId: "uuid-1" })).toBe("uuid-1");
        expect(threadUrlToken({ ...thread, chatType: 2, threadId: "uuid-2" })).toBe("uuid-2");
        expect(threadUrlToken({ ...thread, chatType: 4, threadId: "uuid-4" })).toBe("uuid-4");
    });

    it("falls back to the thread root id for a PM thread with no task", () => {
        const thread = makeThread();
        expect(threadUrlToken({ ...thread, chatType: 3, taskId: null, threadId: "uuid-3" })).toBe(
            "uuid-3"
        );
    });
});
