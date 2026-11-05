/**
 * MIP-1044: the switcher's To-Do tile label exists in all seven locales.
 *
 * `DeepPartial<Messages>` lets a locale omit a key and quietly show English, so
 * these read the raw catalogs. The label is the SAME word each locale already
 * uses on the sidebar's To-Do button, so the two never disagree (Japanese keeps
 * "To-Do", as its sidebar does).
 */
import { describe, expect, it } from "vitest";

import { ar } from "../i18n/locales/ar";
import { en } from "../i18n/locales/en";
import { es } from "../i18n/locales/es";
import { fr } from "../i18n/locales/fr";
import { hi } from "../i18n/locales/hi";
import { ja } from "../i18n/locales/ja";
import { zh } from "../i18n/locales/zh";

type Catalog = {
    layout?: { serviceSwitcher?: { todo?: string } };
    sidebar?: { actions?: { todo?: string } };
};
const ALL = { en, ja, es, fr, zh, ar, hi } as const;

describe("serviceSwitcher.todo", () => {
    for (const [name, catalog] of Object.entries(ALL)) {
        it(`${name}: present, and the same word as the sidebar's To-Do button`, () => {
            const c = catalog as Catalog;
            expect(
                c.layout?.serviceSwitcher?.todo,
                `${name}.layout.serviceSwitcher.todo`
            ).toBeTruthy();
            expect(c.layout?.serviceSwitcher?.todo).toBe(c.sidebar?.actions?.todo);
        });
    }
});
