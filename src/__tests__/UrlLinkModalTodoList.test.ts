/**
 * MIP-1044: the to-do modal can be opened for the WHOLE list (no day, no
 * item), by the shortcut, the sidebar button and the switcher.
 */
import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { useUrlLinkModalState } from "../hooks/common/useUrlLinkModalState";

const setup = () => {
    const navigate = vi.fn();
    const view = renderHook(() => useUrlLinkModalState({ navigate }));
    return { navigate, ...view };
};

describe("openTodoList", () => {
    it("opens a to-do target with no day, and does not navigate", () => {
        const { result, navigate } = setup();
        act(() => result.current.openTodoList());
        expect(result.current.target).toEqual({ kind: "todo" });
        expect(navigate).not.toHaveBeenCalled();
    });

    it("carries the caller's 'open full page' action: it closes the modal first, then runs", () => {
        const { result } = setup();
        const onOpenFullPage = vi.fn();
        act(() => result.current.openTodoList({ onOpenFullPage }));
        expect(result.current.openFullPage).not.toBeNull();
        act(() => result.current.openFullPage?.());
        expect(onOpenFullPage).toHaveBeenCalledTimes(1);
        expect(result.current.target).toBeNull();
    });

    it("has no full-page action when none is given", () => {
        const { result } = setup();
        act(() => result.current.openTodoList());
        expect(result.current.openFullPage).toBeNull();
    });

    it("closeModal closes it", () => {
        const { result } = setup();
        act(() => result.current.openTodoList());
        act(() => result.current.closeModal());
        expect(result.current.target).toBeNull();
    });

    it("replaces another preview that was open, and its full-page action with it", () => {
        const { result } = setup();
        const stale = vi.fn();
        act(() => {
            result.current.openModalByHref("/workspace/tasks/project/7/task/42", {
                onOpenFullPage: stale,
            });
        });
        act(() => result.current.openTodoList());
        expect(result.current.target?.kind).toBe("todo");
        expect(result.current.openFullPage).toBeNull();
    });

    it("a to-do LINK still opens its own day (unchanged)", () => {
        const { result } = setup();
        act(() => {
            result.current.openModalByHref("/workspace/todo/2026-11-05/item/9");
        });
        expect(result.current.target).toEqual({
            itemId: 9,
            kind: "todo",
            localDate: "2026-11-05",
        });
    });
});
