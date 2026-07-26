// Which currency a visitor sees prices in.
//
// Two different questions live here, and conflating them is the mistake
// to avoid:
//
//   * DISPLAY currency — what the pricing page quotes. Free to guess at,
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
 * The default currency for a locale.
 *
 * Derived from LOCALE, not from IP. Locale is something the user chose;
 * an IP is something that happens to them, and geo-guessing shows a
 * travelling customer prices in the wrong currency at the exact moment
 * they are deciding whether to pay.
 *
 * Japanese readers get yen because that is the market Genos sells in
 * today and its prices there are set in yen. Everyone else gets USD,
 * which is the currency most of the world can read a SaaS price in —
 * a US visitor reading "¥2,500" has to do arithmetic before they can
 * judge the offer, and that is friction at the worst possible moment.
 */
export const defaultCurrencyForLocale = (locale: string): string =>
    locale.toLowerCase().startsWith("ja") ? "jpy" : "usd";

export interface CurrencyPreference {
    /** The currency to request prices in. */
    currency: string;
    /** Explicit user choice; clears back to the locale default. */
    setCurrency: (code: string | null) => void;
    /** True once the visitor has picked, so we stop following locale. */
    isExplicit: boolean;
}

/**
 * `currency` follows the locale until the visitor picks one, then stays
 * put — switching UI language should not silently re-quote the prices
 * of someone who deliberately chose a currency.
 */
export const useCurrencyPreference = (locale: string): CurrencyPreference => {
    const [explicit, setExplicit] = useState<string | null>(() => {
        try {
            return window.localStorage.getItem(STORAGE_KEY);
        } catch {
            // Private mode / storage disabled. Follow the locale.
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
        currency: explicit || defaultCurrencyForLocale(locale),
        setCurrency,
        isExplicit: Boolean(explicit),
    };
};
