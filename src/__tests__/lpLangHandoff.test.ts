import { act } from "react";
import { renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { LOCALE_STORAGE_KEY, resolveInitialLocale } from "../i18n/localeSource";
import { useLpLang } from "../lp/lpLang";

const APP_URL = "https://genosai.dev";

/** Point `navigator.language` at a locale for one test. */
const setBrowserLanguage = (value: string) =>
    vi.spyOn(navigator, "language", "get").mockReturnValue(value);

/** Rewrite the query string jsdom reports, which `?lang=` is read from. */
const setSearch = (search: string) => {
    window.history.replaceState({}, "", `/home${search}`);
};

beforeEach(() => {
    localStorage.clear();
    setSearch("");
});

afterEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
    setSearch("");
});

describe("useLpLang — which language the marketing page opens in", () => {
    it("opens in Japanese for a Japanese browser", () => {
        setBrowserLanguage("ja-JP");
        const { result } = renderHook(() => useLpLang());
        expect(result.current.lang).toBe("ja");
    });

    it("opens in English for an English browser", () => {
        setBrowserLanguage("en-US");
        const { result } = renderHook(() => useLpLang());
        expect(result.current.lang).toBe("en");
    });

    it("narrows a locale with no LP copy to English", () => {
        // There is no French marketing copy, so `fr` has to render *something*.
        // The interesting half of this case is the CTA assertion further down:
        // narrowing the page must not narrow the app.
        setBrowserLanguage("fr-FR");
        const { result } = renderHook(() => useLpLang());
        expect(result.current.lang).toBe("en");
    });

    it("honours a stored in-app choice over the browser", () => {
        setBrowserLanguage("ja-JP");
        localStorage.setItem(LOCALE_STORAGE_KEY, "en");
        const { result } = renderHook(() => useLpLang());
        expect(result.current.lang).toBe("en");
    });

    it("opens in Japanese from a shared ?lang=ja link", () => {
        setBrowserLanguage("en-US");
        setSearch("?lang=ja");
        const { result } = renderHook(() => useLpLang());
        expect(result.current.lang).toBe("ja");
    });
});

describe("useLpLang — carrying the choice into the app", () => {
    it("leaves the CTA bare until the toggle is used", () => {
        // The regression this guards: appending `?lang=en` for a visitor who
        // never expressed a preference would persist English and override the
        // language the app would have resolved on its own.
        setBrowserLanguage("fr-FR");
        const { result } = renderHook(() => useLpLang());

        expect(result.current.appHref(APP_URL)).toBe(APP_URL);
        expect(localStorage.getItem(LOCALE_STORAGE_KEY)).toBeNull();
        // The app is still free to choose French.
        expect(resolveInitialLocale()).toBe("fr");
    });

    it("carries the language once the visitor picks one", () => {
        setBrowserLanguage("en-US");
        const { result } = renderHook(() => useLpLang());

        act(() => result.current.setLang("ja"));

        expect(result.current.lang).toBe("ja");
        expect(result.current.appHref(APP_URL)).toBe(`${APP_URL}?lang=ja`);
        // Same-origin hop: storage is what actually decides the app's language.
        expect(localStorage.getItem(LOCALE_STORAGE_KEY)).toBe("ja");
        expect(resolveInitialLocale()).toBe("ja");
    });

    it("still carries an explicit choice that matches the browser", () => {
        // `ja` browser + `ja` click is a real preference, not a no-op: without
        // the param the app would fall back to guessing from the browser.
        setBrowserLanguage("ja-JP");
        const { result } = renderHook(() => useLpLang());

        act(() => result.current.setLang("ja"));

        expect(result.current.appHref(APP_URL)).toBe(`${APP_URL}?lang=ja`);
    });

    it("lets a visitor switch back to English", () => {
        setBrowserLanguage("ja-JP");
        const { result } = renderHook(() => useLpLang());
        expect(result.current.lang).toBe("ja");

        act(() => result.current.setLang("en"));

        expect(result.current.appHref(APP_URL)).toBe(`${APP_URL}?lang=en`);
        expect(localStorage.getItem(LOCALE_STORAGE_KEY)).toBe("en");
    });

    it("appends with & when the URL already has a query", () => {
        setBrowserLanguage("en-US");
        const { result } = renderHook(() => useLpLang());

        act(() => result.current.setLang("ja"));

        expect(result.current.appHref(`${APP_URL}?utm_source=lp`)).toBe(
            `${APP_URL}?utm_source=lp&lang=ja`
        );
    });

    it("keeps working when localStorage is unavailable", () => {
        // Private mode / blocked site data: the toggle must still render and
        // the URL must still carry the choice.
        setBrowserLanguage("en-US");
        vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
            throw new Error("blocked");
        });
        const { result } = renderHook(() => useLpLang());

        act(() => result.current.setLang("ja"));

        expect(result.current.lang).toBe("ja");
        expect(result.current.appHref(APP_URL)).toBe(`${APP_URL}?lang=ja`);
    });
});
