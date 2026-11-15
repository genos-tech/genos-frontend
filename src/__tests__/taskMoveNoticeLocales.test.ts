/**
 * The two move-notice sentences (`tasks.moveNotice`, MIP-1597) in all seven locales.
 *
 * A locale may ship a partial catalog and the loader merges missing keys from
 * English, so a forgotten key type-checks and shows English in a Japanese
 * toast. These read the raw catalogs so that merge cannot hide a gap, and
 * render each sentence for one and for several people.
 */
import { describe, expect, it } from "vitest";

import { fmt } from "../i18n";
import { ar } from "../i18n/locales/ar";
import { en } from "../i18n/locales/en";
import { es } from "../i18n/locales/es";
import { fr } from "../i18n/locales/fr";
import { hi } from "../i18n/locales/hi";
import { ja } from "../i18n/locales/ja";
import { zh } from "../i18n/locales/zh";

const OTHERS = { ja, es, fr, zh, ar, hi } as const;
const KEYS = ["notesNarrowed", "reportersOutsideDestination"] as const;

type Catalog = { tasks?: { moveNotice?: Record<string, string> } };
const notice = (catalog: unknown) => (catalog as Catalog).tasks?.moveNotice;

describe("tasks.moveNotice", () => {
    it.each(Object.entries({ en, ...OTHERS }))("%s has both sentences", (_name, catalog) => {
        for (const key of KEYS) {
            expect(typeof notice(catalog)?.[key]).toBe("string");
            expect(notice(catalog)![key].length).toBeGreaterThan(10);
        }
    });

    it.each(Object.entries(OTHERS))(
        "%s is translated, not copied from English",
        (_name, catalog) => {
            for (const key of KEYS) expect(notice(catalog)![key]).not.toBe(notice(en)![key]);
        }
    );

    it.each(Object.entries({ en, ...OTHERS }))(
        "%s renders the count and leaves no placeholder behind",
        (_name, catalog) => {
            for (const key of KEYS) {
                for (const count of [1, 3]) {
                    const text = fmt(notice(catalog)![key], { count });
                    expect(text).toContain(String(count));
                    expect(text).not.toMatch(/[{}#]|plural/);
                }
            }
        }
    );
});
