/**
 * Self-echo reconcile tests.
 *
 * The load-bearing behaviour: when the user changes their appear-offline /
 * custom-status / notification-pause on ANOTHER device, that device's heartbeat
 * echoes back as a `userStatus` naming this user. The hook must, on a genuine
 * divergence, re-fetch the AUTHORITATIVE server value (never adopt the echoed
 * string) and update this session. A matching echo must be a no-op, and a
 * self-echo for a DIFFERENT userId must be ignored.
 */

import { renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { getMyProfile } from "../../features/admin/services/getMyProfile";
import { dispatchSelfEcho } from "../../hooks/common/selfEchoEvent";
import { useSelfEchoReconcile } from "../../hooks/common/useSelfEchoReconcile";
import { getNotificationPreferences } from "../../services/notifications/notificationApi";
import { NotificationManager } from "../../services/notifications/notificationManager";
import { DEFAULT_NOTIFICATION_PREFERENCE } from "../../services/notifications/types";
import type { UserProps } from "../../types/admin";

vi.mock("../../features/admin/services/getMyProfile", () => ({
    getMyProfile: vi.fn(),
}));
vi.mock("../../services/notifications/notificationApi", () => ({
    getNotificationPreferences: vi.fn(),
}));

const mockedGetMyProfile = vi.mocked(getMyProfile);
const mockedGetPrefs = vi.mocked(getNotificationPreferences);

const mkUser = (over: Partial<UserProps> = {}): UserProps => ({
    userId: "u-me",
    userName: "Me",
    userEmail: "me@example.test",
    teamId: "t1",
    teamName: "Team",
    avatarImgPath: "",
    tsLastSeen: "",
    tsJoined: "",
    ...over,
});

// Flush the microtasks the debounced async fetch chains through, interleaved
// with fake-timer advancement (the fetch resolves, THEN the setState runs).
const flush = async () => {
    await Promise.resolve();
    await Promise.resolve();
};

describe("useSelfEchoReconcile", () => {
    beforeEach(() => {
        vi.useFakeTimers();
        localStorage.clear();
        mockedGetMyProfile.mockReset();
        mockedGetPrefs.mockReset();
    });
    afterEach(() => vi.useRealTimers());

    it("re-fetches profile and adopts it when the echoed presence diverges", async () => {
        const setMyself = vi.fn();
        const mgr = new NotificationManager({ currentUserId: "u-me" });
        const myself = mkUser({ isOfflineForced: "false", customStatus: "" });
        mockedGetMyProfile.mockResolvedValue({ isOfflineForced: true, customStatus: "🏝 OOO" });

        renderHook(() => useSelfEchoReconcile(myself, setMyself, "tok", mgr));

        // Another device turned on appear-offline + set a status.
        dispatchSelfEcho({ userId: "u-me", isOfflineForced: "true", customStatus: "🏝 OOO" });
        await vi.advanceTimersByTimeAsync(900);
        await flush();

        expect(mockedGetMyProfile).toHaveBeenCalledWith("tok");
        expect(setMyself).toHaveBeenCalledWith(
            expect.objectContaining({ isOfflineForced: "true", customStatus: "🏝 OOO" })
        );
        expect(localStorage.getItem("isOfflineForced")).toBe("true");
        expect(localStorage.getItem("customStatus")).toBe("🏝 OOO");
    });

    it("does NOT adopt the echoed value directly — it uses the server's (authority wins)", async () => {
        const setMyself = vi.fn();
        const mgr = new NotificationManager({ currentUserId: "u-me" });
        const myself = mkUser({ customStatus: "" });
        // Echo says "stale-beat", but the server is authoritative and says "real".
        mockedGetMyProfile.mockResolvedValue({ isOfflineForced: false, customStatus: "real" });

        renderHook(() => useSelfEchoReconcile(myself, setMyself, "tok", mgr));
        dispatchSelfEcho({ userId: "u-me", customStatus: "stale-beat" });
        await vi.advanceTimersByTimeAsync(900);
        await flush();

        expect(setMyself).toHaveBeenCalledWith(expect.objectContaining({ customStatus: "real" }));
        expect(setMyself).not.toHaveBeenCalledWith(
            expect.objectContaining({ customStatus: "stale-beat" })
        );
    });

    it("no-ops when the echo matches local state (no fetch, no setMyself)", async () => {
        const setMyself = vi.fn();
        const mgr = new NotificationManager({ currentUserId: "u-me" });
        const myself = mkUser({ isOfflineForced: "false", customStatus: "here" });

        renderHook(() => useSelfEchoReconcile(myself, setMyself, "tok", mgr));
        dispatchSelfEcho({
            userId: "u-me",
            isOfflineForced: "false",
            customStatus: "here",
            isNotificationsPaused: false,
        });
        await vi.advanceTimersByTimeAsync(900);
        await flush();

        expect(mockedGetMyProfile).not.toHaveBeenCalled();
        expect(mockedGetPrefs).not.toHaveBeenCalled();
        expect(setMyself).not.toHaveBeenCalled();
    });

    it("ignores a self-echo for a different userId", async () => {
        const setMyself = vi.fn();
        const mgr = new NotificationManager({ currentUserId: "u-me" });
        const myself = mkUser({ customStatus: "" });

        renderHook(() => useSelfEchoReconcile(myself, setMyself, "tok", mgr));
        dispatchSelfEcho({ userId: "someone-else", customStatus: "theirs" });
        await vi.advanceTimersByTimeAsync(900);
        await flush();

        expect(mockedGetMyProfile).not.toHaveBeenCalled();
        expect(setMyself).not.toHaveBeenCalled();
    });

    it("re-hydrates notification prefs when the echoed pause flag diverges", async () => {
        const setMyself = vi.fn();
        const mgr = new NotificationManager({ currentUserId: "u-me" });
        // Local: not paused. Server (authority): a future one-shot pause.
        const hydrateSpy = vi.spyOn(mgr, "hydratePreferences");
        mockedGetPrefs.mockResolvedValue({
            ...DEFAULT_NOTIFICATION_PREFERENCE,
            snoozeUntil: "2999-01-01T00:00:00.000Z",
        });
        const myself = mkUser();

        renderHook(() => useSelfEchoReconcile(myself, setMyself, "tok", mgr));
        dispatchSelfEcho({ userId: "u-me", isNotificationsPaused: true });
        await vi.advanceTimersByTimeAsync(900);
        await flush();

        expect(mockedGetPrefs).toHaveBeenCalledWith("tok");
        expect(hydrateSpy).toHaveBeenCalled();
        expect(mgr.getIsSnoozedNow()).toBe(true);
    });

    it("coalesces a burst of echoes into a single fetch (debounce)", async () => {
        const setMyself = vi.fn();
        const mgr = new NotificationManager({ currentUserId: "u-me" });
        mockedGetMyProfile.mockResolvedValue({ isOfflineForced: true, customStatus: "" });
        const myself = mkUser({ isOfflineForced: "false" });

        renderHook(() => useSelfEchoReconcile(myself, setMyself, "tok", mgr));
        dispatchSelfEcho({ userId: "u-me", isOfflineForced: "true" });
        await vi.advanceTimersByTimeAsync(300);
        dispatchSelfEcho({ userId: "u-me", isOfflineForced: "true" });
        await vi.advanceTimersByTimeAsync(300);
        dispatchSelfEcho({ userId: "u-me", isOfflineForced: "true" });
        await vi.advanceTimersByTimeAsync(900);
        await flush();

        expect(mockedGetMyProfile).toHaveBeenCalledTimes(1);
    });
});
