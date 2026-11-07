/**
 * The "Genos report" chip label (inbox item_type 10, MIP-1149) in all seven locales.
 * Non-English catalogs are `DeepPartial<Messages>` and fall back to English, so a locale
 * that forgot the key type-checks and quietly shows English. These read the raw catalogs.
 */
import { describe, expect, it } from "vitest";

import { ar } from "../i18n/locales/ar";
import { en } from "../i18n/locales/en";
import { es } from "../i18n/locales/es";
import { fr } from "../i18n/locales/fr";
import { hi } from "../i18n/locales/hi";
import { ja } from "../i18n/locales/ja";
import { zh } from "../i18n/locales/zh";

const CATALOGS = { en, ja, es, fr, zh, ar, hi } as const;

describe("inbox.requestTypes.genosReport", () => {
    it.each(Object.keys(CATALOGS) as Array<keyof typeof CATALOGS>)(
        "%s has its own label",
        (locale) => {
            const label = CATALOGS[locale].inbox?.requestTypes?.genosReport;
            expect(label).toBeTruthy();
            expect(label).toContain("Genos");
            if (locale !== "en") expect(label).not.toBe(en.inbox.requestTypes.genosReport);
        }
    );
});
