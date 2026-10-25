/**
 * Signing out wipes the local cache, in the right order and without ever
 * getting in the way of the sign-out (MIP-809).
 *
 * The wipe itself is covered against a real IndexedDB in
 * `db/wipeLocalCache.test.ts`; here it is a spy so the ORDER and the failure
 * behaviour of the hook can be checked.
 */

import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { DatabaseUtils } from "../db/utils/database";
import { useSignOut } from "../hooks/common/useSignOut";

const calls: string[] = [];
const navigate = vi.fn(() => calls.push("navigate"));
const setAccessToken = vi.fn(() => calls.push("setAccessToken"));

vi.mock("react-router-dom", () => ({ useNavigate: () => navigate }));
vi.mock("../context/AuthContext", () => ({ useAuth: () => ({ setAccessToken }) }));
vi.mock("../services/analytics", () => ({
    analytics: { reset: vi.fn(() => calls.push("analytics.reset")) },
}));
vi.mock("../db/utils/database", () => ({
    DatabaseUtils: { wipeLocalCache: vi.fn() },
}));

const wipe = vi.mocked(DatabaseUtils.wipeLocalCache);

const serverSays = (ok: boolean) => {
    vi.stubGlobal(
        "fetch",
        vi.fn(async () => {
            calls.push("server");
            return { ok };
        })
    );
};

describe("useSignOut wipes the local cache", () => {
    beforeEach(() => {
        calls.length = 0;
        vi.clearAllMocks();
        vi.spyOn(console, "error").mockImplementation(() => {});
        wipe.mockImplementation(async () => {
            calls.push("wipe");
            return { ok: true, yjsDeleted: 0, yjsLeft: 0 };
        });
        serverSays(true);
    });

    it("wipes after the server confirmed, and before the app leaves the page", async () => {
        const { result } = renderHook(() => useSignOut());

        await result.current();

        expect(wipe).toHaveBeenCalledTimes(1);
        expect(calls.indexOf("server")).toBeLessThan(calls.indexOf("wipe"));
        expect(calls.indexOf("wipe")).toBeLessThan(calls.indexOf("setAccessToken"));
        expect(calls.indexOf("wipe")).toBeLessThan(calls.indexOf("navigate"));
    });

    it("does not wipe when the server refused the sign-out", async () => {
        serverSays(false);
        const { result } = renderHook(() => useSignOut());

        await result.current();

        // Still signed in, so the cache is still theirs to use.
        expect(wipe).not.toHaveBeenCalled();
        expect(setAccessToken).not.toHaveBeenCalled();
        expect(navigate).not.toHaveBeenCalled();
    });

    it("does not wipe when the request itself failed", async () => {
        vi.stubGlobal(
            "fetch",
            vi.fn(async () => {
                throw new Error("offline");
            })
        );
        const { result } = renderHook(() => useSignOut());

        await result.current();

        expect(wipe).not.toHaveBeenCalled();
        expect(navigate).not.toHaveBeenCalled();
    });

    it("still signs out when the wipe throws", async () => {
        wipe.mockRejectedValueOnce(new Error("idb gone"));
        const { result } = renderHook(() => useSignOut());

        await result.current();

        expect(setAccessToken).toHaveBeenCalledWith(null);
        expect(navigate).toHaveBeenCalledWith("/");
    });

    it("still signs out when the wipe reports it could not finish", async () => {
        wipe.mockResolvedValueOnce({ ok: false, yjsDeleted: 0, yjsLeft: 2 });
        const { result } = renderHook(() => useSignOut());

        await result.current();

        expect(setAccessToken).toHaveBeenCalledWith(null);
        expect(navigate).toHaveBeenCalledWith("/");
    });

    it("keeps the last-user marker so the next sign-in still sees a user change", async () => {
        localStorage.setItem("userId", "u-1");
        const { result } = renderHook(() => useSignOut());

        await result.current();

        expect(localStorage.getItem("userId")).toBe("u-1");
    });
});
