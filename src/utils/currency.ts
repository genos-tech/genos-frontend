// Money formatting for customer-facing prices.
//
// One implementation, because there were two: `PlansHome` (in-app) and
// `PlansPage` (marketing) each carried their own copy, and each carried
// its own three-entry zero-decimal list. A currency missing from that
// list renders 100x too small — "¥12" for a ¥1,200 plan — which is the
// kind of bug that only shows up in the market you just launched in.

/**
 * Currencies with no minor unit. Stripe stores these amounts whole:
 * ¥1,200 arrives as `1200`, not `120000`.
 *
 * Mirrors Stripe's list, and the same set on the server in
 * `origin/search_engine/money.py`. The two are kept in step because
 * they answer the same question about the same number.
 */
export const ZERO_DECIMAL_CURRENCIES = new Set([
    "bif",
    "clp",
    "djf",
    "gnf",
    "jpy",
    "kmf",
    "krw",
    "mga",
    "pyg",
    "rwf",
    "ugx",
    "vnd",
    "vuv",
    "xaf",
    "xof",
    "xpf",
]);

export interface FormattablePrice {
    /** Stripe's smallest-unit amount. Null when there is no price. */
    amount: number | null;
    currency: string;
}

/**
 * A price as a customer should read it, in their locale.
 *
 * `Intl.NumberFormat` places the symbol, groups the digits and handles
 * right-to-left far better than any symbol table we would write — which
 * is why the fallback below is a last resort for an unknown currency
 * code rather than the main path.
 *
 * Returns null when there is no amount, so callers render the plan
 * without a price line instead of "null/month".
 */
export const formatPrice = (price: FormattablePrice, locale: string): string | null => {
    if (price.amount == null) return null;
    const zeroDecimal = ZERO_DECIMAL_CURRENCIES.has(price.currency.toLowerCase());
    const divisor = zeroDecimal ? 1 : 100;
    try {
        return new Intl.NumberFormat(locale, {
            style: "currency",
            currency: price.currency.toUpperCase(),
            maximumFractionDigits: zeroDecimal ? 0 : 2,
        }).format(price.amount / divisor);
    } catch {
        // An unrecognised ISO code. Show the number and the code rather
        // than nothing — wrong-looking beats a blank price.
        return `${price.amount / divisor} ${price.currency.toUpperCase()}`;
    }
};

/** Uppercase ISO code for a currency picker label. */
export const currencyLabel = (code: string): string => code.toUpperCase();
