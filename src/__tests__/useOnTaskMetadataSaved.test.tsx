import { renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useOnTaskMetadataSaved } from "../features/tasks/hooks/useOnTaskMetadataSaved";
import { emitTaskMetadataSaved } from "../features/tasks/services/taskEvents";

describe("useOnTaskMetadataSaved", () => {
    beforeEach(() => {
        vi.useFakeTimers();
    });
    afterEach(() => {
        vi.useRealTimers();
    });

    it("runs after a save, once the debounce has passed", () => {
        const callback = vi.fn();
        renderHook(() => useOnTaskMetadataSaved(callback, 500));
        emitTaskMetadataSaved();
        expect(callback).not.toHaveBeenCalled();
        vi.advanceTimersByTime(500);
        expect(callback).toHaveBeenCalledTimes(1);
    });

    it("runs once for a burst of saves", () => {
        const callback = vi.fn();
        renderHook(() => useOnTaskMetadataSaved(callback, 500));
        emitTaskMetadataSaved();
        vi.advanceTimersByTime(300);
        emitTaskMetadataSaved();
        vi.advanceTimersByTime(300);
        emitTaskMetadataSaved();
        vi.advanceTimersByTime(500);
        expect(callback).toHaveBeenCalledTimes(1);
    });

    it("calls the latest callback, not the one from the first render", () => {
        const first = vi.fn();
        const second = vi.fn();
        const { rerender } = renderHook(({ cb }) => useOnTaskMetadataSaved(cb, 500), {
            initialProps: { cb: first },
        });
        rerender({ cb: second });
        emitTaskMetadataSaved();
        vi.advanceTimersByTime(500);
        expect(first).not.toHaveBeenCalled();
        expect(second).toHaveBeenCalledTimes(1);
    });

    it("stops listening and drops a pending run on unmount", () => {
        const callback = vi.fn();
        const { unmount } = renderHook(() => useOnTaskMetadataSaved(callback, 500));
        emitTaskMetadataSaved();
        unmount();
        emitTaskMetadataSaved();
        vi.advanceTimersByTime(1000);
        expect(callback).not.toHaveBeenCalled();
    });
});
