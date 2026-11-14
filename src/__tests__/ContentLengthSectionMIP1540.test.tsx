/**
 * MIP-1540: Settings -> Genos -> "How much Genos writes" (Short / Standard / Long).
 *
 * Covers what jsdom can: load, an unknown stored value, choose, save failure (revert + toast), a
 * failed load, the accessible names, and that all seven locales carry every string, translated.
 * jsdom lays nothing out, so the real layout (phone width, hit areas, light/dark) is checked in a
 * browser, not here.
 */
import { CssVarsProvider } from "@mui/joy/styles";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { toast } from "../components/ui/feedback/toastStore";
import { ContentLengthSection } from "../features/genos/ContentLengthSection";
import { normalizeContentLength } from "../hooks/common/useContentLengthPreference";
import { ar } from "../i18n/locales/ar";
import { en } from "../i18n/locales/en";
import { es } from "../i18n/locales/es";
import { fr } from "../i18n/locales/fr";
import { hi } from "../i18n/locales/hi";
import { ja } from "../i18n/locales/ja";
import { zh } from "../i18n/locales/zh";

const api = vi.hoisted(() => ({ get: vi.fn(), patch: vi.fn() }));
vi.mock("../context/AuthContext", () => ({ useAuth: () => ({ accessToken: "tok" }) }));
vi.mock("../services/api", () => ({ authApi: () => api }));

const s = en.settings.contentLength;

const renderSection = () =>
    render(
        <CssVarsProvider>
            <ContentLengthSection />
        </CssVarsProvider>
    );

const radio = (name: string) => screen.getByRole("radio", { name });

beforeEach(() => {
    api.get.mockReset();
    api.patch.mockReset();
});
afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
});

describe("How much Genos writes: load", () => {
    it("shows the saved level as selected, with the three options named", async () => {
        api.get.mockResolvedValue({ data: { content_length: "long" } });
        renderSection();
        await waitFor(() => expect(radio(s.longLabel)).toBeChecked());
        expect(radio(s.shortLabel)).not.toBeChecked();
        expect(radio(s.standardLabel)).not.toBeChecked();
        expect(api.get).toHaveBeenCalledWith("/user/preferences/content-length/", {
            suppressErrorToast: true,
        });
        // The group is named by its heading, each option is described by its one-liner.
        expect(screen.getByRole("radiogroup", { name: s.heading })).toBeInTheDocument();
        expect(radio(s.shortLabel)).toHaveAccessibleDescription(s.shortHelper);
        expect(screen.getByText(s.description)).toBeInTheDocument();
    });

    it("is disabled while loading", () => {
        api.get.mockReturnValue(new Promise(() => {}));
        renderSection();
        expect(radio(s.standardLabel)).toBeDisabled();
        expect(radio(s.standardLabel)).not.toBeChecked();
    });

    it.each([["bogus"], [""], [null], [undefined]])(
        "falls back to Standard for a stored value of %j",
        async (stored) => {
            api.get.mockResolvedValue({ data: { content_length: stored } });
            renderSection();
            await waitFor(() => expect(radio(s.standardLabel)).toBeChecked());
        }
    );

    it("normalizes case and padding the way the API does", () => {
        expect(normalizeContentLength(" Long ")).toBe("long");
        expect(normalizeContentLength("SHORT")).toBe("short");
        expect(normalizeContentLength(3)).toBe("standard");
    });

    it("shows a retry, not a guessed Standard, when the load fails", async () => {
        api.get.mockRejectedValueOnce(new Error("503"));
        renderSection();
        expect(await screen.findByText(s.loadFailed)).toBeInTheDocument();
        expect(screen.queryByRole("radio")).not.toBeInTheDocument();

        api.get.mockResolvedValueOnce({ data: { content_length: "short" } });
        await userEvent.click(screen.getByRole("button", { name: en.common.actions.retry }));
        await waitFor(() => expect(radio(s.shortLabel)).toBeChecked());
    });
});

