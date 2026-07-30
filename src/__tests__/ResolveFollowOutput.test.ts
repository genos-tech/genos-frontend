import { describe, expect, it } from "vitest";

import { resolveFollowOutput, resolveOwnAppend } from "../features/chat/utils/resolveFollowOutput";

describe("resolveOwnAppend", () => {
    it("is true when a row I authored lands at the end of a non-empty list", () => {
        expect(resolveOwnAppend({ count: 11, isOwnTail: true, prevCount: 10 })).toBe(true);
    });

    it("is false when the new tail row is someone else's", () => {
        expect(resolveOwnAppend({ count: 11, isOwnTail: false, prevCount: 10 })).toBe(false);
    });

    it("is false on the first fill, even if the newest row is mine", () => {
        // Mount / cold-channel sync. Landing at the bottom there is
        // `initialTopMostItemIndex`'s job; forcing it here would fight a
        // deep link that had already scrolled to its target.
        expect(resolveOwnAppend({ count: 40, isOwnTail: true, prevCount: 0 })).toBe(false);
    });

    it("is false when the count did not grow (optimistic echo swapped for the server row)", () => {
        // The tail key changes when the correlation id becomes the real
        // message id, but no new row arrived.
        expect(resolveOwnAppend({ count: 10, isOwnTail: true, prevCount: 10 })).toBe(false);
    });

    it("is false when the newest row was deleted and an older one of mine became the tail", () => {
        expect(resolveOwnAppend({ count: 9, isOwnTail: true, prevCount: 10 })).toBe(false);
    });
});

describe("resolveFollowOutput", () => {
    it("follows my own append even when I have scrolled away from the bottom", () => {
        expect(resolveFollowOutput({ isAtBottom: false, isOwnAppend: true })).toBe("auto");
    });

    it("follows someone else's message while I am at the bottom", () => {
        expect(resolveFollowOutput({ isAtBottom: true, isOwnAppend: false })).toBe("auto");
    });

    it("does NOT follow someone else's message while I am reading history", () => {
        expect(resolveFollowOutput({ isAtBottom: false, isOwnAppend: false })).toBe(false);
    });
});
