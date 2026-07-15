import { describe, expect, it } from "vitest";

import { NEAR_LAST_SLACK, resolveJumpScroll } from "../features/chat/utils/resolveJumpScroll";

// Shorthand: a 100-message chat (indices 0..99).
const LAST = 99;
const call = (over: Partial<Parameters<typeof resolveJumpScroll>[0]> = {}) =>
    resolveJumpScroll({
        lastHandledKey: null,
        lastIndex: LAST,
        resolvedIndex: 40,
        targetKey: "dm-1:msg-uuid",
        ...over,
    });

describe("resolveJumpScroll", () => {
    it("centres the target when it sits well above the newest message", () => {
        expect(call({ resolvedIndex: 40 })).toEqual({
            align: "center",
            index: 40,
            kind: "index",
        });
    });

    it("scrolls to the bottom when the target is the newest message", () => {
        // The reported bug: clicking an activity for a recent message left
        // the pane where it was. Going to LAST guarantees it's on screen.
        expect(call({ resolvedIndex: LAST })).toEqual({ kind: "last" });
    });

    it("scrolls to the bottom when the target is NEAR the newest message", () => {
        // The user's case: "not many (3~5) newer messages".
        for (const newerCount of [1, 2, 3, 4, 5]) {
            expect(call({ resolvedIndex: LAST - newerCount })).toEqual({ kind: "last" });
        }
    });

    it("switches from LAST to a centred jump just outside the near-last window", () => {
        // Pin the boundary so the threshold can't drift unnoticed.
        expect(call({ resolvedIndex: LAST - NEAR_LAST_SLACK })).toEqual({ kind: "last" });
        expect(call({ resolvedIndex: LAST - NEAR_LAST_SLACK - 1 })).toEqual({
            align: "center",
            index: LAST - NEAR_LAST_SLACK - 1,
            kind: "index",
        });
    });

    it("jumps to index 0 rather than treating it as 'not found'", () => {
        // `indexMap[key]` is 0 for the oldest loaded message, which the old
        // truthy check read as missing — so that jump silently did nothing.
        expect(call({ resolvedIndex: 0 })).toEqual({ align: "center", index: 0, kind: "index" });
    });

    it("does nothing when the pane was opened without a focus target", () => {
        expect(call({ targetKey: null })).toEqual({ kind: "none" });
    });

    it("does nothing for a target it has already scrolled to", () => {
        // The effect re-runs on every indexMap change (message arrives,
        // background sync patches the slice). Re-scrolling then would yank
        // the reader back to a jump they already finished.
        expect(call({ lastHandledKey: "dm-1:msg-uuid", targetKey: "dm-1:msg-uuid" })).toEqual({
            kind: "none",
        });
    });

    it("still jumps when a different target is requested in the same chat", () => {
        expect(call({ lastHandledKey: "dm-1:other-uuid", targetKey: "dm-1:msg-uuid" })).toEqual({
            align: "center",
            index: 40,
            kind: "index",
        });
    });

    it("holds off — WITHOUT consuming the target — while the id is unresolved", () => {
        // Clicking an activity paints from the cached slice, which often
        // lacks a brand-new message; the id only resolves once the
        // background sync lands. Returning "none" here (and the caller not
        // recording the key) is what lets the retry succeed.
        expect(call({ resolvedIndex: undefined })).toEqual({ kind: "none" });
        expect(call({ resolvedIndex: null })).toEqual({ kind: "none" });
    });

    it("jumps on the retry once a previously-unresolved target lands", () => {
        // First attempt: not in the loaded slice.
        expect(call({ lastHandledKey: null, resolvedIndex: null })).toEqual({ kind: "none" });
        // Sync patched it in as the newest message → the caller's ref is
        // still null (nothing was scrolled), so this attempt lands.
        expect(call({ lastHandledKey: null, resolvedIndex: LAST })).toEqual({ kind: "last" });
    });

    it("ignores a nonsense index instead of scrolling somewhere arbitrary", () => {
        expect(call({ resolvedIndex: -1 })).toEqual({ kind: "none" });
        expect(call({ resolvedIndex: Number.NaN })).toEqual({ kind: "none" });
    });

    it("does nothing on an empty message list", () => {
        expect(call({ lastIndex: -1, resolvedIndex: null })).toEqual({ kind: "none" });
    });

    it("treats the same message id in two different threads as two jumps", () => {
        expect(
            call({ lastHandledKey: "pm-1:thread-9:msg-uuid", targetKey: "pm-1:thread-7:msg-uuid" })
        ).toEqual({ align: "center", index: 40, kind: "index" });
    });
});
