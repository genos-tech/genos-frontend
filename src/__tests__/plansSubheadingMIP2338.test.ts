/**
 * MIP-2338: the plans subheading must not claim every plan has every feature.
 * Connected AI apps (MCP), schedules and webhooks start at Core, GitHub at Pro
 * (TIER_QUOTAS in genos-api apis/settings.py). Reads the raw catalogs because a
 * locale may omit a key and quietly show English.
 */
import { describe, expect, it } from "vitest";

import { ar } from "../i18n/locales/ar";
import { en } from "../i18n/locales/en";
import { es } from "../i18n/locales/es";
import { fr } from "../i18n/locales/fr";
import { hi } from "../i18n/locales/hi";
import { ja } from "../i18n/locales/ja";
import { zh } from "../i18n/locales/zh";

type Catalog = { settings?: { planUsage?: { plansSubheading?: string } } };
const subheading = (c: unknown): string =>
    (c as Catalog).settings?.planUsage?.plansSubheading ?? "";

const ALL = { en, ja, es, fr, zh, ar, hi } as const;
const STALE = [
    "Every plan includes every feature",
    "すべてのプランで全機能",
    "所有套餐都包含全部功能",
    "Todos los planes incluyen todas las funciones",
    "Tous les forfaits incluent toutes les fonctionnalités",
    "كل الخطط تتضمن جميع الميزات",
    "हर प्लान में सभी सुविधाएँ शामिल हैं",
];

describe("plans subheading (MIP-2338)", () => {
    for (const [locale, catalog] of Object.entries(ALL)) {
        it(`${locale}: names the tiers where features start`, () => {
            const text = subheading(catalog);
            expect(text).not.toBe("");
            for (const stale of STALE) expect(text).not.toContain(stale);
            expect(text).toContain("Core");
            expect(text).toContain("Pro");
            expect(text).toContain("GitHub");
        });
    }
});
