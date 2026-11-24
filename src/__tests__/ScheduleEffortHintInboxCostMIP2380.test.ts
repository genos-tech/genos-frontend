/**
 * The AI effort hints in the schedule form (MIP-2380): a report posted to a chat never shows its
 * cost (genos-api #1262); the owner sees the real cost in their Inbox. The hints must not say the
 * figure is shown on each report.
 */
import { describe, expect, it } from "vitest";

import { ar } from "../i18n/locales/ar";
import { settings as en } from "../i18n/locales/en/settings";
import { es } from "../i18n/locales/es";
import { fr } from "../i18n/locales/fr";
import { hi } from "../i18n/locales/hi";
import { ja } from "../i18n/locales/ja";
import { zh } from "../i18n/locales/zh";

type Hints = { effortHint?: string; effortHintNoEstimate?: string };

const hintsOf = (messages: unknown): Hints =>
    (messages as { settings?: { schedules?: Hints } }).settings?.schedules ?? {};

const locales: Record<string, Hints> = {
    en: en.schedules,
    ar: hintsOf(ar),
    es: hintsOf(es),
    fr: hintsOf(fr),
    hi: hintsOf(hi),
    ja: hintsOf(ja),
    zh: hintsOf(zh),
};

describe("effort hints", () => {
    it("says in English that the real cost is shown to you in your Inbox", () => {
        for (const text of [en.schedules.effortHint, en.schedules.effortHintNoEstimate]) {
            expect(text).toMatch(/real cost is shown only to you, in your Inbox/);
            expect(text).not.toMatch(/on each report/);
        }
    });

    it("changed the sentence in all 7 locales", () => {
        const old = [
            "on each report",
            "en cada informe",
            "sur chaque rapport",
            "各レポートに",
            "每份报告上",
            "हर रिपोर्ट पर",
            "في كل تقرير",
        ];
        for (const [code, hints] of Object.entries(locales)) {
            for (const text of [hints.effortHint, hints.effortHintNoEstimate]) {
                expect(text, code).toBeTruthy();
                for (const o of old) expect(text, code).not.toContain(o);
            }
        }
    });
});