describe("How much Genos writes: change", () => {
    it("selects at once and PATCHes the new level", async () => {
        api.get.mockResolvedValue({ data: { content_length: "standard" } });
        let finish: (v: unknown) => void = () => {};
        api.patch.mockReturnValue(new Promise((resolve) => (finish = resolve)));
        renderSection();
        await waitFor(() => expect(radio(s.standardLabel)).toBeChecked());

        await userEvent.click(radio(s.shortLabel));
        // Optimistic: checked before the server has answered.
        expect(radio(s.shortLabel)).toBeChecked();
        expect(api.patch).toHaveBeenCalledWith(
            "/user/preferences/content-length/",
            { content_length: "short" },
            { suppressErrorToast: true }
        );
        finish({ data: { content_length: "short" } });
        await waitFor(() => expect(radio(s.shortLabel)).toBeChecked());
    });

    it("a click on an option's text picks it too", async () => {
        api.get.mockResolvedValue({ data: { content_length: "standard" } });
        api.patch.mockResolvedValue({ data: { content_length: "long" } });
        renderSection();
        await waitFor(() => expect(radio(s.standardLabel)).toBeChecked());
        await userEvent.click(screen.getByText(s.longHelper));
        await waitFor(() => expect(radio(s.longLabel)).toBeChecked());
        expect(api.patch).toHaveBeenCalledTimes(1);
    });

    it("reverts and shows a toast when the save fails", async () => {
        const toastError = vi.spyOn(toast, "error").mockReturnValue("t");
        api.get.mockResolvedValue({ data: { content_length: "standard" } });
        api.patch.mockRejectedValue(new Error("500"));
        renderSection();
        await waitFor(() => expect(radio(s.standardLabel)).toBeChecked());

        await userEvent.click(radio(s.longLabel));
        await waitFor(() => expect(radio(s.standardLabel)).toBeChecked());
        expect(radio(s.longLabel)).not.toBeChecked();
        expect(toastError).toHaveBeenCalledWith(s.saveFailed, expect.anything());
    });

    it("goes back to the last confirmed level after two quick changes where the second fails", async () => {
        vi.spyOn(toast, "error").mockReturnValue("t");
        api.get.mockResolvedValue({ data: { content_length: "standard" } });
        api.patch
            .mockResolvedValueOnce({ data: { content_length: "short" } })
            .mockRejectedValueOnce(new Error("500"));
        renderSection();
        await waitFor(() => expect(radio(s.standardLabel)).toBeChecked());

        await userEvent.click(radio(s.shortLabel));
        await waitFor(() => expect(api.patch).toHaveBeenCalledTimes(1));
        await userEvent.click(radio(s.longLabel));
        await waitFor(() => expect(radio(s.shortLabel)).toBeChecked());
    });
});

describe("How much Genos writes: locales", () => {
    const OTHERS = { ja, es, fr, zh, ar, hi } as const;
    const KEYS = Object.keys(s) as Array<keyof typeof s>;
    // The same word in English and in French (Standard, Long); every other string must be translated.
    const SAME_AS_ENGLISH = new Set(["fr.standardLabel", "fr.longLabel"]);
    type Catalog = { settings?: { contentLength?: Record<string, string> } };
    const own = (c: unknown) => (c as Catalog).settings?.contentLength ?? {};

    it("English has every string", () => {
        expect(KEYS.length).toBe(10);
        for (const k of KEYS) expect(s[k], k).toBeTruthy();
    });

    for (const [name, catalog] of Object.entries(OTHERS)) {
        it(`${name} has every key English has, translated, and no others`, () => {
            expect(Object.keys(own(catalog)).sort()).toEqual([...KEYS].sort());
            for (const k of KEYS) {
                const value = own(catalog)[k];
                expect(value, `${name}.${k}`).toBeTruthy();
                if (!SAME_AS_ENGLISH.has(`${name}.${k}`)) {
                    expect(value, `${name}.${k} is the English text`).not.toBe(s[k]);
                }
            }
        });
    }

    it("the three level labels differ within each locale", () => {
        for (const catalog of [en, ...Object.values(OTHERS)]) {
            const c = own(catalog);
            expect(new Set([c.shortLabel, c.standardLabel, c.longLabel]).size).toBe(3);
        }
    });
});
