// Which currency a visitor sees prices in.
//
// Two different questions live here, and conflating them is the mistake
// to avoid:
//
//   * DISPLAY currency — what the pricing page quotes. Free to infer,
//     free to change, and the visitor may flip it as often as they like.
//     That is this hook.
//   * BILLING currency — what Stripe actually charges. Fixed at
//     checkout, and Stripe CANNOT change it afterwards. An existing
//     subscriber's real currency is read off their subscription, never
//     from this preference. See genos-docs/operations/CURRENCY.md.
//
// So a subscriber toggling this changes what the comparison table
// quotes and nothing about their bill.

import { useCallback, useEffect, useState } from "react";

const STORAGE_KEY = "genos.currency";

/**
 * IANA time zones that indicate a market we price separately.
 * Everything not listed falls through to `DEFAULT_CURRENCY`.
 *
 * Japan has exactly one zone, which is what makes this precise for the
 * question actually being asked ("is this person in Japan?"). Adding a
 * market later is a line here plus its Stripe prices — and the server
 * ignores a currency it has no prices for, so a half-added market
 * degrades to the default rather than breaking checkout.
 */
const ZONE_CURRENCY: Record<string, string> = {
    "Asia/Tokyo": "jpy",
};

const DEFAULT_CURRENCY = "usd";

/**
 * The currency for a time zone.
 *
 * **Geography, not language.** This used to derive from LOCALE, which
 * was wrong for currency specifically: plenty of people in Japan run
 * their tools in English, and they were being shown dollars for a
 * product they would be billed in yen. Language is what someone chose
 * to READ in; currency is about which market they are buying in, and
 * that is a question about where they are.
 *
 * Time zone rather than the Geolocation API or a server-side IP lookup:
 * it needs no permission prompt (a pricing page asking for your
 * location is its own problem), no network call, and no GeoIP
 * dependency. `Intl` is already there.
 *
 * Its limits, stated rather than discovered: a traveller and a VPN user
 * get their apparent location. Both are exactly the "where am I" answer
 * this is asking for, both are display-only, and both are one click
 * from corrected — which is why the picker matters more than the guess.
 */
export const currencyForTimeZone = (timeZone: string): string =>
    ZONE_CURRENCY[timeZone] ?? DEFAULT_CURRENCY;

/** The browser's IANA zone, or "" when unavailable. Never throws. */
export const detectTimeZone = (): string => {
    try {
        return Intl.DateTimeFormat().resolvedOptions().timeZone || "";
    } catch {
        return "";
    }
};

export interface CurrencyPreference {
    /** The currency to request prices in. */
    currency: string;
    /** Explicit user choice; clears back to the detected one. */
    setCurrency: (code: string | null) => void;
    /** True once the visitor has picked, so we stop inferring. */
    isExplicit: boolean;
}

/**
 * `currency` is inferred from the browser's time zone until the visitor
 * picks one, then stays put.
 *
 * The server is the backstop: it ignores a currency it has no prices
 * for and answers in its default, so a detected currency we cannot
 * actually sell in degrades quietly instead of producing a dead
 * checkout.
 */
export const useCurrencyPreference = (): CurrencyPreference => {
    const [explicit, setExplicit] = useState<string | null>(() => {
        try {
            return window.localStorage.getItem(STORAGE_KEY);
        } catch {
            // Private mode / storage disabled. Infer every time.
            return null;
        }
    });

    useEffect(() => {
        try {
            if (explicit) window.localStorage.setItem(STORAGE_KEY, explicit);
            else window.localStorage.removeItem(STORAGE_KEY);
        } catch {
            // Nothing to do — the choice just won't survive a reload.
        }
    }, [explicit]);

    const setCurrency = useCallback((code: string | null) => {
        setExplicit(code ? code.toLowerCase() : null);
    }, []);

    return {
        currency: explicit || currencyForTimeZone(detectTimeZone()),
        setCurrency,
        isExplicit: Boolean(explicit),
    };
};
