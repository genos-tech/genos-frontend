/**
 * `useUiSettings` — the cross-device UI settings store.
 *
 * Load-bearing behaviour these tests pin:
 *
 *  - localStorage is the pre-auth / offline fallback, so a value cached
 *    from a previous session is visible on first paint before the server
 *    GET returns (theme is read before any token exists).
 *  - Once the account's blob loads, the SERVER value wins over the cache.
 *  - PATCH is a shallow merge (`set` sends only the changed key), and
 *    `set(key, null)` deletes a key ("reset to default").
 *  - No provider / no token degrades to a no-op store rather than throwing,
 *    so a consumer keeps working off its own localStorage value.
 */

import { ReactNode } from "react";
import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useAuth } from "../context/AuthContext";
import { UiSettingsProvider, useUiSettings } from "../hooks/common/useUiSettings";
import { authApi } from "../services/api";

vi.mock("../services/api", () => ({
    authApi: vi.fn(),
    nonAuthApi: vi.fn(),
}));

vi.mock("../context/AuthContext", () => ({
    useAuth: vi.fn(),
}));

const CACHE_KEY = "genos-ui-settings:v1";

const setToken = (token: string | null) => {
    (useAuth as ReturnType<typeof vi.fn>).mockReturnValue({ accessToken: token });
};

const mockApi = (blob: Record<string, unknown>) => {
    const get = vi.fn().mockResolvedValue({ data: { ui_settings: blob } });
    const patch = vi.fn().mockResolvedValue({ data: { ui_settings: blob } });
    (authApi as ReturnType<typeof vi.fn>).mockReturnValue({ get, patch });
    return { get, patch };
};

const wrapper = ({ children }: { children: ReactNode }) => (
    <UiSettingsProvider>{children}</UiSettingsProvider>
);

const renderStore = () => renderHook(() => useUiSettings(), { wrapper });

beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();
    setToken("tok-1");
});

describe("useUiSettings", () => {
    it("serves the localStorage cache before the server GET resolves", () => {
        window.localStorage.setItem(CACHE_KEY, JSON.stringify({ theme: "dark" }));
        mockApi({});
        const { result } = renderStore();
        // Synchronous first render, before the async GET settles.
        expect(result.current.get("theme", "system")).toBe("dark");
    });

    it("adopts the server value over the cache once loaded", async () => {
        window.localStorage.setItem(CACHE_KEY, JSON.stringify({ theme: "dark" }));
        mockApi({ theme: "light" });
        const { result } = renderStore();
        await waitFor(() => expect(result.current.loaded).toBe(true));
        expect(result.current.get("theme", "system")).toBe("light");
        // Cache is refreshed to the server truth.
        expect(JSON.parse(window.localStorage.getItem(CACHE_KEY)!)).toEqual({ theme: "light" });
    });

    it("returns the fallback for an unset key", async () => {
        mockApi({});
        const { result } = renderStore();
        await waitFor(() => expect(result.current.loaded).toBe(true));
        expect(result.current.get("missing", "fallback")).toBe("fallback");
    });

    it("PATCHes only the changed key (shallow merge) and updates in memory", async () => {
        const { patch } = mockApi({ theme: "light" });
        const { result } = renderStore();
        await waitFor(() => expect(result.current.loaded).toBe(true));

        act(() => result.current.set("locale", "ja"));
        expect(result.current.get("locale", "en")).toBe("ja");
        // The prior key survives — this is a merge.
        expect(result.current.get("theme", "system")).toBe("light");
        expect(patch).toHaveBeenCalledWith("/user/preferences/ui-settings/", { locale: "ja" });
    });

    it("deletes a key when set to null", async () => {
        const { patch } = mockApi({ theme: "dark" });
        const { result } = renderStore();
        await waitFor(() => expect(result.current.loaded).toBe(true));

        act(() => result.current.set("theme", null));
        expect(result.current.get("theme", "system")).toBe("system");
        expect(patch).toHaveBeenCalledWith("/user/preferences/ui-settings/", { theme: null });
    });

    it("does not flip loaded or call the API when unauthenticated", async () => {
        setToken(null);
        (authApi as ReturnType<typeof vi.fn>).mockReturnValue(null);
        const { result } = renderStore();
        // Stays unloaded; consumers keep using their local values.
        expect(result.current.loaded).toBe(false);
        // set() is still safe — updates in memory, no network.
        act(() => result.current.set("theme", "dark"));
        expect(result.current.get("theme", "system")).toBe("dark");
    });

    it("keeps the cache and still flips loaded when the GET fails", async () => {
        window.localStorage.setItem(CACHE_KEY, JSON.stringify({ theme: "dark" }));
        const get = vi.fn().mockRejectedValue(new Error("network"));
        const patch = vi.fn();
        (authApi as ReturnType<typeof vi.fn>).mockReturnValue({ get, patch });
        const { result } = renderStore();
        await waitFor(() => expect(result.current.loaded).toBe(true));
        expect(result.current.get("theme", "system")).toBe("dark");
    });

    it("degrades to a no-op store without a provider", () => {
        const { result } = renderHook(() => useUiSettings());
        expect(result.current.loaded).toBe(false);
        expect(result.current.get("theme", "system")).toBe("system");
        expect(() => result.current.set("theme", "dark")).not.toThrow();
    });
});
