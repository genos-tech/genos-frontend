/**
 * The AI usage line and switch chrome (`inbox.aiUsage.*`, MIP-1227) in all seven locales.
 * Non-English catalogs fall back to English for a missing key, so these read the raw catalogs.
 * The non-English text is machine-written and not native-reviewed.
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
type Key = keyof typeof en.inbox.aiUsage;
const KEYS = Object.keys(en.inbox.aiUsage) as Key[];

// The placeholders each string is filled with by the footer.
const NEEDS: Partial<Record<Key, string>> = {
    used: "{credits}",
    usedAtLeast: "{credits}",
    deducted: "{credits}",
    turnOffNamed: "{name}",
    turnBackOnNamed: "{name}",
    undoNamed: "{name}",
    offDigest: "{name}",
    offSchedule: "{name}",
    alreadyOff: "{name}",
    restingOff: "{name}",
    onAgain: "{name}",
};

describe("inbox.aiUsage", () => {
    it.each(Object.keys(CATALOGS) as Array<keyof typeof CATALOGS>)(
        "%s has every key",
        (locale) => {
            const block = CATALOGS[locale].inbox?.aiUsage as Record<string, string> | undefined;
            for (const key of KEYS) {
                expect(block?.[key], `${locale}.${key}`).toBeTruthy();
                const need = NEEDS[key];
                if (need) expect(block?.[key], `${locale}.${key}`).toContain(need);
            }
            if (locale !== "en")
                for (const key of ["turnOff", "undo", "gone", "failed"] as Key[])
                    expect(block?.[key], `${locale}.${key} is translated`).not.toBe(
                        en.inbox.aiUsage[key]
                    );
        }
    );
});
