/**
 * Pause-hook reactivity tests.
 *
 * The load-bearing behaviour: a pause must self-clear WITHOUT a refresh when
 * its one-shot expiry lapses (the avatar badge and toast gate both read
 * `isPausedNow`, and the manager only re-evaluates lazily at `notify()`). The
 * hook arms a `setTimeout` to the exact boundary; these advance fake timers to
 * prove it fires. Also checks the localStorage mirror the heartbeat reads.
 */

import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useNotificationPause } from "../hooks/common/useNotificationPause";
import { NotificationManager } from "../services/notifications/notificationManager";
import { SNOOZE_UNTIL_KEY } from "../services/notifications/snoozeMirror";
import { UserProps } from "../types/admin";

// A self user pinned to UTC so the schedule branch is deterministic under any
// CI timezone (resolveDisplayZone reads `timezone` when no currentLocation).
const myself = { userId: "me", userName: "Me", timezone: "UTC" } as unknown as UserProps;

describe("useNotificationPause", () => {
    beforeEach(() => {
        vi.useFakeTimers();
        vi.setSystemTime(Date.parse("2026-08-10T12:00:00Z"));
        localStorage.clear();
    });

    afterEach(() => {
        vi.useRealTimers();
        localStorage.clear();
    });

    it("starts not paused with a fresh manager", () => {
        const mgr = new NotificationManager({ currentUserId: "me" });
        const { result } = renderHook(() => useNotificationPause(mgr, myself));
        expect(result.current.isPausedNow).toBe(false);
        expect(result.current.snoozeUntil).toBeNull();
    });

    it("pauseFor flips isPausedNow true and mirrors snoozeUntil to localStorage", () => {
        const mgr = new NotificationManager({ currentUserId: "me" });
        const { result } = renderHook(() => useNotificationPause(mgr, myself));

        act(() => result.current.pauseFor(30 * 60_000));

        expect(result.current.isPausedNow).toBe(true);
        expect(result.current.snoozeUntil).not.toBeNull();
        expect(localStorage.getItem(SNOOZE_UNTIL_KEY)).toBe(result.current.snoozeUntil);
    });

    it("resume clears the pause and the localStorage mirror", () => {
        const mgr = new NotificationManager({ currentUserId: "me" });
        const { result } = renderHook(() => useNotificationPause(mgr, myself));

        act(() => result.current.pauseFor(60 * 60_000));
        expect(result.current.isPausedNow).toBe(true);

        act(() => result.current.resume());
        expect(result.current.isPausedNow).toBe(false);
        expect(result.current.snoozeUntil).toBeNull();
        expect(localStorage.getItem(SNOOZE_UNTIL_KEY)).toBeNull();
    });

    it("self-clears isPausedNow when the one-shot expiry lapses (no refresh)", () => {
        const mgr = new NotificationManager({ currentUserId: "me" });
        const { result } = renderHook(() => useNotificationPause(mgr, myself));

        act(() => result.current.pauseFor(60_000)); // 1 minute
        expect(result.current.isPausedNow).toBe(true);

        // Advance past the boundary (+ the hook's buffer) — the armed timeout
        // must recompute and clear the pause on its own.
        act(() => {
            vi.advanceTimersByTime(60_000 + 500);
        });
        expect(result.current.isPausedNow).toBe(false);
    });

    it("setSchedule with an active window pauses; clearing it resumes", () => {
        const mgr = new NotificationManager({ currentUserId: "me" });
        const { result } = renderHook(() => useNotificationPause(mgr, myself));

        // 00:00–23:59 UTC is active at the pinned noon.
        act(() => result.current.setSchedule({ enabled: true, start: "00:00", end: "23:59" }));
        expect(result.current.isPausedNow).toBe(true);

        act(() => result.current.setSchedule(null));
        expect(result.current.isPausedNow).toBe(false);
    });

    it("a disabled schedule does not pause", () => {
        const mgr = new NotificationManager({ currentUserId: "me" });
        const { result } = renderHook(() => useNotificationPause(mgr, myself));

        act(() => result.current.setSchedule({ enabled: false, start: "00:00", end: "23:59" }));
        expect(result.current.isPausedNow).toBe(false);
    });
});
