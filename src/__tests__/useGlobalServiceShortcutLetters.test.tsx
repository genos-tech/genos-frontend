/**
 * The seven letter shortcuts of `useGlobalServiceShortcut`, now read from the
 * registry (MIP-1275): each key runs its own callback, preventDefaults, cancels a
 * cycle preview in progress, and a letter whose callback was not passed does
 * nothing (it used to fall through to the cycle test, and still does).
 */
import { createElement, ReactNode } from "react";
import { act, renderHook } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
    GlobalServiceShortcutOptions,
    useGlobalServiceShortcut,
} from "../hooks/common/useGlobalServiceShortcut";

let mac = true;
vi.mock("../services/serviceSwitch/serviceSwitchStore", () => ({ switchService: vi.fn() }));
vi.mock("../utils/platform", () => ({ isMac: () => mac }));

const press = (init: KeyboardEventInit) => {
    const e = new KeyboardEvent("keydown", { bubbles: true, cancelable: true, ...init });
    act(() => {
        document.dispatchEvent(e);
    });
    return e;
};

const setup = (options: GlobalServiceShortcutOptions) => {
    const wrapper = ({ children }: { children: ReactNode }) =>
        createElement(MemoryRouter, { initialEntries: ["/workspace/tasks"] }, children);
    return renderHook(() => useGlobalServiceShortcut(options), { wrapper });
};

const CASES: Array<[string, keyof GlobalServiceShortcutOptions]> = [
    ["t", "onOpenTasksAndCreate"],
    ["n", "onOpenNotesAndCreate"],
    ["c", "onOpenCalendarModal"],
    ["m", "onQuickMeetClipboard"],
    ["h", "onOpenHistory"],
    ["g", "onOpenTaskDiagram"],
    ["x", "onOpenTodo"],
];

beforeEach(() => {
    mac = true;
});

describe("letter shortcuts", () => {
    it.each(CASES)("Ctrl+Cmd+%s runs %s and nothing else (Mac)", (letter, option) => {
        const fns = Object.fromEntries(CASES.map(([, o]) => [o, vi.fn()])) as Record<
            string,
            ReturnType<typeof vi.fn>
        >;
        setup(fns as unknown as GlobalServiceShortcutOptions);
        const e = press({ key: letter, ctrlKey: true, metaKey: true });
        expect(e.defaultPrevented).toBe(true);
        for (const [, o] of CASES) expect(fns[o]).toHaveBeenCalledTimes(o === option ? 1 : 0);
    });

    it.each(CASES)(
        "Ctrl+Alt+%s runs %s (Windows / Linux) and the Mac chord does not",
        (letter, option) => {
            mac = false;
            const fn = vi.fn();
            setup({ [option]: fn });
            press({ key: letter, ctrlKey: true, metaKey: true });
            expect(fn).not.toHaveBeenCalled();
            press({ key: letter.toUpperCase(), ctrlKey: true, altKey: true });
            expect(fn).toHaveBeenCalledTimes(1);
        }
    );

    it("needs both modifiers, and refuses the other platform's third one", () => {
        const onOpenHistory = vi.fn();
        setup({ onOpenHistory });
        press({ key: "h", ctrlKey: true });
        press({ key: "h", metaKey: true });
        press({ key: "h", ctrlKey: true, metaKey: true, altKey: true });
        expect(onOpenHistory).not.toHaveBeenCalled();
        // Shift is ignored, so a backward cycle still surrenders to a letter.
        press({ key: "h", ctrlKey: true, metaKey: true, shiftKey: true });
        expect(onOpenHistory).toHaveBeenCalledTimes(1);
    });

    it("a letter with no callback passed does nothing and is not swallowed", () => {
        setup({});
        const e = press({ key: "t", ctrlKey: true, metaKey: true });
        expect(e.defaultPrevented).toBe(false);
    });

    it("cancels a cycle preview in progress", () => {
        const onOpenCalendarModal = vi.fn();
        const { result } = setup({ onOpenCalendarModal });
        press({ key: "Control", metaKey: true });
        expect(result.current.previewIndex).toBe(1);
        press({ key: "c", ctrlKey: true, metaKey: true });
        expect(onOpenCalendarModal).toHaveBeenCalledTimes(1);
        expect(result.current.previewIndex).toBeNull();
    });
});
