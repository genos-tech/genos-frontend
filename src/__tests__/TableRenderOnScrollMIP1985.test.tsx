import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import {
    KEY_LOOKAHEAD_ROWS,
    keyGrowth,
    RENDER_ALL_UP_TO,
    RENDER_STEP,
    useRenderOnScroll,
} from "../features/tasks/utils/renderOnScroll";

// MIP-1985: the task table with the status filter on All drew ~590 rows. A long table draws
// the first chunk and adds one as it is scrolled or keyed to its end. The wiring is in
// DraggableTaskTable (a listener on the treegrid); the decisions are pure and pinned here, and
// the real scroll and keys were walked in Chrome (see the PR).

describe("keyGrowth: the key a grid with chunked rows must answer before the grid moves", () => {
    const drawn = 40;
    it("draws everything for Ctrl/Cmd+End and Ctrl/Cmd+Down", () => {
        expect(keyGrowth("End", true, 0, drawn)).toBe("all");
        expect(keyGrowth("ArrowDown", true, 0, drawn)).toBe("all");
    });

    it("draws a chunk when a downward key is within the lookahead of the last drawn row", () => {
        expect(keyGrowth("ArrowDown", false, drawn - 1, drawn)).toBe("chunk");
        expect(keyGrowth("PageDown", false, drawn - KEY_LOOKAHEAD_ROWS, drawn)).toBe("chunk");
    });

    it("does nothing far from the end, for other keys, or outside a row", () => {
        expect(keyGrowth("ArrowDown", false, 0, drawn)).toBeNull();
        expect(keyGrowth("ArrowUp", false, drawn - 1, drawn)).toBeNull();
        expect(keyGrowth("End", false, drawn - 1, drawn)).toBeNull();
        expect(keyGrowth("ArrowDown", false, -1, drawn)).toBeNull();
    });
});

describe("useRenderOnScroll", () => {
    it("draws everything of a short list and a first chunk of a long one", () => {
        expect(renderHook(() => useRenderOnScroll(RENDER_ALL_UP_TO)).result.current.limit).toBe(
            RENDER_ALL_UP_TO
        );
        expect(renderHook(() => useRenderOnScroll(600)).result.current.limit).toBe(RENDER_STEP);
    });

    it("ensure() draws the row that must be visible, and never shrinks", () => {
        const { result } = renderHook(() => useRenderOnScroll(600));
        act(() => result.current.ensure(300));
        expect(result.current.limit).toBeGreaterThan(300);
        const before = result.current.limit;
        act(() => result.current.ensure(5));
        expect(result.current.limit).toBe(before);
    });

    it("grow('all') draws the whole list", () => {
        const { result } = renderHook(() => useRenderOnScroll(600));
        act(() => result.current.grow("all"));
        expect(result.current.limit).toBe(600);
    });
});
