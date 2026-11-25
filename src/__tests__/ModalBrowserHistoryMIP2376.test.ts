/**
 * MIP-2376: browser Back / Forward move between modal pages (the quick-look preview), and
 * closing a modal removes its history entries.
 */
import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useUrlLinkModalState } from "../hooks/common/useUrlLinkModalState";
import {
    closeModalPages,
    modalHistoryDepth,
    pushModalPage,
    resetModalHistoryForTests,
    subscribeModalHistory,
} from "../utils/modalHistory";

const TASK_A = "/workspace/tasks/project/7/task/42";
const TASK_B = "/workspace/tasks/project/7/task/43";

const goBack = async () => {
    await act(async () => {
        window.history.back();
        await new Promise((r) => setTimeout(r, 30));
    });
};
const goForward = async () => {
    await act(async () => {
        window.history.forward();
        await new Promise((r) => setTimeout(r, 30));
    });
};

beforeEach(() => {
    resetModalHistoryForTests();
    window.history.replaceState(null, "", "/workspace/tasks");
});
afterEach(() => resetModalHistoryForTests());

describe("modal pages in the preview", () => {
    const setup = () => {
        const navigate = vi.fn();
        return { navigate, ...renderHook(() => useUrlLinkModalState({ navigate })) };
    };

    it("Back steps to the previous page, then closes; Forward returns", async () => {
        const { result } = setup();
        const url = window.location.href;
        act(() => void result.current.openModalByHref(TASK_A));
        act(() => void result.current.openModalByHref(TASK_B));
        expect(result.current.target).toMatchObject({ kind: "task", taskId: 43 });
        // The address never changes.
        expect(window.location.href).toBe(url);

        await goBack();
        expect(result.current.target).toMatchObject({ kind: "task", taskId: 42 });
        await goBack();
        expect(result.current.target).toBeNull();

        await goForward();
        expect(result.current.target).toMatchObject({ kind: "task", taskId: 42 });
        await goForward();
        expect(result.current.target).toMatchObject({ kind: "task", taskId: 43 });
    });

    it("closing pops the entries, so Back does not reopen it", async () => {
        const { result } = setup();
        act(() => void result.current.openModalByHref(TASK_A));
        act(() => void result.current.openModalByHref(TASK_B));
        expect(modalHistoryDepth()).toBe(2);
        await act(async () => {
            result.current.closeModal();
            await new Promise((r) => setTimeout(r, 30));
        });
        expect(result.current.target).toBeNull();
        expect(modalHistoryDepth()).toBe(0);
        await goForward();
        expect(result.current.target).toBeNull();
    });

    it("the link to the page already open adds no entry", () => {
        const { result } = setup();
        act(() => void result.current.openModalByHref(TASK_A));
        act(() => void result.current.openModalByHref(TASK_A));
        expect(modalHistoryDepth()).toBe(1);
    });

    it("Move to page runs after the modal's entries are gone", async () => {
        const { result } = setup();
        const onOpenFullPage = vi.fn();
        act(() => void result.current.openModalByHref(TASK_A, { onOpenFullPage }));
        act(() => void result.current.openModalByHref(TASK_B, { onOpenFullPage }));
        act(() => result.current.openFullPage?.());
        expect(result.current.target).toBeNull();
        await waitFor(() => expect(onOpenFullPage).toHaveBeenCalledTimes(1));
        expect(modalHistoryDepth()).toBe(0);
    });
});

describe("modalHistory owners", () => {
    it("tells each owner what is on top for it", async () => {
        const a = vi.fn();
        const b = vi.fn();
        subscribeModalHistory("a", a);
        subscribeModalHistory("b", b);
        pushModalPage("a", "a1");
        pushModalPage("b", "b1");
        await goBack();
        expect(a).toHaveBeenLastCalledWith("a1");
        expect(b).toHaveBeenLastCalledWith(null);
        await goBack();
        expect(a).toHaveBeenLastCalledWith(null);
    });

    it("a marker left from before a reload opens nothing", async () => {
        window.history.replaceState({ genosModalDepth: 3 }, "");
        const a = vi.fn();
        subscribeModalHistory("a", a);
        expect(window.history.state).toMatchObject({ genosModalDepth: 0 });
        expect(modalHistoryDepth()).toBe(0);
    });

    it("closing with no entries calls back at once", () => {
        const then = vi.fn();
        closeModalPages("none", then);
        expect(then).toHaveBeenCalledTimes(1);
    });

    it("keeps the router's own history state", () => {
        window.history.replaceState({ idx: 4, key: "k", usr: null }, "");
        pushModalPage("a", 1);
        expect(window.history.state).toMatchObject({ idx: 4, key: "k", genosModalDepth: 1 });
    });
});
