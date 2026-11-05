/**
 * What `useAnalyticsIdentity` hands PostHog (MIP-864).
 *
 * The team NAME is customer data, and PostHog is a third party. The opaque
 * `teamId` carries the same analytic value (group users by team), so the name
 * must never leave the browser. Asserted at the very edge, `posthog.identify`,
 * with the real `analytics` wrapper in between: a test of the hook alone would
 * pass even if the wrapper re-added the field.
 */

import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useAnalyticsIdentity } from "../hooks/common/useAnalyticsIdentity";
import { analytics } from "../services/analytics";
import type { UserProps } from "../types/admin";

const posthogMock = vi.hoisted(() => ({
    init: vi.fn(),
    identify: vi.fn(),
    capture: vi.fn(),
    reset: vi.fn(),
    opt_in_capturing: vi.fn(),
    opt_out_capturing: vi.fn(),
}));
vi.mock("posthog-js", () => ({ default: posthogMock }));

const makeMyself = (over: Partial<UserProps> = {}): UserProps =>
    ({
        userId: "user-1",
        teamId: "team-1",
        teamName: "Acme Confidential Project",
        role: "admin",
        ...over,
    }) as UserProps;

describe("useAnalyticsIdentity", () => {
    beforeEach(() => {
        vi.stubEnv("VITE_POSTHOG_KEY", "phc_test");
        vi.stubEnv("VITE_POSTHOG_HOST", "https://eu.i.posthog.com");
        window.localStorage.clear();
        posthogMock.identify.mockClear();
        analytics.init();
    });

    it("identifies with the user id, team id and role", () => {
        renderHook(() => useAnalyticsIdentity(makeMyself()));

        expect(posthogMock.identify).toHaveBeenCalledTimes(1);
        expect(posthogMock.identify).toHaveBeenCalledWith("user-1", {
            role: "admin",
            teamId: "team-1",
        });
    });

    it("never sends the team name", () => {
        renderHook(() => useAnalyticsIdentity(makeMyself()));

        const [, traits] = posthogMock.identify.mock.calls[0];
        expect(traits).not.toHaveProperty("teamName");
        expect(JSON.stringify(posthogMock.identify.mock.calls)).not.toContain(
            "Acme Confidential Project"
        );
    });

    it("does not re-identify when only the team name changes", () => {
        const { rerender } = renderHook(({ me }) => useAnalyticsIdentity(me), {
            initialProps: { me: makeMyself() },
        });
        rerender({ me: makeMyself({ teamName: "Renamed" }) });

        expect(posthogMock.identify).toHaveBeenCalledTimes(1);
    });

    it("sends nothing once the user has opted out", () => {
        analytics.setEnabled(false);
        renderHook(() => useAnalyticsIdentity(makeMyself()));

        expect(posthogMock.identify).not.toHaveBeenCalled();
        analytics.setEnabled(true);
    });
});
