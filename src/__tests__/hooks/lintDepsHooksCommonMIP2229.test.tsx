import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useNotificationPause } from "../../hooks/common/useNotificationPause";
import { useNotifications } from "../../hooks/common/useNotifications";
import { useTeamManagement } from "../../hooks/common/useTeamManagement";
import { NotificationManager } from "../../services/notifications/notificationManager";
import type { UserProps } from "../../types/admin";

// MIP-2229 (exhaustive-deps, careful part): hooks/common effects keep their
// exact timing after the lint fixes.

const h = vi.hoisted(() => ({
    findTeam: vi.fn(),
    loadMyTeams: vi.fn(),
    popTeamMembers: vi.fn(),
    usersRequest: vi.fn(),
}));

vi.mock("../../features/admin/services/findTeam", () => ({ findTeam: h.findTeam }));
vi.mock("../../features/admin/services/loadMyTeams", () => ({ loadMyTeams: h.loadMyTeams }));
vi.mock("../../features/admin/services/popTeamMembers", () => ({
    popTeamMembers: h.popTeamMembers,
}));
vi.mock("../../db/workers/channels", () => ({ usersChannel: { request: h.usersRequest } }));
vi.mock("../../components/ui/avatars/userDirectory", () => ({ rememberDeletedUsers: vi.fn() }));

const user = (over: Partial<UserProps> = {}) =>
    ({ userId: "u1", teamId: "t1", teamName: "T", ...over }) as UserProps;

beforeEach(() => {
    vi.clearAllMocks();
    h.findTeam.mockResolvedValue({ exist: false });
    h.loadMyTeams.mockResolvedValue([]);
    h.popTeamMembers.mockResolvedValue([]);
    h.usersRequest.mockResolvedValue({});
});

describe("useTeamManagement team lookup effect", () => {
    it("looks the team up once per myself, not on a re-render with the same myself", async () => {
        const myself = user();
        const { rerender } = renderHook(({ m, t }) => useTeamManagement(m, t), {
            initialProps: { m: myself, t: "tok" as string | null },
        });
        await waitFor(() => expect(h.findTeam).toHaveBeenCalledTimes(1));
        rerender({ m: myself, t: "tok2" });
        rerender({ m: myself, t: "tok2" });
        expect(h.findTeam).toHaveBeenCalledTimes(1);
    });

    it("looks up again for a new myself, with the token of that render", async () => {
        const { rerender } = renderHook(({ m, t }) => useTeamManagement(m, t), {
            initialProps: { m: user(), t: "tok" as string | null },
        });
        await waitFor(() => expect(h.findTeam).toHaveBeenCalledTimes(1));
        rerender({ m: user({ teamId: "t2" }), t: "tok2" });
        await waitFor(() => expect(h.findTeam).toHaveBeenCalledTimes(2));
        expect(h.findTeam).toHaveBeenLastCalledWith("tok2", "t2");
    });
});

describe("useNotifications manager", () => {
    it("builds the manager once and keeps feeding it the latest user id and handler", () => {
        const construct = vi.spyOn(NotificationManager.prototype, "setCurrentUserId");
        const setIntent = vi.spyOn(NotificationManager.prototype, "setOnOpenIntent");
        const first = vi.fn();
        const second = vi.fn();
        const { result, rerender } = renderHook(({ m, cb }) => useNotifications(m, null, cb), {
            initialProps: { m: user({ userId: "" }), cb: first },
        });
        const manager = result.current.manager;
        rerender({ m: user({ userId: "u9" }), cb: second });
        expect(result.current.manager).toBe(manager);
        expect(construct).toHaveBeenLastCalledWith("u9");
        expect(setIntent).toHaveBeenLastCalledWith(second);
        rerender({ m: user({ userId: "u9" }), cb: second });
        expect(result.current.manager).toBe(manager);
    });
});

describe("useNotificationPause zone provider", () => {
    const stub = () => {
        const provider: { current: (() => string) | null } = { current: null };
        const manager = {
            setZoneProvider: vi.fn((fn: () => string) => {
                provider.current = fn;
            }),
            setSnoozeUntil: vi.fn(),
            setSnoozeSchedule: vi.fn(),
            getPreferences: () => ({}),
            subscribePreferences: () => () => {},
        } as unknown as NotificationManager;
        return { manager, provider };
    };

    it("registers the provider once and the zone follows location/timezone only", () => {
        const { manager, provider } = stub();
        const { rerender } = renderHook(({ m }) => useNotificationPause(manager, m), {
            initialProps: { m: user({ currentLocation: "Asia/Tokyo" }) },
        });
        expect(provider.current?.()).toBe("Asia/Tokyo");
        rerender({ m: user({ currentLocation: "Asia/Tokyo" }) });
        expect(provider.current?.()).toBe("Asia/Tokyo");
        rerender({ m: user({ currentLocation: "Europe/Paris" }) });
        expect(provider.current?.()).toBe("Europe/Paris");
        expect(manager.setZoneProvider).toHaveBeenCalledTimes(1);
    });
});
