/**
 * The Inbox Sync button's words and the "Report ready" toast, in all seven
 * locales (MIP-1233). Reads the raw catalogs, like `schedulesLocales.test.ts`,
 * because the loader fills a missing key from English and would hide a gap.
 */
import { describe, expect, it } from "vitest";

import { fmt } from "../i18n/interpolate";
import { ar } from "../i18n/locales/ar";
import { en } from "../i18n/locales/en";
import { es } from "../i18n/locales/es";
import { fr } from "../i18n/locales/fr";
import { hi } from "../i18n/locales/hi";
import { ja } from "../i18n/locales/ja";
import { zh } from "../i18n/locales/zh";

const OTHERS = { ja, es, fr, zh, ar, hi } as const;
const NAMES = Object.keys(OTHERS) as Array<keyof typeof OTHERS>;

const SYNC = ["label", "upToDate", "added", "failed"] as const;
const RUN = ["reportReady", "reportReadyTitled", "openInbox", "planRefused"] as const;

describe("inbox.sync and the run-now toast have every string in every locale", () => {
    it.each(NAMES)("%s defines them, translated, with the placeholders kept", (name) => {
        const sync = OTHERS[name].inbox?.sync as Record<string, string> | undefined;
        const run = OTHERS[name].settings?.schedules as Record<string, string> | undefined;
        for (const key of SYNC) {
            expect(sync?.[key], `${name} inbox.sync.${key}`).toBeTruthy();
            expect(sync?.[key]).not.toBe(en.inbox.sync[key]);
        }
        for (const key of RUN) {
            expect(run?.[key], `${name} schedules.${key}`).toBeTruthy();
            expect(run?.[key]).not.toBe(en.settings.schedules[key]);
        }
        expect(sync?.added).toContain("{count");
        expect(run?.reportReadyTitled).toContain("{title}");
    });

    it("reads in English with its numbers filled in", () => {
        expect(fmt(en.inbox.sync.added, { count: 1 })).toBe("1 new item");
        expect(fmt(en.inbox.sync.added, { count: 3 })).toBe("3 new items");
        expect(fmt(en.settings.schedules.reportReadyTitled, { title: "Morning plan" })).toBe(
            "Report ready: Morning plan"
        );
    });

    it.each(NAMES)("%s fills the count and the title", (name) => {
        const sync = OTHERS[name].inbox?.sync as Record<string, string>;
        const run = OTHERS[name].settings?.schedules as Record<string, string>;
        expect(fmt(sync.added, { count: 3 })).toContain("3");
        expect(fmt(run.reportReadyTitled, { title: "Morning plan" })).toContain("Morning plan");
    });
});
