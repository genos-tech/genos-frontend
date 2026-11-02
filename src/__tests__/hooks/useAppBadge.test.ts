import { act } from "react";
import { renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useAppBadge } from "../../hooks/common/useAppBadge";

// The app-icon badge (the counter chip on the installed app) has two writers:
// this hook while the app is on screen, and the service worker while it is
// not (`ServiceWorkerCaching.test.ts` pins that half). The reported failure
// lived in the seam between them: with the app closed a push put the SERVER's
// number on the icon, the user came back, and because the page's own count had
// not changed the hook wrote nothing, so the wrong number stayed until
// something unrelated moved the count.
//
// Every case asserts the actual `setAppBadge` / `clearAppBadge` calls and
// their arguments. "No error was thrown" would pass against a hook that did
// nothing at all.

describe("useAppBadge", () => {
    let visibility: DocumentVisibilityState;
    let setAppBadge: ReturnType<typeof vi.fn>;
    let clearAppBadge: ReturnType<typeof vi.fn>;

    const defineBadgeApi = () => {
        Object.defineProperty(navigator, "setAppBadge", {
            configurable: true,
            writable: true,
            value: setAppBadge,
        });
        Object.defineProperty(navigator, "clearAppBadge", {
            configurable: true,
            writable: true,
            value: clearAppBadge,
        });
    };

    beforeEach(() => {
        visibility = "visible";
        setAppBadge = vi.fn(async () => undefined);
        clearAppBadge = vi.fn(async () => undefined);
        defineBadgeApi();
        Object.defineProperty(document, "visibilityState", {
            configurable: true,
            get: () => visibility,
        });
    });

    afterEach(() => {
        // Own properties shadow the (absent) prototype ones, so deleting
        // restores the "unsupported browser" baseline for the next case.
        delete (navigator as unknown as Record<string, unknown>).setAppBadge;
        delete (navigator as unknown as Record<string, unknown>).clearAppBadge;
        delete (document as unknown as Record<string, unknown>).visibilityState;
    });

    /** The page coming back to the front: the visibility flips, then the event. */
    const show = () => {
        visibility = "visible";
        act(() => {
            document.dispatchEvent(new Event("visibilitychange"));
        });
    };
    const hide = () => {
        visibility = "hidden";
        act(() => {
            document.dispatchEvent(new Event("visibilitychange"));
        });
    };

    it("puts the count on the icon when it mounts", () => {
        renderHook(() => useAppBadge(5));

        expect(setAppBadge).toHaveBeenCalledTimes(1);
        expect(setAppBadge).toHaveBeenCalledWith(5);
        expect(clearAppBadge).not.toHaveBeenCalled();
    });

    it("clears the icon, rather than writing 0, when there is nothing unread", () => {
        renderHook(() => useAppBadge(0));

        expect(clearAppBadge).toHaveBeenCalledTimes(1);
        expect(setAppBadge).not.toHaveBeenCalled();
    });

    it("falls back to setAppBadge(0) where clearAppBadge is missing", () => {
        Object.defineProperty(navigator, "clearAppBadge", {
            configurable: true,
            writable: true,
            value: undefined,
        });
        renderHook(() => useAppBadge(0));

        expect(setAppBadge).toHaveBeenCalledTimes(1);
        expect(setAppBadge).toHaveBeenCalledWith(0);
    });

    it("writes again when the count changes", () => {
        const { rerender } = renderHook(({ count }) => useAppBadge(count), {
            initialProps: { count: 2 },
        });
        rerender({ count: 3 });
        rerender({ count: 0 });

        expect(setAppBadge.mock.calls).toEqual([[2], [3]]);
        expect(clearAppBadge).toHaveBeenCalledTimes(1);
    });

    it("does not call the Badging API again for a re-render with the same count", () => {
        const { rerender } = renderHook(({ count }) => useAppBadge(count), {
            initialProps: { count: 4 },
        });
        rerender({ count: 4 });
        rerender({ count: 4 });

        expect(setAppBadge).toHaveBeenCalledTimes(1);
        expect(clearAppBadge).not.toHaveBeenCalled();
    });

    describe("coming back to the app", () => {
        // The bug. The count is the same before and after the app was
        // backgrounded, so the change-only effect never fires, and whatever
        // the service worker put on the icon in between (the server's number)
        // is left standing.
        it("writes the count again when the page becomes visible, though it did not change", () => {
            renderHook(() => useAppBadge(4));
            expect(setAppBadge).toHaveBeenCalledTimes(1);

            // The worker overwrote the icon while the app was away.
            setAppBadge.mockClear();
            hide();
            show();

            expect(setAppBadge).toHaveBeenCalledTimes(1);
            expect(setAppBadge).toHaveBeenCalledWith(4);
        });

        it("re-applies a zero too, by clearing", () => {
            renderHook(() => useAppBadge(0));
            clearAppBadge.mockClear();

            hide();
            show();

            expect(clearAppBadge).toHaveBeenCalledTimes(1);
            expect(setAppBadge).not.toHaveBeenCalled();
        });

        it("writes the LATEST count, not the one from when the listener was bound", () => {
            const { rerender } = renderHook(({ count }) => useAppBadge(count), {
                initialProps: { count: 1 },
            });
            rerender({ count: 9 });
            setAppBadge.mockClear();

            hide();
            show();

            expect(setAppBadge.mock.calls).toEqual([[9]]);
        });

        it("does nothing when the page is hidden", () => {
            renderHook(() => useAppBadge(4));
            setAppBadge.mockClear();

            hide();

            expect(setAppBadge).not.toHaveBeenCalled();
            expect(clearAppBadge).not.toHaveBeenCalled();
        });

        it("re-applies on pageshow, which is how a page restored from bfcache returns", () => {
            renderHook(() => useAppBadge(6));
            setAppBadge.mockClear();

            act(() => {
                window.dispatchEvent(new Event("pageshow"));
            });

            expect(setAppBadge.mock.calls).toEqual([[6]]);
        });

        it("re-applies when the window regains focus", () => {
            renderHook(() => useAppBadge(6));
            setAppBadge.mockClear();

            act(() => {
                window.dispatchEvent(new Event("focus"));
            });

            expect(setAppBadge.mock.calls).toEqual([[6]]);
        });

        it("does not re-apply on a focus or pageshow that arrives while hidden", () => {
            renderHook(() => useAppBadge(6));
            setAppBadge.mockClear();
            visibility = "hidden";

            act(() => {
                window.dispatchEvent(new Event("focus"));
                window.dispatchEvent(new Event("pageshow"));
            });

            expect(setAppBadge).not.toHaveBeenCalled();
        });

        it("stops listening once unmounted", () => {
            const { unmount } = renderHook(() => useAppBadge(4));
            unmount();
            setAppBadge.mockClear();

            show();
            act(() => {
                window.dispatchEvent(new Event("focus"));
                window.dispatchEvent(new Event("pageshow"));
            });

            expect(setAppBadge).not.toHaveBeenCalled();
            expect(clearAppBadge).not.toHaveBeenCalled();
        });
    });

    describe("where the Badging API is unavailable", () => {
        beforeEach(() => {
            delete (navigator as unknown as Record<string, unknown>).setAppBadge;
            delete (navigator as unknown as Record<string, unknown>).clearAppBadge;
        });

        it("is a quiet no-op, including when the page returns", () => {
            expect(() => {
                renderHook(() => useAppBadge(3));
                show();
                act(() => {
                    window.dispatchEvent(new Event("focus"));
                });
            }).not.toThrow();
            expect("setAppBadge" in navigator).toBe(false);
        });
    });

    describe("when the platform rejects the call", () => {
        // A rejected promise here is never actionable (permission revoked
        // mid-session, unsupported surface). It must not become an unhandled
        // rejection, which vitest reports as a failure of the whole run.
        it("swallows the rejection, on mount and on return", async () => {
            setAppBadge.mockRejectedValue(new Error("not allowed"));
            clearAppBadge.mockRejectedValue(new Error("not allowed"));

            renderHook(() => useAppBadge(2));
            renderHook(() => useAppBadge(0));
            show();
            await Promise.resolve();
            await Promise.resolve();

            expect(setAppBadge).toHaveBeenCalledWith(2);
            expect(clearAppBadge).toHaveBeenCalled();
        });
    });
});
