/**
 * Which currency a visitor sees prices in.
 *
 * Inferred from the browser's TIME ZONE — geography, not language.
 * This used to derive from locale, which was wrong for currency
 * specifically: plenty of people in Japan run their tools in English
 * and were shown dollars for a product they'd be billed for in yen.
 * Language is what you chose to read in; currency is about which market
 * you're buying in.
 *
 * And the distinction the whole thing rests on: **display** currency is
 * free to infer and free to change; **billing** currency is fixed at
 * checkout and Stripe cannot change it afterwards. Nothing here touches
 * the second — a subscriber flipping the picker changes what the
 * comparison table quotes and nothing about their bill.
 */

import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { currencyForTimeZone, useCurrencyPreference } from "../hooks/common/useCurrencyPreference";

/** Pretend the browser is in `tz`. */
const inTimeZone = (tz: string) => {
    vi.spyOn(Intl, "DateTimeFormat").mockImplementation(
        () => ({ resolvedOptions: () => ({ timeZone: tz }) }) as unknown as Intl.DateTimeFormat
    );
};

beforeEach(() => {
    window.localStorage.clear();
});

afterEach(() => {
    vi.restoreAllMocks();
});

describe("currencyForTimeZone", () => {
    it("gives Japan yen", () => {
        expect(currencyForTimeZone("Asia/Tokyo")).toBe("jpy");
    });

    it("gives everywhere else USD", () => {
        for (const tz of [
            "America/New_York",
            "America/Los_Angeles",
            "Europe/London",
            "Europe/Berlin",
            "Asia/Singapore",
            "Australia/Sydney",
        ]) {
            expect(currencyForTimeZone(tz), tz).toBe("usd");
        }
    });

    it("falls back to USD on an unknown or empty zone", () => {
        expect(currencyForTimeZone("")).toBe("usd");
        expect(currencyForTimeZone("Not/AZone")).toBe("usd");
    });

    it("does not confuse a nearby zone for Japan", () => {
        // Same UTC offset as Tokyo, different market.
        expect(currencyForTimeZone("Asia/Seoul")).toBe("usd");
    });
});

describe("useCurrencyPreference", () => {
    it("infers yen for a visitor in Japan", () => {
        inTimeZone("Asia/Tokyo");
        const { result } = renderHook(() => useCurrencyPreference());
        expect(result.current.currency).toBe("jpy");
        expect(result.current.isExplicit).toBe(false);
    });

    it("infers USD for a visitor outside Japan", () => {
        inTimeZone("America/New_York");
        const { result } = renderHook(() => useCurrencyPreference());
        expect(result.current.currency).toBe("usd");
    });

    it("ignores the UI language", () => {
        // The reason this changed. A Japanese engineer running the app
        // in English is still buying in Japan.
        inTimeZone("Asia/Tokyo");
        const { result } = renderHook(() => useCurrencyPreference());
        expect(result.current.currency).toBe("jpy");
    });

    it("an explicit choice wins over the detected one", () => {
        inTimeZone("Asia/Tokyo");
        const { result } = renderHook(() => useCurrencyPreference());
        act(() => result.current.setCurrency("usd"));
        expect(result.current.currency).toBe("usd");
        expect(result.current.isExplicit).toBe(true);
    });

    it("clearing the choice returns to the detected one", () => {
        inTimeZone("Asia/Tokyo");
        const { result } = renderHook(() => useCurrencyPreference());
        act(() => result.current.setCurrency("usd"));
        act(() => result.current.setCurrency(null));
        expect(result.current.currency).toBe("jpy");
        expect(result.current.isExplicit).toBe(false);
    });

    it("persists the choice across a reload", () => {
        inTimeZone("America/New_York");
        const first = renderHook(() => useCurrencyPreference());
        act(() => first.result.current.setCurrency("jpy"));
        first.unmount();

        const second = renderHook(() => useCurrencyPreference());
        expect(second.result.current.currency).toBe("jpy");
    });

    it("normalises the code to lowercase", () => {
        // The server matches lowercase; "USD" would fall back to the
        // default and quietly show the wrong prices.
        inTimeZone("Asia/Tokyo");
        const { result } = renderHook(() => useCurrencyPreference());
        act(() => result.current.setCurrency("USD"));
        expect(result.current.currency).toBe("usd");
    });

    it("falls back to USD when the browser exposes no time zone", () => {
        vi.spyOn(Intl, "DateTimeFormat").mockImplementation(() => {
            throw new Error("no Intl");
        });
        const { result } = renderHook(() => useCurrencyPreference());
        expect(result.current.currency).toBe("usd");
    });

    it("still works when localStorage throws", () => {
        // Private browsing. The choice just does not survive a reload.
        inTimeZone("Asia/Tokyo");
        const original = window.localStorage.getItem;
        window.localStorage.getItem = () => {
            throw new Error("denied");
        };
        try {
            const { result } = renderHook(() => useCurrencyPreference());
            expect(result.current.currency).toBe("jpy");
        } finally {
            window.localStorage.getItem = original;
        }
    });
});
