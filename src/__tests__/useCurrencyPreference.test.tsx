/**
 * Which currency a visitor sees prices in.
 *
 * The distinction this is built around: **display** currency is free to
 * guess at and free to change; **billing** currency is fixed at checkout
 * and Stripe cannot change it afterwards. Nothing here touches the
 * second — a subscriber flipping the picker changes what the comparison
 * table quotes and nothing about their bill, because their real currency
 * is read off their Stripe subscription.
 */

import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";

import {
    defaultCurrencyForLocale,
    useCurrencyPreference,
} from "../hooks/common/useCurrencyPreference";

beforeEach(() => {
    window.localStorage.clear();
});

describe("defaultCurrencyForLocale", () => {
    it("gives Japanese readers yen", () => {
        expect(defaultCurrencyForLocale("ja")).toBe("jpy");
        expect(defaultCurrencyForLocale("ja-JP")).toBe("jpy");
    });

    it("gives everyone else USD", () => {
        // A US visitor reading "¥2,500" has to do arithmetic before they
        // can judge the offer — friction at the worst possible moment.
        for (const locale of ["en", "es", "fr", "zh", "ar", "hi"]) {
            expect(defaultCurrencyForLocale(locale)).toBe("usd");
        }
    });

    it("derives from LOCALE, never from geography", () => {
        // Locale is something the user chose. An IP is something that
        // happens to them, and geo-guessing shows a travelling customer
        // the wrong currency exactly when they are deciding to pay.
        // Structural: the function takes a locale and nothing else.
        expect(defaultCurrencyForLocale.length).toBe(1);
    });
});

describe("useCurrencyPreference", () => {
    it("follows the locale before the visitor has chosen", () => {
        const { result } = renderHook(() => useCurrencyPreference("ja"));
        expect(result.current.currency).toBe("jpy");
        expect(result.current.isExplicit).toBe(false);
    });

    it("an explicit choice wins over the locale", () => {
        const { result } = renderHook(() => useCurrencyPreference("ja"));
        act(() => result.current.setCurrency("usd"));
        expect(result.current.currency).toBe("usd");
        expect(result.current.isExplicit).toBe(true);
    });

    it("an explicit choice survives a language switch", () => {
        // Switching UI language must not silently re-quote the prices of
        // someone who deliberately picked a currency.
        const { result, rerender } = renderHook(({ locale }) => useCurrencyPreference(locale), {
            initialProps: { locale: "en" },
        });
        act(() => result.current.setCurrency("jpy"));
        rerender({ locale: "fr" });
        expect(result.current.currency).toBe("jpy");
    });

    it("clearing the choice returns to following the locale", () => {
        const { result } = renderHook(() => useCurrencyPreference("ja"));
        act(() => result.current.setCurrency("usd"));
        act(() => result.current.setCurrency(null));
        expect(result.current.currency).toBe("jpy");
        expect(result.current.isExplicit).toBe(false);
    });

    it("persists the choice across a reload", () => {
        const first = renderHook(() => useCurrencyPreference("en"));
        act(() => first.result.current.setCurrency("jpy"));
        first.unmount();

        const second = renderHook(() => useCurrencyPreference("en"));
        expect(second.result.current.currency).toBe("jpy");
    });

    it("normalises the code to lowercase", () => {
        // The server matches on lowercase codes; "USD" would fall back
        // to the default and quietly show the wrong prices.
        const { result } = renderHook(() => useCurrencyPreference("en"));
        act(() => result.current.setCurrency("JPY"));
        expect(result.current.currency).toBe("jpy");
    });

    it("still works when localStorage throws", () => {
        // Private browsing. The choice just does not survive a reload.
        const original = window.localStorage.getItem;
        window.localStorage.getItem = () => {
            throw new Error("denied");
        };
        try {
            const { result } = renderHook(() => useCurrencyPreference("ja"));
            expect(result.current.currency).toBe("jpy");
        } finally {
            window.localStorage.getItem = original;
        }
    });
});
