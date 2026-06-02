import { describe, expect, it } from "vitest";

import { EMPTY_ROUTE, parseChatRoute } from "../../features/chat/utils/parseChatRoute";

// `parseChatRoute` takes a pathname (what `useChatRouting` reads from
// `location.pathname`), not a full URL. Post the v3 migration chatId and
// DM/GM/MDM threadId are UUID strings, while PM keeps a numeric task_id —
// the parser must preserve that distinction (see the type-aware threadId
// cases below), which is the bug this extraction was made testable for.
const CHAT_UUID = "873e9667-065d-44d9-94ad-c6c2c4d3706e";
const THREAD_UUID = "2fa7e71d-ac74-44b5-b22b-d6e11082b594";

describe("parseChatRoute - non-chat / empty", () => {
    it("returns the empty route when there is no `chat` segment", () => {
        expect(parseChatRoute("/workspace/tasks/project/1/task/2")).toBe(EMPTY_ROUTE);
        expect(parseChatRoute("/home")).toBe(EMPTY_ROUTE);
        expect(parseChatRoute("/")).toBe(EMPTY_ROUTE);
    });
});

describe("parseChatRoute - chat main", () => {
    it("parses a chat type with no chatId", () => {
        expect(parseChatRoute("/workspace/chat/dm")).toEqual({
            chatType: "dm",
            chatId: undefined,
            threadId: undefined,
            messageId: undefined,
            commentId: undefined,
        });
    });

    it("keeps a legacy numeric chatId as the raw string (never Number()-coerced)", () => {
        expect(parseChatRoute("/workspace/chat/dm/5")).toEqual({
            chatType: "dm",
            chatId: "5",
            threadId: undefined,
            messageId: undefined,
            commentId: undefined,
        });
    });

    it("keeps a v3 UUID chatId verbatim", () => {
        expect(parseChatRoute(`/workspace/chat/dm/${CHAT_UUID}`)).toMatchObject({
            chatType: "dm",
            chatId: CHAT_UUID,
            threadId: undefined,
        });
    });

    it("preserves the chat type token verbatim for every kind", () => {
        for (const kind of ["dm", "gm", "pm", "mdm", "activity", "flagged"]) {
            expect(parseChatRoute(`/workspace/chat/${kind}/5`)).toMatchObject({ chatType: kind });
        }
    });

    it("captures a numeric messageId on a main-chat deep link", () => {
        expect(parseChatRoute(`/workspace/chat/dm/${CHAT_UUID}/message/99`)).toMatchObject({
            chatId: CHAT_UUID,
            messageId: 99,
            threadId: undefined,
        });
    });
});

describe("parseChatRoute - thread (type-aware threadId)", () => {
    it("keeps a DM/GM/MDM thread-root UUID as a string (was NaN'd by Number())", () => {
        expect(
            parseChatRoute(`/workspace/chat/dm/${CHAT_UUID}/thread/${THREAD_UUID}`)
        ).toMatchObject({
            chatType: "dm",
            chatId: CHAT_UUID,
            threadId: THREAD_UUID,
        });
    });

    it("keeps a PM thread segment NUMERIC (it is the task_id, not a UUID)", () => {
        const route = parseChatRoute("/workspace/chat/pm/1/thread/42");
        expect(route).toMatchObject({ chatType: "pm", chatId: "1", threadId: 42 });
        // The number-vs-string distinction is load-bearing: PM feeds
        // `resolveV3ThreadRootUuid`'s numeric task-id lookup, DM/GM/MDM
        // its UUID pass-through. Guard the runtime type explicitly.
        expect(typeof route.threadId).toBe("number");
    });

    it("focuses a numeric messageId inside a UUID thread", () => {
        expect(
            parseChatRoute(`/workspace/chat/dm/${CHAT_UUID}/thread/${THREAD_UUID}/message/99`)
        ).toMatchObject({
            chatId: CHAT_UUID,
            threadId: THREAD_UUID,
            messageId: 99,
            commentId: undefined,
        });
    });

    it("captures a commentId on a PM thread (Comments tab deep link)", () => {
        expect(parseChatRoute("/workspace/chat/pm/1/thread/42/comment/7")).toMatchObject({
            chatType: "pm",
            threadId: 42,
            commentId: 7,
            messageId: undefined,
        });
    });

    it("treats a `/thread` segment with no value as no thread", () => {
        expect(parseChatRoute("/workspace/chat/dm/5/thread")).toMatchObject({
            chatId: "5",
            threadId: undefined,
        });
    });
});
