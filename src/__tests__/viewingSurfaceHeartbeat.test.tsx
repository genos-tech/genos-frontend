/**
 * Reporting "which conversation is on screen" to the server, so it can
 * skip the activity-feed row for a message the user is already reading.
 *
 * Three things worth pinning:
 *
 *   1. The token STRINGS. They are a cross-repo contract with
 *      `genos-api`'s `origin/services/v3_activity.py` (`channel_surface` /
 *      `thread_surface` / `task_surface`), which has the mirror of the
 *      format test below. Drift fails open — the row gets written, as
 *      before — so nothing shouts; only these two tests would.
 *
 *   2. The BEAT ON CHANGE. Without it the server keeps thinking you're in
 *      the chat you just left for up to a heartbeat interval, and quietly
 *      drops activities you should have received. This is the failure
 *      mode that loses data, so it gets the most coverage.
 *
 *   3. The retraction when you leave a conversation entirely (empty
 *      token), which is what stops that from happening on the way out.
 */

import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useNotifications } from "../hooks/common/useNotifications";
import { sendPresenceHeartbeat } from "../services/notifications/notificationApi";
import type { ActiveSurface } from "../services/notifications/types";
import { viewingSurfaceToken } from "../services/notifications/viewingSurface";
import type { UserProps } from "../types/admin";

vi.mock("../services/notifications/notificationApi", async () => {
    // The real `getNotificationPreferences` falls back to the defaults
    // rather than resolving null, and the hook hydrates the manager with
    // whatever it returns unguarded — so the mock has to keep that
    // contract or every test in this file drowns in unhandled rejections.
    const { DEFAULT_NOTIFICATION_PREFERENCE } = await import("../services/notifications/types");
    return {
        getNotificationPreferences: vi.fn(async () => DEFAULT_NOTIFICATION_PREFERENCE),
        updateNotificationPreferences: vi.fn(async () => DEFAULT_NOTIFICATION_PREFERENCE),
        sendPresenceHeartbeat: vi.fn(async () => undefined),
        clearPresence: vi.fn(),
    };
});

vi.mock("../services/notifications/pushSubscription", () => ({
    ensurePushSubscription: vi.fn(async () => false),
    initPushClickNavigation: vi.fn(),
}));

const myself = { userId: "me", userName: "Me" } as UserProps;

const beats = () => (sendPresenceHeartbeat as unknown as ReturnType<typeof vi.fn>).mock.calls;
const surfacesSent = () => beats().map((c) => c[1]);

describe("viewingSurfaceToken", () => {
    it("uses the exact strings the backend mints", () => {
        // Mirror of `SurfaceTokenFormatTests` in
        // origin/tests/test_activity_viewing_suppression.py.
        expect(viewingSurfaceToken({ chatId: "abc-123", chatType: 1 })).toBe("channel:abc-123");
        expect(viewingSurfaceToken({ chatId: "abc", chatType: 1, threadId: "root-9" })).toBe(
            "thread:root-9"
        );
        expect(viewingSurfaceToken({ taskId: 42 })).toBe("task:42");
    });

    it("is empty when no conversation is open", () => {
        expect(viewingSurfaceToken(null)).toBe("");
        expect(viewingSurfaceToken(undefined)).toBe("");
        expect(viewingSurfaceToken({})).toBe("");
        expect(viewingSurfaceToken({ chatId: "" })).toBe("");
    });

    it("prefers the thread pane over the channel behind it", () => {
        // The reader is reading the thread; the channel is just what it
        // opened from. `matchesActiveSurface` orders these the same way.
        expect(viewingSurfaceToken({ chatId: "channel-1", chatType: 2, threadId: 7 })).toBe(
            "thread:7"
        );
    });

    it("carries a v3 channel UUID through unchanged", () => {
        // The id space matters: the server keys on `Channel.id`, and the
        // frontend's `chatId` holds exactly that for v3 channels.
        const uuid = "11111111-2222-3333-4444-555555555555";
        expect(viewingSurfaceToken({ chatId: uuid, chatType: 1 })).toBe(`channel:${uuid}`);
    });
});

describe("presence heartbeat carries the active surface", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    const setup = () => renderHook(() => useNotifications(myself, "token"));

    it("sends the surface with the beat", () => {
        const { result } = setup();
        act(() => result.current.setActiveSurface({ chatId: "c-1", chatType: 1 }));
        expect(surfacesSent()).toContain("channel:c-1");
    });

    it("beats immediately when the user moves to another chat", () => {
        const { result } = setup();
        act(() => result.current.setActiveSurface({ chatId: "c-1", chatType: 1 }));
        const before = beats().length;
        act(() => result.current.setActiveSurface({ chatId: "c-2", chatType: 1 }));
        expect(beats().length).toBe(before + 1);
        expect(beats().at(-1)?.[1]).toBe("channel:c-2");
    });

    it("retracts by sending an empty surface when leaving the conversation", () => {
        const { result } = setup();
        act(() => result.current.setActiveSurface({ chatId: "c-1", chatType: 1 }));
        act(() => result.current.setActiveSurface(null));
        expect(beats().at(-1)?.[1]).toBe("");
    });

    it("does not re-beat when the surface is unchanged", () => {
        // `App.tsx` recomputes the active surface on unrelated renders; an
        // unchanged value must not turn that into heartbeat traffic.
        const { result } = setup();
        const surface: ActiveSurface = { chatId: "c-1", chatType: 1 };
        act(() => result.current.setActiveSurface(surface));
        const after = beats().length;
        act(() => result.current.setActiveSurface({ ...surface }));
        expect(beats().length).toBe(after);
    });

    it("stays quiet while the tab is hidden", () => {
        // Presence means "looking at it"; a hidden tab reports nothing, so
        // the server lets the activity row through.
        const spy = vi.spyOn(document, "visibilityState", "get").mockReturnValue("hidden");
        try {
            const { result } = setup();
            const before = beats().length;
            act(() => result.current.setActiveSurface({ chatId: "c-1", chatType: 1 }));
            expect(beats().length).toBe(before);
        } finally {
            spy.mockRestore();
        }
    });
});
