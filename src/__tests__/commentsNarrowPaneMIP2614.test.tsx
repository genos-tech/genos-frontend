/**
 * MIP-2614: at 1024px with the task preview open the note pane was narrower than the 340px
 * comments column plus a readable editor, and the note wrapped one letter per line. The panel is
 * laid over the note when the PANE (not the window) is that narrow. jsdom has no layout, so the
 * pane's width is given here; where things sit is the browser check's job (see the PR).
 */
import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { useIsNarrowerThan } from "../hooks/common/useIsNarrowerThan";

let resize: () => void = () => {};
const disconnect = vi.fn();

const pane = (initial: number) => {
    let width = initial;
    const element = document.createElement("div");
    element.getBoundingClientRect = () => ({ width }) as DOMRect;
    vi.stubGlobal(
        "ResizeObserver",
        class {
            constructor(callback: () => void) {
                resize = callback;
            }
            observe() {}
            disconnect = disconnect;
        }
    );
    return {
        ref: { current: element },
        to: (next: number) => {
            width = next;
            act(() => resize());
        },
    };
};

afterEach(() => vi.unstubAllGlobals());

describe("useIsNarrowerThan", () => {
    it("answers from the pane's width and follows it as the pane is resized", () => {
        const { ref, to } = pane(500);
        const { result } = renderHook(() => useIsNarrowerThan(ref, 640));
        expect(result.current).toBe(true);
        to(640);
        expect(result.current).toBe(false);
        to(639);
        expect(result.current).toBe(true);
    });

    it("keeps its last answer while the pane is hidden", () => {
        const { ref, to } = pane(500);
        const { result } = renderHook(() => useIsNarrowerThan(ref, 640));
        to(0);
        expect(result.current).toBe(true);
    });

    it("is false with no layout to measure, and stops observing when it goes", () => {
        const { ref } = pane(0);
        const { result, unmount } = renderHook(() => useIsNarrowerThan(ref, 640));
        expect(result.current).toBe(false);
        unmount();
        expect(disconnect).toHaveBeenCalled();
    });
});
