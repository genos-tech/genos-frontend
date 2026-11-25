import { renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { useInsertSelectedEmoji } from "./useInsertSelectedEmoji";

describe("useInsertSelectedEmoji (effect timing)", () => {
    it("does nothing while no emoji is selected", () => {
        const insert = vi.fn();
        renderHook(() => useInsertSelectedEmoji(null, insert));
        expect(insert).not.toHaveBeenCalled();
    });

    it("inserts once when an emoji is selected", () => {
        const insert = vi.fn();
        renderHook(() => useInsertSelectedEmoji("😀", insert));
        expect(insert).toHaveBeenCalledTimes(1);
        expect(insert).toHaveBeenCalledWith("😀");
    });

    it("does not re-insert when only the callback identity changes", () => {
        const first = vi.fn();
        const second = vi.fn();
        const { rerender } = renderHook(({ cb }) => useInsertSelectedEmoji("😀", cb), {
            initialProps: { cb: first },
        });
        rerender({ cb: second });
        rerender({ cb: vi.fn() });
        expect(first).toHaveBeenCalledTimes(1);
        expect(second).not.toHaveBeenCalled();
    });

    it("calls the latest callback when the selection changes", () => {
        const first = vi.fn();
        const second = vi.fn();
        const { rerender } = renderHook(({ emoji, cb }) => useInsertSelectedEmoji(emoji, cb), {
            initialProps: { emoji: null as string | null, cb: first },
        });
        rerender({ emoji: null, cb: second });
        rerender({ emoji: "🎉", cb: second });
        expect(first).not.toHaveBeenCalled();
        expect(second).toHaveBeenCalledTimes(1);
        expect(second).toHaveBeenCalledWith("🎉");
    });
});
