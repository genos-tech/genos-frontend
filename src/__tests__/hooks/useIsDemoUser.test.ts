import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { getMyProfile } from "../../features/admin/services/getMyProfile";
import { useIsDemoUser } from "../../hooks/common/useIsDemoUser";

vi.mock("../../features/admin/services/getMyProfile", () => ({ getMyProfile: vi.fn() }));

const profile = (isDemo: boolean) => ({
    isOfflineForced: false,
    customStatus: "",
    customStatusExpiry: null,
    isDemo,
});
const asMock = getMyProfile as unknown as ReturnType<typeof vi.fn>;

describe("useIsDemoUser", () => {
    beforeEach(() => asMock.mockReset());

    it("is false until the profile loads, then follows the server flag", async () => {
        asMock.mockResolvedValue(profile(true));
        const { result } = renderHook(() => useIsDemoUser("tok", "u1"));
        expect(result.current).toBe(false);
        await waitFor(() => expect(result.current).toBe(true));
    });

    it("is false for a real user", async () => {
        asMock.mockResolvedValue(profile(false));
        const { result } = renderHook(() => useIsDemoUser("tok", "u1"));
        await waitFor(() => expect(asMock).toHaveBeenCalledTimes(1));
        await act(async () => {});
        expect(result.current).toBe(false);
    });

    it("stays false when the profile cannot be read", async () => {
        asMock.mockResolvedValue(null);
        const { result } = renderHook(() => useIsDemoUser("tok", "u1"));
        await waitFor(() => expect(asMock).toHaveBeenCalledTimes(1));
        await act(async () => {});
        expect(result.current).toBe(false);
    });

    it("does not ask before there is a token or a user", () => {
        renderHook(() => useIsDemoUser(null, "u1"));
        renderHook(() => useIsDemoUser("tok", null));
        expect(asMock).not.toHaveBeenCalled();
    });

    it("does not refetch on a token refresh, and a different user starts from false", async () => {
        asMock.mockResolvedValueOnce(profile(true));
        const { result, rerender } = renderHook(({ tok, uid }) => useIsDemoUser(tok, uid), {
            initialProps: { tok: "t1", uid: "demo-user" },
        });
        await waitFor(() => expect(result.current).toBe(true));

        rerender({ tok: "t2", uid: "demo-user" });
        expect(result.current).toBe(true);
        expect(asMock).toHaveBeenCalledTimes(1);

        // A real user signs in on the same browser: never the demo user's answer.
        asMock.mockResolvedValueOnce(profile(false));
        rerender({ tok: "t3", uid: "real-user" });
        expect(result.current).toBe(false);
        await waitFor(() => expect(asMock).toHaveBeenCalledTimes(2));
        await act(async () => {});
        expect(result.current).toBe(false);
    });

    it("ignores an answer that arrives after the user changed", async () => {
        let resolveDemo: (v: ReturnType<typeof profile>) => void = () => {};
        asMock.mockReturnValueOnce(new Promise((r) => (resolveDemo = r)));
        asMock.mockResolvedValueOnce(profile(false));
        const { result, rerender } = renderHook(({ uid }) => useIsDemoUser("tok", uid), {
            initialProps: { uid: "demo-user" },
        });
        rerender({ uid: "real-user" });
        await act(async () => {
            resolveDemo(profile(true));
        });
        expect(result.current).toBe(false);
    });
});
