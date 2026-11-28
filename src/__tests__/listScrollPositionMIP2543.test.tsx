/**
 * Lists keep the reader's place when their data changes (MIP-2543).
 *
 * jsdom has no layout, so these hold the decisions (what is asked of the list); the real scroll
 * positions were checked in a browser.
 */
import { forwardRef, useImperativeHandle } from "react";
import { CssVarsProvider } from "@mui/joy/styles";
import { act, render, renderHook } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import type { VirtuosoHandle } from "react-virtuoso";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useShowReorderedChat } from "../features/chat/hooks/useShowReorderedChat";
import { InboxSection } from "../features/inbox/components/InboxSection";
import { countNewAtTop, useInboxListPosition } from "../features/inbox/hooks/useInboxListPosition";
import { useScrollToTaskCommentByCommentId } from "../features/tasks/hooks/taskCommentHooks";
import type { AllChatProps } from "../types/chat";
import type { InboxItemProps } from "../types/common";
import type { TaskCommentProps } from "../types/tasks";

const scrollToIndex = vi.fn();

vi.mock("react-virtuoso", () => ({
    Virtuoso: forwardRef((_props, ref) => {
        useImperativeHandle(ref, () => ({ scrollToIndex }));
        return <div />;
    }),
}));

const inbox = (ids: number[], read = false) =>
    ids.map((itemId) => ({ itemId, isRead: read })) as InboxItemProps[];

beforeEach(() => scrollToIndex.mockClear());

describe("countNewAtTop", () => {
    it("counts only items that arrived above the listed ones", () => {
        expect(countNewAtTop(inbox([3, 2, 1]), inbox([3, 2, 1], true))).toBe(0);
        expect(countNewAtTop(inbox([3, 2, 1]), inbox([5, 4, 3, 2, 1]))).toBe(2);
        expect(countNewAtTop(inbox([3, 2, 1]), inbox([2, 1]))).toBe(0);
        expect(countNewAtTop(inbox([2, 1]), inbox([2, 1, 0]))).toBe(0);
        expect(countNewAtTop(inbox([]), inbox([2, 1]))).toBe(0);
    });
});

describe("useInboxListPosition", () => {
    const setup = () => {
        const hook = renderHook(({ items }) => useInboxListPosition(items), {
            initialProps: { items: inbox([3, 2, 1]) },
        });
        hook.result.current.virtuosoRef.current = { scrollToIndex } as unknown as VirtuosoHandle;
        return hook;
    };

    it("a read flip moves nothing, at the top or scrolled down", () => {
        const { result, rerender } = setup();
        const start = result.current.firstItemIndex;
        rerender({ items: inbox([3, 2, 1], true) });
        act(() => result.current.atTopStateChange(false));
        rerender({ items: inbox([3, 2, 1]) });
        expect(result.current.firstItemIndex).toBe(start);
        expect(scrollToIndex).not.toHaveBeenCalled();
    });

    it("a new item shows when the person is at the top", () => {
        const { result, rerender } = setup();
        const start = result.current.firstItemIndex;
        rerender({ items: inbox([4, 3, 2, 1]) });
        expect(scrollToIndex).toHaveBeenCalledWith({ index: 0, behavior: "auto" });
        expect(result.current.firstItemIndex).toBe(start);
    });

    it("a new item leaves a scrolled list where it is", () => {
        const { result, rerender } = setup();
        const start = result.current.firstItemIndex;
        act(() => result.current.atTopStateChange(false));
        rerender({ items: inbox([5, 4, 3, 2, 1]) });
        expect(scrollToIndex).not.toHaveBeenCalled();
        expect(result.current.firstItemIndex).toBe(start - 2);
    });
});

const wrapper = ({ children }: { children: React.ReactNode }) => (
    <CssVarsProvider>
        <MemoryRouter>{children}</MemoryRouter>
    </CssVarsProvider>
);

describe("InboxSection selected item", () => {
    const section = (items: InboxItemProps[], selectedItemId?: number) => (
        <InboxSection
            itemKeyPrefix="a"
            items={items}
            myself={{} as never}
            selectedItemId={selectedItemId}
            setMyself={() => {}}
            socket={null}
            useCM={{} as never}
            useTEM={{} as never}
            useUISM={{} as never}
            onItemChanged={() => {}}
        />
    );

    it("scrolls to it once per selection, not on every change of the list", () => {
        const { rerender } = render(section(inbox([3, 2, 1]), 2), { wrapper });
        expect(scrollToIndex).toHaveBeenCalledTimes(1);
        rerender(section(inbox([3, 2, 1], true), 2));
        expect(scrollToIndex).toHaveBeenCalledTimes(1);
        rerender(section(inbox([3, 2, 1], true), 1));
        expect(scrollToIndex).toHaveBeenCalledTimes(2);
    });

    it("waits for a selected item that is not loaded yet", () => {
        const { rerender } = render(section(inbox([3]), 1), { wrapper });
        expect(scrollToIndex).not.toHaveBeenCalled();
        rerender(section(inbox([3, 2, 1]), 1));
        expect(scrollToIndex).toHaveBeenCalledTimes(1);
    });
});

describe("useScrollToTaskCommentByCommentId", () => {
    afterEach(() => vi.useRealTimers());

    it("scrolls to the linked comment once, not again when the comments change", () => {
        vi.useFakeTimers();
        const ref = { current: { scrollToIndex } as unknown as VirtuosoHandle };
        const comments = (...ids: number[]) =>
            ids.map((commentId) => ({ commentId })) as TaskCommentProps[];
        const { rerender } = renderHook(
            ({ list }) => useScrollToTaskCommentByCommentId(ref, list, 2),
            { initialProps: { list: comments(1, 2) } }
        );
        act(() => void vi.advanceTimersByTime(300));
        rerender({ list: comments(1, 2, 3) });
        act(() => void vi.advanceTimersByTime(300));
        expect(scrollToIndex).toHaveBeenCalledTimes(1);
    });
});

describe("useShowReorderedChat (the chat list)", () => {
    const chats = (...ids: string[]) =>
        ids.map((chatId) => ({ chatId, chatType: 1, isPinned: false })) as AllChatProps[];

    const setup = () => {
        const scrollTo = vi.fn();
        const ref = { current: { scrollTo } as unknown as VirtuosoHandle };
        const hook = renderHook(({ list }) => useShowReorderedChat(ref, list), {
            initialProps: { list: chats("a", "b", "c") },
        });
        return { ...hook, scrollTo };
    };
    const frame = () => new Promise((done) => requestAnimationFrame(done));

    it("shows the new first chat when the person is at the top", async () => {
        const { rerender, scrollTo } = setup();
        rerender({ list: chats("c", "a", "b") });
        await act(async () => void (await frame()));
        expect(scrollTo).toHaveBeenCalledTimes(1);
    });

    it("leaves a scrolled list alone, e.g. when the first chat turns read and drops out", async () => {
        const { result, rerender, scrollTo } = setup();
        act(() => result.current(false));
        rerender({ list: chats("b", "c") });
        await act(async () => void (await frame()));
        expect(scrollTo).not.toHaveBeenCalled();
    });

    it("does not move for a change that keeps the same first chat", async () => {
        const { rerender, scrollTo } = setup();
        rerender({ list: chats("a", "c", "b") });
        await act(async () => void (await frame()));
        expect(scrollTo).not.toHaveBeenCalled();
    });
});
