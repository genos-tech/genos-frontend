/**
 * MIP-1044: To-Do is a stop in the Cmd+Tab-style service switcher, and the
 * switcher's tiles can be clicked.
 *
 * To-Do has no page of its own, so a stop on it opens the to-do MODAL over the
 * current page instead of navigating. While that modal is open To-Do is the
 * "current" service, so one more tap goes back to the page underneath (which
 * only closes the modal), like Cmd+Tab between the last two apps.
 */
import { createElement, ReactNode } from "react";
import { act, renderHook } from "@testing-library/react";
import { MemoryRouter, useLocation } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
    GlobalServiceShortcutOptions,
    TODO_SERVICE_ID,
    useGlobalServiceShortcut,
} from "../hooks/common/useGlobalServiceShortcut";

const switched = vi.hoisted(() => ({ calls: [] as string[] }));
vi.mock("../services/serviceSwitch/serviceSwitchStore", () => ({
    switchService: (navigate: (to: string) => void, path: string) => {
        switched.calls.push(path);
        navigate(path);
    },
}));
vi.mock("../utils/platform", () => ({ isMac: () => true }));

const key = (type: "keydown" | "keyup", init: KeyboardEventInit) =>
    act(() => {
        document.dispatchEvent(new KeyboardEvent(type, init));
    });
/** Hold Cmd and tap Ctrl `n` times (a keyup of Ctrl between taps, Cmd still held). */
const tapCtrl = (n = 1) => {
    for (let i = 0; i < n; i++) {
        key("keydown", { key: "Control", metaKey: true });
        key("keyup", { key: "Control", metaKey: true });
    }
};
const releaseCmd = () => key("keyup", { key: "Meta" });

const setup = (start: string, initial: GlobalServiceShortcutOptions = {}) => {
    let options = initial;
    const wrapper = ({ children }: { children: ReactNode }) =>
        createElement(MemoryRouter, { initialEntries: [start] }, children);
    const view = renderHook(
        () => ({ hook: useGlobalServiceShortcut(options), path: useLocation().pathname }),
        { wrapper }
    );
    return {
        ...view,
        set: (next: GlobalServiceShortcutOptions) => {
            options = next;
            view.rerender();
        },
    };
};

beforeEach(() => {
    switched.calls = [];
});
afterEach(() => {
    vi.clearAllMocks();
});

describe("To-Do in the cycle", () => {
    it("is one of the stops, after the five page services", () => {
        const { result } = setup("/workspace/tasks");
        expect(result.current.hook.mruOrder).toHaveLength(6);
        expect(result.current.hook.mruOrder).toContain(TODO_SERVICE_ID);
        // The page you are on is still first.
        expect(result.current.hook.mruOrder[0]).toBe(2);
    });

    it("releasing Cmd on To-Do opens the modal and does not navigate", () => {
        const onShowTodo = vi.fn();
        const onHideTodo = vi.fn();
        const { result } = setup("/workspace/tasks", { onShowTodo, onHideTodo });
        // [tasks, inbox, chats, notes, genos, todo]: five taps reach To-Do.
        tapCtrl(5);
        expect(result.current.hook.previewIndex).toBe(5);
        releaseCmd();
        expect(onShowTodo).toHaveBeenCalledTimes(1);
        expect(onHideTodo).not.toHaveBeenCalled();
        expect(switched.calls).toEqual([]);
        expect(result.current.path).toBe("/workspace/tasks");
        expect(result.current.hook.previewIndex).toBeNull();
    });

    it("a stop on a page service still navigates, and does not touch the modal", () => {
        const onShowTodo = vi.fn();
        const onHideTodo = vi.fn();
        const { result } = setup("/workspace/tasks", { onShowTodo, onHideTodo });
        tapCtrl(1);
        releaseCmd();
        expect(switched.calls).toEqual(["/workspace/inbox"]);
        expect(result.current.path).toBe("/workspace/inbox");
        expect(onShowTodo).not.toHaveBeenCalled();
        expect(onHideTodo).not.toHaveBeenCalled();
    });
});

