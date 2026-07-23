import { beforeEach, describe, expect, it } from "vitest";

import {
    forgetThread,
    recallThread,
    rememberThread,
    resolveThreadRestore,
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

describe("resolveThreadRestore", () => {
    // The reported sequence:
    //   1. open chat-a + its thread
    //   2. open chat-b   → thread closes (correct)
    //   3. open chat-a   → its thread must come back
    //
    // Step 3 regressed because after step 2 the URL still read
    // `/chat/dm/a/thread/X`: the main-chat URL effect bails while a
    // thread is visible and never re-runs once it closes. A plain
    // "is there a /thread/ segment?" guard then read that leftover as a
    // deep link and suppressed the restore permanently.
    it("restores the thread when the URL still describes the chat we LEFT", () => {
        expect(
            resolveThreadRestore({
                mainChatKey: "1:chat-a",
                remembered: "thread-x",
                // Stale: URL points at a DIFFERENT chat than the open one.
                urlChatKey: "1:chat-b",
                urlHasExplicitTarget: false,
            })
        ).toBe("restore-thread");
    });

    it("restores even when the stale URL carries a thread segment for another chat", () => {
        expect(
            resolveThreadRestore({
                mainChatKey: "1:chat-a",
                remembered: "thread-x",
                urlChatKey: "1:chat-b",
                urlHasExplicitTarget: true,
            })
        ).toBe("restore-thread");
    });

    it("lets a real deep link INTO this chat outrank the memory", () => {
        expect(
            resolveThreadRestore({
                mainChatKey: "1:chat-a",
                remembered: "thread-x",
                urlChatKey: "1:chat-a",
                urlHasExplicitTarget: true,
            })
        ).toBe("keep-url");
    });

    it("falls back to the plain chat view when nothing is remembered", () => {
        expect(
            resolveThreadRestore({
                mainChatKey: "1:chat-b",
                remembered: undefined,
                urlChatKey: "1:chat-a",
                urlHasExplicitTarget: true,
            })
        ).toBe("chat-only");
    });

    it("stays closed after a manual close, which forgot the entry", () => {
        expect(
            resolveThreadRestore({
                mainChatKey: "1:chat-a",
                remembered: undefined,
                urlChatKey: "1:chat-a",
                urlHasExplicitTarget: false,
            })
        ).toBe("chat-only");
    });

    it("restores on a cold load, where the URL has no chat at all", () => {
        expect(
            resolveThreadRestore({
                mainChatKey: "1:chat-a",
                remembered: "thread-x",
                urlChatKey: undefined,
                urlHasExplicitTarget: false,
            })
        ).toBe("restore-thread");
    });

    it("does not confuse the same chat id across chat types", () => {
        // `/chat/gm/7` open while the DM with id 7 is remembered.
        expect(
            resolveThreadRestore({
                mainChatKey: "2:7",
                remembered: undefined,
                urlChatKey: "1:7",
                urlHasExplicitTarget: true,
            })
        ).toBe("chat-only");
    });
});

describe("the reported three-step sequence, end to end", () => {
    beforeEach(() => localStorage.clear());

    const decide = (mainChatKey: string, urlChatKey: string, urlHasExplicitTarget: boolean) =>
        resolveThreadRestore({
            mainChatKey,
            remembered: recallThread(Number(mainChatKey.split(":")[0]), mainChatKey.split(":")[1]),
            urlChatKey,
            urlHasExplicitTarget,
        });

    it("reopens chat-a's thread on return, and keeps it closed after a manual close", () => {
        // 1. chat-a + thread-x open → recorded.
        rememberThread(1, "chat-a", "thread-x");

        // 2. open chat-b. URL is still chat-a's thread path at this point.
        expect(decide("1:chat-b", "1:chat-a", true)).toBe("chat-only");

        // 3. back to chat-a → the thread returns.
        expect(decide("1:chat-a", "1:chat-b", false)).toBe("restore-thread");

        // 4. user closes it by hand, then leaves and returns → stays closed.
        forgetThread(1, "chat-a");
        expect(decide("1:chat-b", "1:chat-a", false)).toBe("chat-only");
        expect(decide("1:chat-a", "1:chat-b", false)).toBe("chat-only");
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
