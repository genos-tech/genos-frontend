// MIP-2459: "{remaining} of {limit} left" was translated as "left side" or "departed" in five locales.
import { describe, expect, it } from "vitest";

import { ar } from "../i18n/locales/ar";
import { en } from "../i18n/locales/en";
import { es } from "../i18n/locales/es";
import { fr } from "../i18n/locales/fr";
import { hi } from "../i18n/locales/hi";
import { ja } from "../i18n/locales/ja";
import { zh } from "../i18n/locales/zh";

const read = (locale: { settings?: { planUsage?: Record<string, unknown> } }) => {
    const p = locale.settings?.planUsage ?? {};
    return String(p.quotaRemaining)
        .replace("{remaining}", "7")
        .replace("{limit}", "50")
        .replace("{window}", String(p.monthSuffix));
};

describe("the plan usage row says how much remains", () => {
    it.each([
        ["en", en, "7 of 50 left this month"],
        ["ja", ja, "残り 7 / 50（今月）"],
        ["zh", zh, "剩余 7 / 50（本月）"],
        ["fr", fr, "Restant : 7 sur 50 ce mois-ci"],
        ["es", es, "Restante: 7 de 50 este mes"],
        ["hi", hi, "इस महीने 50 में से 7 बाकी"],
        ["ar", ar, "متبقٍ 7 من أصل 50 هذا الشهر"],
    ])("%s", (_name, locale, expected) => {
        expect(read(locale as Parameters<typeof read>[0])).toBe(expected);
    });
});
