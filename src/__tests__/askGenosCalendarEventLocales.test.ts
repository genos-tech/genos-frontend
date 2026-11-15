/**
 * "Ask Genos about this event" (MIP-1059): the button label and the stand-in title for an untitled
 * event, in all seven locales. `DeepPartial<Messages>` lets a locale ship without a key and show
 * English; these read the raw catalogs so the merge cannot hide a gap.
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
const KEYS = ["askGenos", "askGenosUntitled"] as const;

describe("the calendar Ask Genos strings", () => {
    it("English has both, and the button names Genos", () => {
        for (const key of KEYS) expect(en.calendar.event[key].trim()).toBeTruthy();
        expect(en.calendar.event.askGenos).toContain("Genos");
    });

    it.each(Object.keys(OTHERS) as Array<keyof typeof OTHERS>)(
        "%s has both, translated, and the button still names Genos",
        (name) => {
            const event = (OTHERS[name].calendar?.event ?? {}) as Record<
                string,
                string | undefined
            >;
            for (const key of KEYS) {
                expect(event[key]?.trim(), `${name}.${key}`).toBeTruthy();
                expect(event[key], `${name}.${key}`).not.toBe(en.calendar.event[key]);
            }
            expect(event.askGenos).toContain("Genos");
        }
    );
});
