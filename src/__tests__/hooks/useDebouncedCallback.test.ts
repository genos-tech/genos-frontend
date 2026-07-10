import { act } from "react";
import { renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useDebouncedCallback } from "../../hooks/common/useDebouncedCallback";

// Backs the collaborative editors' body→parent sync (see sub/bodySync.ts):
// per-keystroke `run()` calls must coalesce into one trailing execution,
// `flush()` must fire pending work synchronously on blur, and unmount must
// drop (not fire) pending work.

describe("useDebouncedCallback", () => {
    beforeEach(() => {
        vi.useFakeTimers();
    });
    afterEach(() => {
        vi.useRealTimers();
    });

    it("coalesces rapid run() calls into one trailing execution", () => {
        const fn = vi.fn();
        const { result } = renderHook(() => useDebouncedCallback(fn, 250));

        act(() => {
            result.current.run();
            vi.advanceTimersByTime(100);
            result.current.run();
            vi.advanceTimersByTime(100);
            result.current.run();
        });
        expect(fn).not.toHaveBeenCalled();

        act(() => {
            vi.advanceTimersByTime(250);
        });
        expect(fn).toHaveBeenCalledTimes(1);
        // Timer-path invocations announce themselves as non-flush so the
        // editors can commit through startTransition.
        expect(fn).toHaveBeenLastCalledWith(false);
    });

    it("flush() executes pending work immediately and only once", () => {
        const fn = vi.fn();
        const { result } = renderHook(() => useDebouncedCallback(fn, 250));

        act(() => {
            result.current.run();
            result.current.flush();
        });
        expect(fn).toHaveBeenCalledTimes(1);
        // Flush-path invocations announce themselves so the editors commit
        // synchronously (blur→submit flows read the state right after).
        expect(fn).toHaveBeenLastCalledWith(true);

        // The flushed timer must not fire again later.
        act(() => {
            vi.advanceTimersByTime(500);
        });
        expect(fn).toHaveBeenCalledTimes(1);
    });

    it("flush() is a no-op when nothing is pending", () => {
        const fn = vi.fn();
        const { result } = renderHook(() => useDebouncedCallback(fn, 250));

        act(() => {
            result.current.flush();
        });
        expect(fn).not.toHaveBeenCalled();
    });

    it("cancel() drops pending work without executing", () => {
        const fn = vi.fn();
        const { result } = renderHook(() => useDebouncedCallback(fn, 250));

        act(() => {
            result.current.run();
            result.current.cancel();
            vi.advanceTimersByTime(500);
        });
        expect(fn).not.toHaveBeenCalled();
    });

    it("drops pending work on unmount", () => {
        const fn = vi.fn();
        const { result, unmount } = renderHook(() => useDebouncedCallback(fn, 250));

        act(() => {
            result.current.run();
        });
        unmount();
        act(() => {
            vi.advanceTimersByTime(500);
        });
        expect(fn).not.toHaveBeenCalled();
    });

    it("always invokes the latest callback closure", () => {
        const first = vi.fn();
        const second = vi.fn();
        const { result, rerender } = renderHook(({ cb }) => useDebouncedCallback(cb, 250), {
            initialProps: { cb: first },
        });

        act(() => {
            result.current.run();
        });
        rerender({ cb: second });
        act(() => {
            vi.advanceTimersByTime(250);
        });

        expect(first).not.toHaveBeenCalled();
        expect(second).toHaveBeenCalledTimes(1);
    });
});
