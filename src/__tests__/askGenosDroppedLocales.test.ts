/**
 * The dropped-references notice (MIP-1058): `spotlight.dropped.*` in all seven locales.
 * `DeepPartial<Messages>` lets a locale ship without a key and show English; these read the raw
 * catalogs so the merge cannot hide a gap. The sentences have no placeholders, and each one names
 * Genos, so a translator cannot turn it into a statement about the member.
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
const KEYS = ["message", "messages", "selection", "selectedFrom"] as const;

describe("the dropped-references strings", () => {
    it("English has all four, each naming Genos", () => {
        for (const key of KEYS) {
            expect(en.spotlight.dropped[key].trim(), key).toBeTruthy();
            expect(en.spotlight.dropped[key], key).toContain("Genos");
        }
    });

    it("English never says 'read' (the server's word for why is not ours to say)", () => {
        for (const key of KEYS) expect(en.spotlight.dropped[key]).not.toMatch(/\bread\b/i);
    });

    it.each(Object.keys(OTHERS) as Array<keyof typeof OTHERS>)(
        "%s has all four, translated, each still naming Genos",
        (name) => {
            const dropped = (OTHERS[name].spotlight?.dropped ?? {}) as Record<
                string,
                string | undefined
            >;
            for (const key of KEYS) {
                expect(dropped[key]?.trim(), `${name}.${key}`).toBeTruthy();
                expect(dropped[key], `${name}.${key}`).not.toBe(en.spotlight.dropped[key]);
                expect(dropped[key], `${name}.${key}`).toContain("Genos");
            }
        }
    );

    it.each(Object.keys(OTHERS) as Array<keyof typeof OTHERS>)(
        "%s tells one message from several: the two sentences differ",
        (name) => {
            const dropped = (OTHERS[name].spotlight?.dropped ?? {}) as Record<
                string,
                string | undefined
            >;
            expect(dropped.message).not.toBe(dropped.messages);
        }
    );
});
