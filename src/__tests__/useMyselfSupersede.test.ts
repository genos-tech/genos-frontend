// useMyself — cross-tab session guard. The browser holds one session
// (a single refresh cookie), so a fresh sign-in / team switch in another
// tab must orphan this one: we freeze the tab (no in-place team flip,
// which would mix data across teams) and surface the winning team's name
// so App can show a reload banner.

import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useMyself } from "../hooks/common/useAuth";

const seedTeam = (teamId: string, userId: string, teamName: string) => {
    localStorage.setItem("teamId", teamId);
    localStorage.setItem("userId", userId);
    localStorage.setItem("teamName", teamName);
};

// Simulate another tab's localStorage write landing here: set the new
// values, then fire the cross-document `storage` event the browser would.
const fireStorage = (key: string) => {
    act(() => {
        window.dispatchEvent(new StorageEvent("storage", { key }));
    });
};

describe("useMyself — cross-tab session supersede", () => {
    beforeEach(() => {
        localStorage.clear();
    });
    afterEach(() => {
        localStorage.clear();
    });

    it("freezes and reports the new team when another tab switches team", async () => {
        seedTeam("team-1", "user-1", "Alpha");
        const { result } = renderHook(() => useMyself("token"));

        // Initial hydration (a 50ms setTimeout in the hook).
        await waitFor(() => expect(result.current.myself.teamId).toBe("team-1"));

        // Another tab signs in to team-2.
        seedTeam("team-2", "user-1", "Bravo");
        fireStorage("teamId");

        await waitFor(() => expect(result.current.supersededByTeamName).toBe("Bravo"));
        // Crucially, this tab's identity must NOT migrate in place.
        expect(result.current.myself.teamId).toBe("team-1");
    });

    it("freezes when another tab signs in as a different user", async () => {
        seedTeam("team-1", "user-1", "Alpha");
        const { result } = renderHook(() => useMyself("token"));
        await waitFor(() => expect(result.current.myself.userId).toBe("user-1"));

        seedTeam("team-9", "user-2", "Charlie");
        fireStorage("userId");

        await waitFor(() => expect(result.current.supersededByTeamName).toBe("Charlie"));
        expect(result.current.myself.userId).toBe("user-1");
    });

    it("does not freeze on a benign same-team profile update (re-pulls instead)", async () => {
        seedTeam("team-1", "user-1", "Alpha");
        localStorage.setItem("customStatus", "Working");
        const { result } = renderHook(() => useMyself("token"));
        await waitFor(() => expect(result.current.myself.teamId).toBe("team-1"));

        // Same team + user, a profile field changed in another tab.
        localStorage.setItem("customStatus", "Away");
        fireStorage("customStatus");

        await waitFor(() => expect(result.current.myself.customStatus).toBe("Away"));
        expect(result.current.supersededByTeamName).toBeNull();
    });

    it("does not freeze a signed-out tab hydrating for the first time", async () => {
        // No seeded identity — this tab is signed out / booting.
        const { result } = renderHook(() => useMyself(null));
        await waitFor(() => expect(result.current.myself.teamId).toBe(""));

        // Another tab signs in; this (empty) tab should just hydrate.
        seedTeam("team-1", "user-1", "Alpha");
        fireStorage("teamId");

        await waitFor(() => expect(result.current.myself.teamId).toBe("team-1"));
        expect(result.current.supersededByTeamName).toBeNull();
    });

    it("clears the pending 50ms hydration timer on unmount", () => {
        // An orphaned timer fires after teardown: a stale setMyself in
        // prod, and here a crash once jsdom's localStorage is gone —
        // this is the timer that intermittently failed CI runs.
        vi.useFakeTimers();
        try {
            const { unmount } = renderHook(() => useMyself("token"));
            expect(vi.getTimerCount()).toBe(1);
            unmount();
            expect(vi.getTimerCount()).toBe(0);
        } finally {
            vi.useRealTimers();
        }
    });
});
