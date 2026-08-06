/**
 * `/message/:id` → focus-key resolution.
 *
 * The regression these guard: the focus key used to be built as the
 * pre-v3 composite `{chatId}-{messageId}`, which matches no row now that
 * the list keys on the bare v3 `Message.id`. So a message link opened the
 * chat and focused nothing. Both URL id shapes have to land on the UUID.
 */

import { describe, expect, it } from "vitest";

import {
    focusUuidForMainChat,
    focusUuidForThread,
} from "../../features/chat/utils/messageFocusKey";
import type { MessageProps, ThreadMessageProps } from "../../types/chat";

const message = (seq: number, uuid: string, taskId: number | null = null): MessageProps =>
    ({
        chatId: "ch-1" as unknown as number,
        chatType: 1,
        messageId: seq,
        messageIdWithChatId: uuid,
        taskId,
    }) as unknown as MessageProps;

const reply = (seq: number, uuid: string): ThreadMessageProps =>
    ({
        chatId: "ch-1" as unknown as number,
        chatType: 1,
        messageId: seq,
        messageIdWithChatIdAndThreadId: uuid,
    }) as unknown as ThreadMessageProps;

const MESSAGES = [
    message(109, "aaaaaaaa-1111-4111-8111-111111111111"),
    message(111, "bbbbbbbb-2222-4222-8222-222222222222"),
];

describe("focusUuidForMainChat", () => {
    it("resolves a numeric seq to the row's v3 uuid", () => {
        // The shape "Copy link to message" builds, and the one the user
        // reported: /workspace/chat/dm/<channel>/message/111.
        expect(focusUuidForMainChat(111, 1, MESSAGES)).toBe(
            "bbbbbbbb-2222-4222-8222-222222222222"
        );
    });

    it("passes a v3 uuid segment through (Spotlight / citation links)", () => {
        expect(focusUuidForMainChat("cccccccc-3333-4333-8333-333333333333", 1, MESSAGES)).toBe(
            "cccccccc-3333-4333-8333-333333333333"
        );
    });

    it("never returns the legacy composite key", () => {
        expect(focusUuidForMainChat(111, 1, MESSAGES)).not.toContain("-111");
    });

    it("returns undefined when the seq isn't among the loaded rows", () => {
        // Undefined (not a synthesized key) so `useScrollManagement` can
        // retry once the row pages in.
        expect(focusUuidForMainChat(999, 1, MESSAGES)).toBeUndefined();
    });

    it("matches a PM segment by task id first — PM links name the task", () => {
        const cards = [
            message(4, "dddddddd-4444-4444-8444-444444444444", 77),
            message(77, "eeeeeeee-5555-4555-8555-555555555555", 12),
        ];
        expect(focusUuidForMainChat(77, 3, cards)).toBe("dddddddd-4444-4444-8444-444444444444");
    });

    it("falls back to the seq for a PM link that carries one", () => {
        const cards = [message(4, "dddddddd-4444-4444-8444-444444444444", 77)];
        expect(focusUuidForMainChat(4, 3, cards)).toBe("dddddddd-4444-4444-8444-444444444444");
    });
});

describe("focusUuidForThread", () => {
    const replies = [
        reply(2, "11111111-aaaa-4aaa-8aaa-aaaaaaaaaaaa"),
        reply(3, "22222222-bbbb-4bbb-8bbb-bbbbbbbbbbbb"),
    ];

    it("focuses the reply the link names", () => {
        expect(focusUuidForThread(3, replies)).toBe("22222222-bbbb-4bbb-8bbb-bbbbbbbbbbbb");
    });

    it("falls back to the top of the thread when no message is named", () => {
        expect(focusUuidForThread(undefined, replies)).toBe(
            "11111111-aaaa-4aaa-8aaa-aaaaaaaaaaaa"
        );
    });

    it("also falls back to the top when the named reply isn't loaded", () => {
        expect(focusUuidForThread(404, replies)).toBe("11111111-aaaa-4aaa-8aaa-aaaaaaaaaaaa");
    });

    it("matches a uuid segment against the reply ids", () => {
        expect(focusUuidForThread("22222222-bbbb-4bbb-8bbb-bbbbbbbbbbbb", replies)).toBe(
            "22222222-bbbb-4bbb-8bbb-bbbbbbbbbbbb"
        );
    });
});
