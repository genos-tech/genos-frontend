/**
 * MIP-2229: the scroll hooks read their latest inputs through refs instead of listing them as
 * effect deps. These tests pin WHEN each effect fires: only on the original triggers (chat,
 * indexMap, messages), never because another input changed, and always with the latest values.
 */
import { renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
    useScrollToBottomOnChatChange,
    useScrollToBottomOnNewActivity,
    useScrollToBottomOnNewMessage,
} from "../features/chat/hooks/messageBubbleHooks";
import type { ActivityMessageProps } from "../types/chat";

const makeRef = () => {
    const scrollToIndex = vi.fn();
    return { scrollToIndex, ref: { current: { scrollToIndex } } as never };
};

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe("useScrollToBottomOnNewMessage", () => {
    it("fires once per chat change, with the latest targetIndex, not on a targetIndex change", () => {
        const { scrollToIndex, ref } = makeRef();
        const { rerender } = renderHook(
            ({ chat, idx }) => useScrollToBottomOnNewMessage(ref, chat, idx),
            { initialProps: { chat: "a", idx: 1 } }
        );
        vi.advanceTimersByTime(250);
        expect(scrollToIndex).toHaveBeenCalledTimes(1);
        expect(scrollToIndex.mock.calls[0][0].index).toBe(1);

        rerender({ chat: "a", idx: 5 });
        vi.advanceTimersByTime(250);
        expect(scrollToIndex).toHaveBeenCalledTimes(1);

        rerender({ chat: "b", idx: 7 });
        vi.advanceTimersByTime(250);
        expect(scrollToIndex).toHaveBeenCalledTimes(2);
        expect(scrollToIndex.mock.calls[1][0].index).toBe(7);
    });
});

describe("useScrollToBottomOnChatChange", () => {
    const range = { current: { startIndex: 0, endIndex: 0 } };
    const run = (over: Record<string, unknown> = {}) => {
        const { scrollToIndex, ref } = makeRef();
        const base = {
            chatId: 1,
            maxIndex: 10,
            indexMap: {} as Record<string, number>,
            moveTo: undefined as string | undefined,
            notMove: false as boolean | undefined,
            firstUnread: null as number | null,
            ...over,
        };
        const hook = renderHook(
            (p: typeof base) =>
                useScrollToBottomOnChatChange(
                    ref,
                    p.chatId,
                    range,
                    p.maxIndex,
                    p.indexMap,
                    p.moveTo,
                    p.notMove,
                    p.firstUnread
                ),
            { initialProps: base }
        );
        return { scrollToIndex, ...hook, base };
    };

    it("scrolls to LAST on open, and re-fires only when chat id or indexMap changes", () => {
        const { scrollToIndex, rerender, base } = run();
        vi.advanceTimersByTime(350);
        expect(scrollToIndex).toHaveBeenCalledTimes(1);
        expect(scrollToIndex).toHaveBeenLastCalledWith({ behavior: "auto", index: "LAST" });

        // other inputs changing must not re-fire
        rerender({ ...base, maxIndex: 11, notMove: false, moveTo: undefined, firstUnread: 3 });
        vi.advanceTimersByTime(350);
        expect(scrollToIndex).toHaveBeenCalledTimes(1);

        // a new indexMap (message arrived) does
        rerender({ ...base, maxIndex: 11, indexMap: { x: 1 } });
        vi.advanceTimersByTime(350);
        expect(scrollToIndex).toHaveBeenCalledTimes(2);
    });

    it("reads the LIVE values at fire time (moveToSpecificIndex stands the scroll down)", () => {
        const { scrollToIndex, rerender, base } = run();
        vi.advanceTimersByTime(350);
        expect(scrollToIndex).toHaveBeenCalledTimes(1);
        rerender({ ...base, indexMap: { x: 1 }, moveTo: "m-1" });
        vi.advanceTimersByTime(350);
        expect(scrollToIndex).toHaveBeenCalledTimes(1);
    });

    it("stays put when notMove is set and the reader is far from the bottom", () => {
        range.current = { startIndex: 0, endIndex: 2 };
        const { scrollToIndex, rerender, base } = run();
        vi.advanceTimersByTime(350);
        scrollToIndex.mockClear();
        rerender({ ...base, indexMap: { x: 1 }, notMove: true });
        vi.advanceTimersByTime(350);
        expect(scrollToIndex).not.toHaveBeenCalled();
        range.current = { startIndex: 0, endIndex: 0 };
    });

    it("stands down on the OPEN fire when a first unread index exists", () => {
        const { scrollToIndex, rerender, base } = run({ firstUnread: 4 });
        vi.advanceTimersByTime(350);
        expect(scrollToIndex).not.toHaveBeenCalled();
        rerender({ ...base, indexMap: { x: 1 } });
        vi.advanceTimersByTime(350);
        expect(scrollToIndex).toHaveBeenCalledTimes(1);
    });
});

describe("useScrollToBottomOnNewActivity", () => {
    it("fires on a new activity list only, and honours the latest notMove", () => {
        const { scrollToIndex, ref } = makeRef();
        const first: ActivityMessageProps[] = [];
        const { rerender } = renderHook(
            ({ acts, notMove }) => useScrollToBottomOnNewActivity(ref, acts, notMove),
            { initialProps: { acts: first, notMove: false } }
        );
        vi.advanceTimersByTime(350);
        expect(scrollToIndex).toHaveBeenCalledTimes(1);

        rerender({ acts: first, notMove: true });
        vi.advanceTimersByTime(350);
        expect(scrollToIndex).toHaveBeenCalledTimes(1);

        rerender({ acts: [], notMove: true });
        vi.advanceTimersByTime(350);
        expect(scrollToIndex).toHaveBeenCalledTimes(1);

        rerender({ acts: [], notMove: false });
        vi.advanceTimersByTime(350);
        expect(scrollToIndex).toHaveBeenCalledTimes(2);
    });
});