describe("while the To-Do modal is open", () => {
    it("To-Do is the current service and the page underneath is the previous one", () => {
        const { result, set } = setup("/workspace/tasks");
        set({ isTodoOpen: true });
        expect(result.current.hook.mruOrder.slice(0, 2)).toEqual([TODO_SERVICE_ID, 2]);
    });

    it("one tap goes back to the page underneath: it closes the modal and does not navigate", () => {
        const onShowTodo = vi.fn();
        const onHideTodo = vi.fn();
        const { result, set } = setup("/workspace/tasks");
        set({ isTodoOpen: true, onShowTodo, onHideTodo });
        tapCtrl(1);
        releaseCmd();
        expect(onHideTodo).toHaveBeenCalledTimes(1);
        expect(onShowTodo).not.toHaveBeenCalled();
        expect(switched.calls).toEqual([]);
        expect(result.current.path).toBe("/workspace/tasks");
    });

    it("a stop on a different service closes the modal AND navigates there", () => {
        const onHideTodo = vi.fn();
        const { result, set } = setup("/workspace/tasks");
        set({ isTodoOpen: true, onHideTodo });
        // [todo, tasks, inbox, ...]: two taps land on Inbox.
        tapCtrl(2);
        releaseCmd();
        expect(onHideTodo).toHaveBeenCalledTimes(1);
        expect(result.current.path).toBe("/workspace/inbox");
    });

    it("a stop on To-Do again does not reopen what is already open", () => {
        const onShowTodo = vi.fn();
        const { set } = setup("/workspace/tasks");
        set({ isTodoOpen: true, onShowTodo });
        // Backward from To-Do (position 0) with Shift would wrap to the last
        // stop; a full lap of six forward taps comes back to To-Do.
        tapCtrl(6);
        releaseCmd();
        expect(onShowTodo).not.toHaveBeenCalled();
    });

    it("when the modal closes, the page's own service is current again", () => {
        const { result, set } = setup("/workspace/tasks");
        set({ isTodoOpen: true });
        set({ isTodoOpen: false });
        expect(result.current.hook.mruOrder[0]).toBe(2);
        expect(result.current.hook.mruOrder[1]).toBe(TODO_SERVICE_ID);
    });
});

describe("clicking a tile", () => {
    it("selecting a page service commits it once, and the later Cmd release does nothing", () => {
        const { result } = setup("/workspace/tasks");
        tapCtrl(1); // overlay up, Inbox highlighted
        expect(result.current.hook.previewIndex).toBe(1);
        // Click the tile at position 3 (notes).
        act(() => result.current.hook.select(3));
        expect(switched.calls).toEqual(["/workspace/notes"]);
        expect(result.current.hook.previewIndex).toBeNull();
        releaseCmd();
        expect(switched.calls).toEqual(["/workspace/notes"]);
    });

    it("a Cmd release in the very same instant as the click still switches only once", () => {
        const { result } = setup("/workspace/tasks");
        tapCtrl(1);
        // No render between the click and the release: the hook's own
        // bookkeeping, not a re-render, has to say "already committed".
        act(() => {
            result.current.hook.select(3);
            document.dispatchEvent(new KeyboardEvent("keyup", { key: "Meta" }));
        });
        expect(switched.calls).toEqual(["/workspace/notes"]);
    });

    it("selecting the To-Do tile opens the modal", () => {
        const onShowTodo = vi.fn();
        const { result } = setup("/workspace/tasks", { onShowTodo });
        tapCtrl(1);
        act(() => result.current.hook.select(5));
        expect(onShowTodo).toHaveBeenCalledTimes(1);
        expect(switched.calls).toEqual([]);
        releaseCmd();
        expect(onShowTodo).toHaveBeenCalledTimes(1);
    });

    it("selecting the page underneath while To-Do is open just closes the modal", () => {
        const onHideTodo = vi.fn();
        const { result, set } = setup("/workspace/tasks");
        set({ isTodoOpen: true, onHideTodo });
        tapCtrl(1);
        // Position 1 is the page underneath (tasks).
        act(() => result.current.hook.select(1));
        expect(onHideTodo).toHaveBeenCalledTimes(1);
        expect(switched.calls).toEqual([]);
    });

    it("hovering a tile moves the highlight, but only while the overlay is up", () => {
        const { result } = setup("/workspace/tasks");
        act(() => result.current.hook.highlight(3));
        expect(result.current.hook.previewIndex).toBeNull();
        tapCtrl(1);
        act(() => result.current.hook.highlight(3));
        expect(result.current.hook.previewIndex).toBe(3);
        // Releasing Cmd commits what the pointer last highlighted.
        releaseCmd();
        expect(switched.calls).toEqual(["/workspace/notes"]);
    });
});

describe("the letter shortcut is unchanged", () => {
    it("Ctrl+Cmd+X calls onOpenTodo and cancels a cycle in progress", () => {
        const onOpenTodo = vi.fn();
        const { result } = setup("/workspace/tasks", { onOpenTodo });
        tapCtrl(1);
        key("keydown", { key: "x", ctrlKey: true, metaKey: true });
        expect(onOpenTodo).toHaveBeenCalledTimes(1);
        expect(result.current.hook.previewIndex).toBeNull();
    });

    it("the earlier chords no longer open the to-do list (MIP-1355)", () => {
        // Ctrl+Cmd+O was the first default; Ctrl+Cmd+D was dropped because macOS answers it
        // with the dictionary pop-up even after the page cancels the key.
        const onOpenTodo = vi.fn();
        setup("/workspace/tasks", { onOpenTodo });
        for (const letter of ["o", "d"]) {
            key("keydown", { key: letter, ctrlKey: true, metaKey: true });
        }
        expect(onOpenTodo).not.toHaveBeenCalled();
    });
});
