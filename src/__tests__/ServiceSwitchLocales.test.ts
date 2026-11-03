/**
 * "Loading data…", the service-switch page's caption (MIP-965), in all seven
 * locales. Non-English catalogs are `DeepPartial<Messages>` and fall back to
 * English, so a locale that forgot the key type-checks and quietly shows an
 * English caption. These read the raw catalogs so that can't hide.
 */
import { describe, expect, it } from "vitest";

import { ar } from "../i18n/locales/ar";
import { en } from "../i18n/locales/en";
import { es } from "../i18n/locales/es";
import { fr } from "../i18n/locales/fr";
import { hi } from "../i18n/locales/hi";
import { ja } from "../i18n/locales/ja";
import { zh } from "../i18n/locales/zh";

const EXPECTED = {
    en: "Loading data…",
    ja: "データを読み込み中…",
    es: "Cargando datos…",
    fr: "Chargement des données…",
    zh: "正在加载数据…",
    ar: "جارٍ تحميل البيانات…",
    hi: "डेटा लोड हो रहा है…",
} as const;

const CATALOGS = { en, ja, es, fr, zh, ar, hi } as const;

describe("app.serviceSwitch.loading", () => {
    it.each(Object.keys(EXPECTED) as Array<keyof typeof EXPECTED>)(
        "%s has its own caption",
        (locale) => {
            expect(CATALOGS[locale].app?.serviceSwitch?.loading).toBe(EXPECTED[locale]);
        }
    );

    it("every locale ends the caption with the ellipsis character, like the task loader", () => {
        for (const text of Object.values(EXPECTED)) expect(text.endsWith("…")).toBe(true);
    });
});
