/**
 * MIP-1119: the row-density setting. A stored value becomes `data-density`
 * on <html>, and `--g-row` keys on that attribute. jsdom cannot resolve
 * `var()`, so the token half is checked on the emitted stylesheet text and
 * the computed row heights were checked in a real browser (see the PR).
 */

import { ReactNode } from "react";
import { CssVarsProvider } from "@mui/joy/styles";
import { act, fireEvent, render, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { DensitySetting } from "../components/layout/DensitySetting";
import { useAuth } from "../context/AuthContext";
import { useDensityPreference } from "../hooks/common/densityContext";
import { DensityPreferenceProvider } from "../hooks/common/useDensityPreference";
import { UiSettingsProvider } from "../hooks/common/useUiSettings";
import { authApi } from "../services/api";
import { DENSITY_STORAGE_KEY, installActiveDensity, isDensity } from "../theme/density";
import { buildJoyTheme } from "../theme/purplePalette";
import { g } from "../theme/tokens";
import { ROW } from "../theme/tokens/scales";
import { buildTokenStylesheet } from "../theme/tokens/tokenStyles";

vi.mock("../services/api", () => ({ authApi: vi.fn(), nonAuthApi: vi.fn() }));
vi.mock("../context/AuthContext", () => ({ useAuth: vi.fn() }));

const attr = () => document.documentElement.dataset.density;

const mockServer = (blob: Record<string, unknown>) => {
    const get = vi.fn().mockResolvedValue({ data: { ui_settings: blob } });
    const patch = vi.fn().mockResolvedValue({ data: { ui_settings: blob } });
    (authApi as ReturnType<typeof vi.fn>).mockReturnValue({ get, patch });
    return { get, patch };
};

const wrapper = ({ children }: { children: ReactNode }) => (
    <UiSettingsProvider>
        <DensityPreferenceProvider>{children}</DensityPreferenceProvider>
    </UiSettingsProvider>
);

beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();
    delete document.documentElement.dataset.density;
    (useAuth as ReturnType<typeof vi.fn>).mockReturnValue({ accessToken: "tok" });
});

describe("the --g-row token", () => {
    const css = buildTokenStylesheet();

    it("defaults to the default row on bare :root, and exposes it as g.row.current", () => {
        expect(css).toMatch(/:root \{[^}]*--g-row: var\(--g-row-default\);/);
        expect(g.row.current).toBe("var(--g-row)");
    });

    it("re-points per data-density, after the :root block so it wins", () => {
        for (const d of ["compact", "default", "comfortable"]) {
            const rule = new RegExp(
                `:root\\[data-density="${d}"\\],\\s*\\[data-g-density="${d}"\\] \\{\\s*--g-row: var\\(--g-row-${d}\\);\\s*\\}`
            );
            expect(css, d).toMatch(rule);
        }
        expect(css.indexOf('[data-density="compact"]')).toBeGreaterThan(css.indexOf("--g-row:"));
        // A wrapper pinned to "default" must reset --g-row, not inherit the page's.
        expect(css).toContain('[data-g-density="default"]');
    });

    it("the three row heights are 32, 36 and 44", () => {
        expect(ROW).toEqual({ compact: 32, default: 36, comfortable: 44 });
        expect(css).toContain("--g-row-compact: 32px;");
        expect(css).toContain("--g-row-default: 36px;");
        expect(css).toContain("--g-row-comfortable: 44px;");
    });
});

describe("installActiveDensity (before first paint)", () => {
    it.each(["compact", "default", "comfortable"])("a stored %s becomes the attribute", (d) => {
        window.localStorage.setItem(DENSITY_STORAGE_KEY, d);
        expect(installActiveDensity()).toBe(d);
        expect(attr()).toBe(d);
    });

    it("nothing stored means Default", () => {
        installActiveDensity();
        expect(attr()).toBe("default");
    });

    it("an invalid stored value is ignored, not applied", () => {
        window.localStorage.setItem(DENSITY_STORAGE_KEY, "huge");
        installActiveDensity();
        expect(attr()).toBe("default");
        expect(isDensity("huge")).toBe(false);
        expect(isDensity(undefined)).toBe(false);
    });

    it("blocked storage falls back to Default instead of throwing", () => {
        const spy = vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
            throw new Error("blocked");
        });
        expect(() => installActiveDensity()).not.toThrow();
        expect(attr()).toBe("default");
        spy.mockRestore();
    });

    it("importing the theme provider applies the stored density at boot", async () => {
        window.localStorage.setItem(DENSITY_STORAGE_KEY, "comfortable");
        vi.resetModules();
        await import("../theme/ColorThemeProvider");
        expect(attr()).toBe("comfortable");
    });
});

