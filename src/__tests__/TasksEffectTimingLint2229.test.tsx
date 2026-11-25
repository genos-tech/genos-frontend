import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useAdoptableTitleDraft } from "../features/tasks/components/contents/utils/useAdoptableTitleDraft";
import {
    useScrollToBottomOnNewTaskComment,
    useScrollToTaskCommentByCommentId,
} from "../features/tasks/hooks/taskCommentHooks";
import type { TaskCommentProps } from "../types/tasks";

// MIP-2229: exhaustive-deps fixes in features/tasks must not move WHEN an effect runs.

const comments = (n: number) =>
    Array.from({ length: n }, (_, i) => ({ commentId: i + 1 }) as unknown as TaskCommentProps);

describe("task comment scroll hooks keep their timing", () => {
    beforeEach(() => vi.useFakeTimers());
    afterEach(() => vi.useRealTimers());

    const makeRef = () => {
        const scrollToIndex = vi.fn();
        return { ref: { current: { scrollToIndex } } as never, scrollToIndex };
    };

    it("scrolls to the end when the comment list changes", () => {
        const { ref, scrollToIndex } = makeRef();
        const list1 = comments(1);
        const { rerender } = renderHook(
            ({ list }) => useScrollToBottomOnNewTaskComment(ref, list, true),
            { initialProps: { list: list1 } }
        );
        act(() => void vi.advanceTimersByTime(300));
        expect(scrollToIndex).toHaveBeenCalledTimes(1);
        rerender({ list: comments(2) });
        act(() => void vi.advanceTimersByTime(300));
        expect(scrollToIndex).toHaveBeenCalledTimes(2);
    });

    it("does NOT scroll when only the scrollToBottom flag flips", () => {
        const { ref, scrollToIndex } = makeRef();
        const list = comments(1);
        const { rerender } = renderHook(
            ({ flag }) => useScrollToBottomOnNewTaskComment(ref, list, flag),
            { initialProps: { flag: false } }
        );
        act(() => void vi.advanceTimersByTime(300));
        expect(scrollToIndex).not.toHaveBeenCalled();
        rerender({ flag: true });
        act(() => void vi.advanceTimersByTime(300));
        expect(scrollToIndex).not.toHaveBeenCalled();
    });

    it("deep link scrolls once per list/id change, not per render", () => {
        const { ref, scrollToIndex } = makeRef();
        const list = comments(3);
        const { rerender } = renderHook(
            ({ id }) => useScrollToTaskCommentByCommentId(ref, list, id),
            { initialProps: { id: 2 as number | undefined } }
        );
        act(() => void vi.advanceTimersByTime(300));
        expect(scrollToIndex).toHaveBeenCalledTimes(1);
        rerender({ id: 2 });
        act(() => void vi.advanceTimersByTime(300));
        expect(scrollToIndex).toHaveBeenCalledTimes(1);
        rerender({ id: 3 });
        act(() => void vi.advanceTimersByTime(300));
        expect(scrollToIndex).toHaveBeenCalledTimes(2);
    });
});

describe("useAdoptableTitleDraft identity switch", () => {
    it("re-seeds on an id change with the latest title, not on a title change alone", () => {
        const { result, rerender } = renderHook(
            ({ id, title }) => useAdoptableTitleDraft(id, title),
            { initialProps: { id: 1, title: "A" } }
        );
        expect(result.current.titleDraft).toBe("A");
        act(() => result.current.setTitleDraft("typed"));
        // A title refresh while dirty must not clobber the keystrokes.
        rerender({ id: 1, title: "B" });
        expect(result.current.titleDraft).toBe("typed");
        // A different entity wins, and reads ITS title (the one in the same render).
        rerender({ id: 2, title: "C" });
        expect(result.current.titleDraft).toBe("C");
    });
});
