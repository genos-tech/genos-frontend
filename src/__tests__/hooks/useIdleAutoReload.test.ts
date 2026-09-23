import { act } from "react";
import { renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useIdleAutoReload } from "../../hooks/common/useIdleAutoReload";

// Guards the automatic page reload that closes the "laptop slept overnight,
// the app acts weird until I hit reload" class of bug. Everything here is
// about the two ways it must NOT fire: not on a page that's merely been
// left alone briefly, and never on top of work a reload would destroy
// (there is no `beforeunload` handler anywhere in this app, so a wrong
// reload is silent data loss).

const HEARTBEAT_MS = 60 * 1000;
const THRESHOLD_MS = 4 * HEARTBEAT_MS;

describe("useIdleAutoReload", () => {
    let reload: ReturnType<typeof vi.fn>;
    let visibility: DocumentVisibilityState;
    let online: boolean;

    beforeEach(() => {
        vi.useFakeTimers();
        reload = vi.fn();
        visibility = "visible";
        online = true;

        // jsdom's `location.reload` is non-configurable on the real object,
        // so swap in a plain stand-in for the whole `window.location`.
        Object.defineProperty(window, "location", {
            configurable: true,
            writable: true,
            value: { ...window.location, reload },
        });
        Object.defineProperty(document, "visibilityState", {
            configurable: true,
            get: () => visibility,
        });
        Object.defineProperty(navigator, "onLine", {
            configurable: true,
            get: () => online,
        });
        window.sessionStorage.clear();
    });

    afterEach(() => {
        vi.useRealTimers();
        window.sessionStorage.clear();
    });

    /** Advance wall-clock AND fire the heartbeats that fall inside it. */
    const advance = (ms: number) => {
        act(() => {
            vi.advanceTimersByTime(ms);
        });
    };

    const mount = (options: Parameters<typeof useIdleAutoReload>[0] = {}) =>
        renderHook(() => useIdleAutoReload({ idleThresholdMs: THRESHOLD_MS, ...options }));

    it("reloads once the idle threshold passes, after announcing itself", () => {
        const { result } = mount();

        advance(THRESHOLD_MS);
        // The snackbar window: announced, not yet reloaded. This is the
        // whole reason the page flashing doesn't read as a crash.
        expect(result.current).toBe(true);
        expect(reload).not.toHaveBeenCalled();

        advance(2000);
        expect(reload).toHaveBeenCalledTimes(1);
    });

    it("does not reload a page that is merely idle for a short while", () => {
        mount();
        advance(THRESHOLD_MS - HEARTBEAT_MS);
        expect(reload).not.toHaveBeenCalled();
    });

    it("keeps deferring while the threshold is refreshed by real interaction", () => {
        const { result } = mount();

        // Three rounds of "nearly idle, then a click" must never accumulate
        // into a reload — this is the parked-tab-with-a-user case.
        for (let i = 0; i < 3; i += 1) {
            advance(THRESHOLD_MS - HEARTBEAT_MS);
            act(() => {
                window.dispatchEvent(new Event("pointerdown"));
            });
        }
        expect(result.current).toBe(false);
        expect(reload).not.toHaveBeenCalled();
    });

    it("never reloads on top of work a reload would destroy", () => {
        // A streaming Genos answer: not resumable, so this veto is the
        // difference between a fix and a data-loss bug.
        let busy = true;
        const { result } = mount({ isBusy: () => busy });

        advance(THRESHOLD_MS * 2);
        expect(result.current).toBe(false);
        expect(reload).not.toHaveBeenCalled();

        // Deferred, not cancelled: the page is still stale, so finishing the
        // work must let the reload through on the next heartbeat.
        busy = false;
        advance(HEARTBEAT_MS);
        expect(result.current).toBe(true);
        advance(2000);
        expect(reload).toHaveBeenCalledTimes(1);
    });

    it("aborts a reload when work starts during the announcement window", () => {
        let busy = false;
        const { result } = mount({ isBusy: () => busy });

        advance(THRESHOLD_MS);
        expect(result.current).toBe(true);

        // User hits "Ask" in the 2s grace window.
        busy = true;
        advance(2000);
        expect(reload).not.toHaveBeenCalled();
        expect(result.current).toBe(false);
    });

    it("treats a throwing busy-check as busy rather than as idle", () => {
        const spy = vi.spyOn(console, "error").mockImplementation(() => {});
        mount({
            isBusy: () => {
                throw new Error("boom");
            },
        });

        advance(THRESHOLD_MS + 2000);
        expect(reload).not.toHaveBeenCalled();
        spy.mockRestore();
    });

    it("waits for the user to be looking before reloading", () => {
        visibility = "hidden";
        const { result } = mount();

        advance(THRESHOLD_MS * 2);
        expect(result.current).toBe(false);
        expect(reload).not.toHaveBeenCalled();

        visibility = "visible";
        act(() => {
            document.dispatchEvent(new Event("visibilitychange"));
        });
        expect(result.current).toBe(true);
        advance(2000);
        expect(reload).toHaveBeenCalledTimes(1);
    });

    it("does not reload while offline, and reloads once the network is back", () => {
        online = false;
        mount();

        advance(THRESHOLD_MS * 2);
        // Reloading with no network can land on the browser's error page and
        // take the running SPA with it.
        expect(reload).not.toHaveBeenCalled();

        online = true;
        act(() => {
            window.dispatchEvent(new Event("online"));
        });
        advance(2000);
        expect(reload).toHaveBeenCalledTimes(1);
    });

    it("latches a suspend gap so a click on resume cannot mask it", () => {
        const { result } = mount();

        // The macOS closed-lid case: no `visibilitychange` fires, the page
        // just stops running. The heartbeat lands hours late.
        advance(THRESHOLD_MS + HEARTBEAT_MS);
        expect(result.current).toBe(true);

        // Unlocking the machine delivers a click. If activity could clear
        // staleness, the frozen page would stay frozen-and-stale forever —
        // which is the exact bug being fixed.
        act(() => {
            window.dispatchEvent(new Event("pointerdown"));
        });
        advance(2000);
        expect(reload).toHaveBeenCalledTimes(1);
    });

    it("cannot reload twice inside one threshold window", () => {
        // The loop guard. A clock that jumps forward reads exactly like a
        // long suspend, so without a cooldown a misbehaving clock (or any
        // state that boots straight into "stale") would reload on a loop.
        const first = mount();
        advance(THRESHOLD_MS + 2000);
        expect(reload).toHaveBeenCalledTimes(1);
        first.unmount();

        // The reload "happened": remount with the stamp still in
        // sessionStorage, as a real reloaded page would.
        const second = mount();
        advance(THRESHOLD_MS + 2000);
        expect(reload).toHaveBeenCalledTimes(1);
        second.unmount();

        // Past the window, a genuinely stale page reloads again — the
        // cooldown defers, it doesn't disarm the feature permanently.
        window.sessionStorage.setItem(
            "genos-idle-auto-reload-at",
            String(Date.now() - THRESHOLD_MS - 1)
        );
        mount();
        advance(THRESHOLD_MS + 2000);
        expect(reload).toHaveBeenCalledTimes(2);
    });

    it("stays fully inert when disabled", () => {
        const { result } = mount({ enabled: false });
        advance(THRESHOLD_MS * 3);
        expect(result.current).toBe(false);
        expect(reload).not.toHaveBeenCalled();
    });

    it("drops its timers and listeners on unmount", () => {
        const { unmount } = mount();
        advance(THRESHOLD_MS - HEARTBEAT_MS);
        unmount();
        advance(THRESHOLD_MS * 2);
        expect(reload).not.toHaveBeenCalled();
    });
});
