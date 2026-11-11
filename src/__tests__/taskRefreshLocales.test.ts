/**
 * The Refresh Tasks button's three answers, in all seven locales (MIP-1411). Reads the raw
 * catalogs, like `inboxSyncLocales.test.ts`, because the loader fills a missing key from English
 * and would hide a gap.
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
const NAMES = Object.keys(OTHERS) as Array<keyof typeof OTHERS>;
const KEYS = ["refreshed", "refreshFailed", "refreshPrsFailed"] as const;

describe("tasks.header has the refresh answers in every locale", () => {
    it("reads in English", () => {
        expect(en.tasks.header.refreshed).toBe("Tasks are up to date");
        expect(en.tasks.header.refreshFailed).toBe("Couldn't refresh the tasks. Try again.");
        expect(en.tasks.header.refreshPrsFailed).toMatch(/refreshed.*PR statuses/);
    });

    it.each(NAMES)("%s defines all three, translated, and distinct from each other", (name) => {
        const header = OTHERS[name].tasks?.header as Record<string, string> | undefined;
        const seen = new Set<string>();
        for (const key of KEYS) {
            const text = header?.[key];
            expect(text, `${name} tasks.header.${key}`).toBeTruthy();
            expect(text, `${name} ${key} is still English`).not.toBe(en.tasks.header[key]);
            seen.add(text as string);
        }
        expect(seen.size).toBe(KEYS.length);
    });

    it.each(NAMES)("%s keeps the PR abbreviation in the partial-failure message", (name) => {
        // Every locale writes PR (not a long form) in running text, like linkedPr.header.
        const text = (OTHERS[name].tasks?.header as Record<string, string>).refreshPrsFailed;
        expect(text).toContain("PR");
    });
});
