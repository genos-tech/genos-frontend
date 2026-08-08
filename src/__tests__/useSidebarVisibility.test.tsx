/**
 * `useSidebarVisibility` — which sidebar entries are shown, backed by the
 * cross-device `ui_settings` store.
 *
 * Behaviour pinned here:
 *  - Absent key ⇒ visible (default is "show everything").
 *  - Hiding persists an explicit `false` under the `sidebarVisibility` key.
 *  - Re-showing DELETES that key (keeps the blob minimal), and emptying the
 *    map deletes the whole `sidebarVisibility` key rather than storing `{}`.
 *  - Genos is not representable here (not in HIDEABLE_SIDEBAR_ITEMS), so it
 *    can never be hidden.
 */

import { ReactNode } from "react";
import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useAuth } from "../context/AuthContext";
import {
    HIDEABLE_SIDEBAR_ITEMS,
    useSidebarVisibility,
} from "../hooks/common/useSidebarVisibility";
import { UiSettingsProvider } from "../hooks/common/useUiSettings";
import { authApi } from "../services/api";

vi.mock("../services/api", () => ({
    authApi: vi.fn(),
    nonAuthApi: vi.fn(),
}));

vi.mock("../context/AuthContext", () => ({
    useAuth: vi.fn(),
}));

const CACHE_KEY = "genos-ui-settings:v1";

const mockApi = () => {
    const patch = vi.fn().mockResolvedValue({ data: { ui_settings: {} } });
    const get = vi.fn().mockResolvedValue({ data: { ui_settings: {} } });
    // Model the real `authApi`: it returns null when there's no token, so a
    // signed-out store fires no network calls. `set` still updates the
    // in-memory + cache state, which is all these tests read.
    (authApi as ReturnType<typeof vi.fn>).mockImplementation((token: unknown) =>
        token ? { get, patch } : null
    );
    return { get, patch };
};

const wrapper = ({ children }: { children: ReactNode }) => (
    <UiSettingsProvider>{children}</UiSettingsProvider>
);

const render = () => renderHook(() => useSidebarVisibility(), { wrapper });

beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();
    // Signed out: keeps the test off the network; the store still works in
    // memory + localStorage cache.
    (useAuth as ReturnType<typeof vi.fn>).mockReturnValue({ accessToken: null });
    mockApi();
});

const readCache = (): Record<string, unknown> => {
    const raw = window.localStorage.getItem(CACHE_KEY);
    return raw ? JSON.parse(raw) : {};
};

describe("useSidebarVisibility", () => {
    it("shows every hideable item by default", () => {
        const { result } = render();
        for (const key of HIDEABLE_SIDEBAR_ITEMS) {
            expect(result.current.isVisible(key)).toBe(true);
        }
    });

    it("does not include Genos among the hideable items", () => {
        expect(HIDEABLE_SIDEBAR_ITEMS).not.toContain("genos");
        expect(HIDEABLE_SIDEBAR_ITEMS).not.toContain("search");
    });

    it("hides an item by persisting an explicit false", () => {
        const { result } = render();
        act(() => result.current.setVisible("tasks", false));
        expect(result.current.isVisible("tasks")).toBe(false);
        // Other items untouched.
        expect(result.current.isVisible("inbox")).toBe(true);
        expect(readCache().sidebarVisibility).toEqual({ tasks: false });
    });

    it("re-showing an item deletes its key and, when last, the whole map", () => {
        const { result } = render();
        act(() => result.current.setVisible("tasks", false));
        act(() => result.current.setVisible("notes", false));
        expect(readCache().sidebarVisibility).toEqual({ tasks: false, notes: false });

        act(() => result.current.setVisible("tasks", true));
        expect(result.current.isVisible("tasks")).toBe(true);
        expect(readCache().sidebarVisibility).toEqual({ notes: false });

        // Emptying the map removes the key entirely (reset to default),
        // rather than persisting an empty object.
        act(() => result.current.setVisible("notes", true));
        expect(readCache().sidebarVisibility).toBeUndefined();
    });
});
