/**
 * MIP-1301: the confirm strings added for the "Deleted" status pick, API key revoke,
 * webhook delete and Google/GitHub disconnect exist in all seven locales.
 *
 * `DeepPartial<Messages>` lets a locale ship incrementally and the loader fills a
 * missing key with English, so a locale that forgot one still type-checks. These read
 * the raw catalogs. Arabic also keeps its glossary words: revoke is إبطال, delete is
 * حذف, disconnect is قطع الاتصال (`locales/GLOSSARY.md`).
 */
import { describe, expect, it } from "vitest";

import { ar } from "../i18n/locales/ar";
import { en } from "../i18n/locales/en";
import { es } from "../i18n/locales/es";
import { fr } from "../i18n/locales/fr";
import { hi } from "../i18n/locales/hi";
import { ja } from "../i18n/locales/ja";
import { zh } from "../i18n/locales/zh";

const OTHERS = { ja, es, fr, zh, ar, hi } as const;

type Catalog = {
    tasks?: { modals?: { confirmDeletedStatus?: Record<string, string> } };
    settings?: {
        developer?: {
            keys?: { revokeDialog?: Record<string, string> };
            webhooks?: { deleteNamed?: string; deleteDialog?: Record<string, string> };
        };
    };
    integrations?: { connections?: { disconnectDialog?: Record<string, string> } };
};

const strings = (c: Catalog) => ({
    "status.title": c.tasks?.modals?.confirmDeletedStatus?.title,
    "status.titleMilestone": c.tasks?.modals?.confirmDeletedStatus?.titleMilestone,
    "status.body": c.tasks?.modals?.confirmDeletedStatus?.body,
    "status.bodyMilestone": c.tasks?.modals?.confirmDeletedStatus?.bodyMilestone,
    "key.title": c.settings?.developer?.keys?.revokeDialog?.title,
    "key.body": c.settings?.developer?.keys?.revokeDialog?.body,
    "key.bodyTeam": c.settings?.developer?.keys?.revokeDialog?.bodyTeam,
    "key.confirm": c.settings?.developer?.keys?.revokeDialog?.confirm,
    "hook.deleteNamed": c.settings?.developer?.webhooks?.deleteNamed,
    "hook.title": c.settings?.developer?.webhooks?.deleteDialog?.title,
    "hook.body": c.settings?.developer?.webhooks?.deleteDialog?.body,
    "hook.confirm": c.settings?.developer?.webhooks?.deleteDialog?.confirm,
    "disconnect.title": c.integrations?.connections?.disconnectDialog?.title,
    "disconnect.bodyGoogle": c.integrations?.connections?.disconnectDialog?.bodyGoogle,
    "disconnect.bodyGithub": c.integrations?.connections?.disconnectDialog?.bodyGithub,
});
const TITLES = [
    "status.title",
    "status.titleMilestone",
    "key.title",
    "hook.title",
    "disconnect.title",
];
const BODIES = [
    "status.body",
    "status.bodyMilestone",
    "key.body",
    "key.bodyTeam",
    "hook.body",
    "disconnect.bodyGoogle",
    "disconnect.bodyGithub",
];

describe("destructive-confirm strings", () => {
    it("English has all fifteen", () => {
        for (const [key, value] of Object.entries(strings(en as Catalog))) {
            expect(value, key).toBeTruthy();
        }
    });

    for (const [name, catalog] of Object.entries(OTHERS)) {
        it(`${name} has all fifteen, translated (not the English)`, () => {
            const english = strings(en as Catalog) as Record<string, string | undefined>;
            for (const [key, value] of Object.entries(strings(catalog as Catalog))) {
                expect(value, `${name}.${key}`).toBeTruthy();
                expect(value, `${name}.${key} is the English text`).not.toBe(english[key]);
            }
        });
    }

    it("every title is a question and every body is statements, in every locale", () => {
        for (const catalog of [en, ...Object.values(OTHERS)]) {
            const s = strings(catalog as Catalog) as Record<string, string>;
            for (const k of TITLES) expect(s[k], k).toMatch(/[?？؟]$/);
            for (const k of BODIES) {
                expect(s[k], k).not.toMatch(/[?？؟]/);
                expect(s[k].length, k).toBeGreaterThan(8);
            }
        }
    });

    it("keeps the placeholders every call site fills", () => {
        for (const catalog of [en, ...Object.values(OTHERS)]) {
            const s = strings(catalog as Catalog) as Record<string, string>;
            expect(s["hook.deleteNamed"]).toContain("{name}");
            expect(s["disconnect.title"]).toContain("{provider}");
            for (const k of Object.keys(s)) {
                if (k === "hook.deleteNamed" || k === "disconnect.title") continue;
                expect(s[k], k).not.toMatch(/[{}]/);
            }
        }
    });

    it("Arabic uses the glossary words", () => {
        const s = strings(ar as Catalog) as Record<string, string>;
        expect(s["key.title"]).toContain("إبطال");
        expect(s["key.confirm"]).toContain("إبطال");
        expect(s["hook.deleteNamed"]).toContain("حذف");
        expect(s["hook.confirm"]).toContain("حذف");
        expect(s["status.title"]).toContain("حذف");
        expect(s["disconnect.title"]).toContain("قطع الاتصال");
        // Retired words for these actions.
        for (const v of Object.values(s)) expect(v).not.toMatch(/يمسح|مسح|تمحو|محو/);
    });
});
