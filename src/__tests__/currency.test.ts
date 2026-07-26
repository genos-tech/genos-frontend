/**
 * Price formatting, shared by the in-app and marketing plans pages.
 *
 * There used to be two copies of this, each with its own three-entry
 * zero-decimal list. That matters more than duplication usually does:
 * a currency missing from the list renders **100x too small** — "¥12"
 * for a ¥1,200 plan — and it only shows up in the market you have just
 * launched in.
 */

import { describe, expect, it } from "vitest";

import { formatPrice, ZERO_DECIMAL_CURRENCIES } from "../utils/currency";

describe("formatPrice", () => {
    it("renders a zero-decimal currency whole", () => {
        // Stripe stores ¥1,200 as 1200, not 120000.
        expect(formatPrice({ amount: 1200, currency: "jpy" }, "ja")).toBe("￥1,200");
    });

    it("renders a minor-unit currency with its decimals", () => {
        expect(formatPrice({ amount: 900, currency: "usd" }, "en")).toBe("$9.00");
    });

    it("does not divide a zero-decimal amount by 100", () => {
        // The bug this guards: ¥1,200 shown as ¥12.
        const rendered = formatPrice({ amount: 1200, currency: "jpy" }, "ja") ?? "";
        expect(rendered).toContain("1,200");
        expect(rendered).not.toContain("12.00");
    });

    it("handles every currency in the zero-decimal set", () => {
        for (const code of ZERO_DECIMAL_CURRENCIES) {
            const rendered = formatPrice({ amount: 1000, currency: code }, "en") ?? "";
            expect(rendered, `${code} should render 1,000 whole`).toContain("1,000");
        }
    });

    it("keeps the Stripe zero-decimal list complete for the majors", () => {
        for (const code of ["jpy", "krw", "vnd", "clp", "xaf"]) {
            expect(ZERO_DECIMAL_CURRENCIES.has(code)).toBe(true);
        }
        for (const code of ["usd", "eur", "gbp", "aud", "cad"]) {
            expect(ZERO_DECIMAL_CURRENCIES.has(code)).toBe(false);
        }
    });

    it("returns null when there is no amount", () => {
        // Callers render the plan without a price line, not "null/month".
        expect(formatPrice({ amount: null, currency: "usd" }, "en")).toBeNull();
    });

    it("lets Intl handle a well-formed but unknown currency code", () => {
        // Intl does not throw on an unassigned ISO-shaped code — it
        // prints the code as the symbol, which is already the sensible
        // answer, so the catch below is genuinely a last resort.
        //
        // Matched loosely on purpose: Intl separates the code from the
        // number with a NON-BREAKING space, and which whitespace ICU
        // picks is not a contract worth pinning a test to.
        const rendered = formatPrice({ amount: 500, currency: "zzz" }, "en") ?? "";
        expect(rendered).toContain("ZZZ");
        expect(rendered).toContain("5.00");
    });

    it("falls back to number + code when Intl rejects the code outright", () => {
        // Intl requires a 3-letter code and throws otherwise. Showing
        // the number is better than letting the price line disappear.
        expect(formatPrice({ amount: 500, currency: "notacode" }, "en")).toBe("5 NOTACODE");
    });

    it("formats free as zero in the currency it was quoted in", () => {
        // The server sends the REQUESTED currency for the free tier now;
        // it used to hardcode jpy, so a dollar visitor was shown "¥0".
        expect(formatPrice({ amount: 0, currency: "usd" }, "en")).toBe("$0.00");
        expect(formatPrice({ amount: 0, currency: "jpy" }, "ja")).toBe("￥0");
    });

    it("respects the viewer's locale for grouping", () => {
        const en = formatPrice({ amount: 123456, currency: "usd" }, "en-US");
        const de = formatPrice({ amount: 123456, currency: "usd" }, "de-DE");
        expect(en).not.toBe(de);
        expect(en).toContain("1,234.56");
    });
});
