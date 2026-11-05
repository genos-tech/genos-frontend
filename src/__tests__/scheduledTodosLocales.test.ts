/**
 * MIP-1047: the scheduled-to-do edit and delete strings exist in all seven
 * locales, translated. `DeepPartial<Messages>` lets a locale omit a key and
 * quietly show English, so these read the raw catalogs.
 */
import { describe, expect, it } from "vitest";

import { ar } from "../i18n/locales/ar";
import { en } from "../i18n/locales/en";
import { es } from "../i18n/locales/es";
import { fr } from "../i18n/locales/fr";
import { hi } from "../i18n/locales/hi";
import { ja } from "../i18n/locales/ja";
import { zh } from "../i18n/locales/zh";

type Catalog = { chat?: { todoPane?: { schedule?: Record<string, string> } } };
const KEYS = ["edit", "editHeading", "save", "deleteTitle", "deleteBody"] as const;
const OTHERS = { ja, es, fr, zh, ar, hi } as const;
const schedule = (c: unknown) => (c as Catalog).chat?.todoPane?.schedule ?? {};

describe("scheduled todos: edit and delete strings", () => {
    it("English has all five", () => {
        for (const k of KEYS) expect(schedule(en)[k], k).toBeTruthy();
    });

    for (const [name, catalog] of Object.entries(OTHERS)) {
        it(`${name} has all five, translated (not the English)`, () => {
            for (const k of KEYS) {
                expect(schedule(catalog)[k], `${name}.${k}`).toBeTruthy();
                expect(schedule(catalog)[k], `${name}.${k} is the English text`).not.toBe(
                    schedule(en)[k]
                );
            }
        });
    }

    it("the delete title is a question and the body is not, in every locale", () => {
        for (const catalog of [en, ...Object.values(OTHERS)]) {
            expect(schedule(catalog).deleteTitle).toMatch(/[?？؟]$/);
            expect(schedule(catalog).deleteBody).not.toMatch(/[?？؟]/);
        }
    });

    it("the one-line browser-confirm sentence is gone from every locale", () => {
        for (const catalog of [en, ...Object.values(OTHERS)]) {
            expect(schedule(catalog)).not.toHaveProperty("deleteConfirm");
        }
    });
});
