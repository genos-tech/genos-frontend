import { useMemo } from "react";

import { useTranslation } from "../../../i18n";

/**
 * Every dashboard number goes through here (MIP-1963): grouping and decimals follow the app's
 * language, never the browser's, and the digits are always tabular where they are drawn.
 */
export type NumberFormat = {
    /** 1234 -> "1,234" (en) / "1.234" (es). */
    number: (n: number) => string;
    /** 0.42 -> "42%". Takes a ratio, not a percentage. */
    percent: (ratio: number) => string;
};

export const makeNumberFormat = (locale: string): NumberFormat => {
    const num = new Intl.NumberFormat(locale);
    const pct = new Intl.NumberFormat(locale, { style: "percent", maximumFractionDigits: 0 });
    return { number: (n) => num.format(n), percent: (r) => pct.format(r) };
};

export const useNumberFormat = (): NumberFormat => {
    const { locale } = useTranslation();
    return useMemo(() => makeNumberFormat(locale), [locale]);
};
