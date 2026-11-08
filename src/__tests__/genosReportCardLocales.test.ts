/**
 * The rich report card's own chrome (`inbox.report.*`, MIP-1208) in all seven locales.
 * Non-English catalogs are `DeepPartial<Messages>` and fall back to English, so a locale that
 * forgot a key type-checks and quietly shows English. These read the raw catalogs.
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
const KEYS = Object.keys(en.inbox.report) as Array<keyof typeof en.inbox.report>;

describe("inbox.report", () => {
    it("has the keys the card reads", () => {
        expect(KEYS.sort()).toEqual(
            [
                "daysLate",
                "emptyBody",
                "emptyTitle",
                "showLess",
                "showMore",
                "statComments",
                "statItems",
            ].sort()
        );
    });

    it.each(Object.keys(CATALOGS) as Array<keyof typeof CATALOGS>)(
        "%s has every key",
        (locale) => {
            const block = CATALOGS[locale].inbox?.report as Record<string, string> | undefined;
            for (const key of KEYS) {
                expect(block?.[key], `${locale}.${key}`).toBeTruthy();
            }
            // The placeholders the card fills in.
            expect(block?.showMore).toContain("{count}");
            expect(block?.daysLate).toContain("{days}");
            if (locale === "ar")
                for (const key of KEYS) expect(block?.[key]).not.toBe(en.inbox.report[key]);
        }
    );
});
