import { describe, expect, it } from "vitest";

import { resolveFirstUnreadIndex } from "../features/chat/utils/firstUnread";

// Rows as the list paints them: each carries the v3 UUID the read cursor
// points at. `messageIdWithChatId` is the top-level key; the thread variant
// uses `messageIdWithChatIdAndThreadId` (see `indexMap` / `getMessageKey`).
const topRows = (...ids: (string | undefined)[]) =>
    ids.map((id) => (id === undefined ? {} : { messageIdWithChatId: id }));
const threadRows = (...ids: (string | undefined)[]) =>
    ids.map((id) => (id === undefined ? {} : { messageIdWithChatIdAndThreadId: id }));

describe("resolveFirstUnreadIndex", () => {
    it("returns the index AFTER the cursor (the first unread message)", () => {
        // Cursor points at index 1; the first unread is index 2.
        expect(resolveFirstUnreadIndex(topRows("a", "b", "c", "d"), "b", false)).toBe(2);
    });

    it("returns null (land at bottom) when the cursor is the last message", () => {
        // Everything is read — nothing to land on above the bottom.
        expect(resolveFirstUnreadIndex(topRows("a", "b", "c"), "c", false)).toBeNull();
    });

    it("returns 1 when only the first message has been read", () => {
        expect(resolveFirstUnreadIndex(topRows("a", "b", "c"), "a", false)).toBe(1);
    });

    it("returns null when there is no cursor (never-read channel)", () => {
        // Per product, a never-read channel opens at the latest message.
        expect(resolveFirstUnreadIndex(topRows("a", "b", "c"), null, false)).toBeNull();
        expect(resolveFirstUnreadIndex(topRows("a", "b", "c"), undefined, false)).toBeNull();
        expect(resolveFirstUnreadIndex(topRows("a", "b", "c"), "", false)).toBeNull();
    });

    it("returns null when the cursor message aged out of the loaded slice", () => {
        // Cursor points at a UUID no longer in the rendered array (retention /
        // pagination edge) — can't place first-unread, so land at the bottom.
        expect(resolveFirstUnreadIndex(topRows("b", "c", "d"), "a", false)).toBeNull();
    });

    it("returns null for an empty message list", () => {
        expect(resolveFirstUnreadIndex([], "a", false)).toBeNull();
    });

    it("uses the thread key when isThread is true", () => {
        // Thread rows key on `messageIdWithChatIdAndThreadId`; the top-level
        // key must be ignored so the cursor resolves against the right field.
        expect(resolveFirstUnreadIndex(threadRows("t1", "t2", "t3"), "t1", true)).toBe(1);
    });

    it("does not match a thread cursor against the top-level key (and vice versa)", () => {
        // A thread cursor must not resolve against `messageIdWithChatId`.
        expect(resolveFirstUnreadIndex(topRows("t1", "t2"), "t1", true)).toBeNull();
        // ...and a top-level cursor must not resolve against the thread key.
        expect(resolveFirstUnreadIndex(threadRows("a", "b"), "a", false)).toBeNull();
    });

    it("matches the FIRST occurrence when a UUID somehow repeats", () => {
        // Defensive: ids are unique in practice, but the scan takes the first
        // hit, so first-unread is the row after the earliest match.
        expect(resolveFirstUnreadIndex(topRows("a", "b", "a", "c"), "a", false)).toBe(1);
    });

    it("skips rows with no UUID (optimistic / legacy) when locating the cursor", () => {
        // A row without a v3 UUID can't be the cursor; the cursor still
        // resolves against the real-UUID row and first-unread is the next row.
        expect(resolveFirstUnreadIndex(topRows("a", undefined, "b", "c"), "b", false)).toBe(3);
    });
});