describe("DensityPreferenceProvider", () => {
    it("applies the stored pick on mount", async () => {
        const { patch } = mockServer({});
        window.localStorage.setItem(DENSITY_STORAGE_KEY, "compact");
        const { result } = renderHook(() => useDensityPreference(), { wrapper });
        expect(result.current.density).toBe("compact");
        expect(attr()).toBe("compact");
        await waitFor(() => expect(patch).toHaveBeenCalled()); // settle the migration
    });

    it("with nothing chosen anywhere: Default, nothing stored, nothing sent", async () => {
        const { get, patch } = mockServer({});
        const { result } = renderHook(() => useDensityPreference(), { wrapper });
        await waitFor(() => expect(get).toHaveBeenCalled());
        await act(async () => {});
        expect(result.current.density).toBe("default");
        expect(attr()).toBe("default");
        expect(window.localStorage.getItem(DENSITY_STORAGE_KEY)).toBeNull();
        expect(patch).not.toHaveBeenCalled();
    });

    it("setDensity switches the attribute at once, stores it and PATCHes ui_settings", async () => {
        const { get, patch } = mockServer({});
        const { result } = renderHook(() => useDensityPreference(), { wrapper });
        await waitFor(() => expect(get).toHaveBeenCalled());

        act(() => result.current.setDensity("comfortable"));
        expect(result.current.density).toBe("comfortable");
        expect(attr()).toBe("comfortable");
        expect(window.localStorage.getItem(DENSITY_STORAGE_KEY)).toBe("comfortable");
        expect(patch).toHaveBeenCalledWith("/user/preferences/ui-settings/", {
            density: "comfortable",
        });
    });

    it("adopts the account's value over this device's once loaded", async () => {
        mockServer({ density: "comfortable" });
        window.localStorage.setItem(DENSITY_STORAGE_KEY, "compact");
        const { result } = renderHook(() => useDensityPreference(), { wrapper });
        expect(attr()).toBe("compact");
        await waitFor(() => expect(result.current.density).toBe("comfortable"));
        expect(attr()).toBe("comfortable");
        expect(window.localStorage.getItem(DENSITY_STORAGE_KEY)).toBe("comfortable");
    });

    it("migrates this device's explicit pick up when the account has none", async () => {
        const { patch } = mockServer({});
        window.localStorage.setItem(DENSITY_STORAGE_KEY, "compact");
        renderHook(() => useDensityPreference(), { wrapper });
        await waitFor(() =>
            expect(patch).toHaveBeenCalledWith("/user/preferences/ui-settings/", {
                density: "compact",
            })
        );
    });

    it("ignores an invalid server value and keeps the local one", async () => {
        const { get } = mockServer({ density: "huge" });
        window.localStorage.setItem(DENSITY_STORAGE_KEY, "compact");
        const { result } = renderHook(() => useDensityPreference(), { wrapper });
        await waitFor(() => expect(get).toHaveBeenCalled());
        await act(async () => {});
        expect(result.current.density).toBe("compact");
        expect(attr()).toBe("compact");
    });
});

describe("Settings control", () => {
    const mount = () =>
        render(
            <CssVarsProvider theme={buildJoyTheme("purple")}>
                <UiSettingsProvider>
                    <DensityPreferenceProvider>
                        <DensitySetting />
                    </DensityPreferenceProvider>
                </UiSettingsProvider>
            </CssVarsProvider>
        );

    it("shows the current density and selecting another sets the attribute and ui_settings", async () => {
        const { patch } = mockServer({});
        const { container } = mount();
        // Plain DOM queries: Joy's Select popup trees are slow under getByRole.
        const button = container.querySelector<HTMLElement>('[role="combobox"]')!;
        // Joy paints the selected label only once the popup has registered
        // its options (jsdom: on first open), so read the value instead.
        const valueInput = () => container.querySelector<HTMLInputElement>("input[aria-hidden]")!;
        expect(valueInput().value).toBe("default");
        expect(button.getAttribute("aria-labelledby")).toBe("density-setting-label");

        fireEvent.click(button);
        const options = Array.from(document.querySelectorAll<HTMLElement>('[role="option"]'));
        expect(options.map((o) => o.textContent)).toEqual(["Compact", "Default", "Comfortable"]);
        fireEvent.click(options[0]);

        await waitFor(() => expect(attr()).toBe("compact"));
        expect(window.localStorage.getItem(DENSITY_STORAGE_KEY)).toBe("compact");
        expect(patch).toHaveBeenCalledWith("/user/preferences/ui-settings/", {
            density: "compact",
        });
        expect(valueInput().value).toBe("compact");
    });
});
