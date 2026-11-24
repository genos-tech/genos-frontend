/**
 * Browser leftovers after a sign-out (MIP-2255): the Spotlight session (up to
 * 10 AI turns per team), the chat thread memory and the device id are cleared
 * by the normal AND the forced sign-out, together with the IndexedDB cache.
 * `signInEmail` stays: it is only written when the person ticked "remember".
 */

import { render, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { AuthProvider } from "../context/AuthContext";
import { DatabaseUtils } from "../db/utils/database";
import { useSignOut } from "../hooks/common/useSignOut";
import { clearSignOutLocalStorage } from "../utils/signOutLeftovers";

const calls: string[] = [];
const navigate = vi.fn();
const setAccessToken = vi.fn();

vi.mock("react-router-dom", () => ({ useNavigate: () => navigate }));
vi.mock("../context/authState", async (importOriginal) => ({
    ...(await importOriginal<typeof import("../context/authState")>()),
    useAuth: () => ({ setAccessToken }),
}));
vi.mock("../services/analytics", () => ({ analytics: { reset: vi.fn() } }));
vi.mock("../services/refreshSession", () => ({
    refreshSession: vi.fn(async () => ({ kind: "unauthenticated" })),
}));
vi.mock("../db/utils/database", () => ({
    DatabaseUtils: {
        wipeLocalCache: vi.fn(),
        sweepOrphanYjsDatabases: vi.fn(),
    },
}));

const wipe = vi.mocked(DatabaseUtils.wipeLocalCache);

const seed = () => {
    localStorage.setItem("spotlight:session:v1:7", '{"turns":["what is Ken\'s salary?"]}');
    localStorage.setItem("spotlight:session:v1:9", '{"turns":["q"]}');
    localStorage.setItem("chatThreadMemory", '{"1":2}');
    localStorage.setItem("genos.deviceId", "dev-1");
    localStorage.setItem("genos.history.v1.7", "[]");
    localStorage.setItem("signInEmail", "me@example.com");
    localStorage.setItem("genos-marketing-consent:v1", "kept");
};

const expectLeftoversGone = () => {
    expect(localStorage.getItem("spotlight:session:v1:7")).toBeNull();
    expect(localStorage.getItem("spotlight:session:v1:9")).toBeNull();
    expect(localStorage.getItem("chatThreadMemory")).toBeNull();
    expect(localStorage.getItem("genos.deviceId")).toBeNull();
    expect(localStorage.getItem("genos.history.v1.7")).toBeNull();
    // The opt-in "remember my email" and the consent choice stay.
    expect(localStorage.getItem("signInEmail")).toBe("me@example.com");
    expect(localStorage.getItem("genos-marketing-consent:v1")).toBe("kept");
};

beforeEach(() => {
    calls.length = 0;
    localStorage.clear();
    vi.clearAllMocks();
    vi.spyOn(console, "error").mockImplementation(() => {});
    wipe.mockImplementation(async () => {
        calls.push("wipe");
        return { ok: true, yjsDeleted: 2, yjsLeft: 0 };
    });
});

describe("clearSignOutLocalStorage", () => {
    it("removes the Spotlight session of every team, thread memory and device id", () => {
        seed();
        clearSignOutLocalStorage();
        expectLeftoversGone();
    });
});

describe("normal sign-out", () => {
    it("clears the leftovers and the IndexedDB cache", async () => {
        seed();
        vi.stubGlobal(
            "fetch",
            vi.fn(async () => ({ ok: true }))
        );
        const { result } = renderHook(() => useSignOut());

        await result.current();

        expectLeftoversGone();
        expect(wipe).toHaveBeenCalledTimes(1);
        expect(navigate).toHaveBeenCalledWith("/signin");
    });
});

describe("forced sign-out (refresh token rejected)", () => {
    it("clears the same leftovers and the cache, and redirects only after the wipe", async () => {
        seed();
        const assign = vi.fn(() => calls.push("assign"));
        vi.stubGlobal("location", { pathname: "/home-app", assign });

        render(
            <AuthProvider>
                <div />
            </AuthProvider>
        );

        await waitFor(() => expect(assign).toHaveBeenCalledWith("/signin"));
        expectLeftoversGone();
        expect(wipe).toHaveBeenCalledTimes(1);
        expect(calls.indexOf("wipe")).toBeLessThan(calls.indexOf("assign"));
    });

    it("still redirects when the wipe throws", async () => {
        seed();
        wipe.mockRejectedValueOnce(new Error("idb gone"));
        const assign = vi.fn();
        vi.stubGlobal("location", { pathname: "/home-app", assign });

        render(
            <AuthProvider>
                <div />
            </AuthProvider>
        );

        await waitFor(() => expect(assign).toHaveBeenCalledWith("/signin"));
        expectLeftoversGone();
    });
});
