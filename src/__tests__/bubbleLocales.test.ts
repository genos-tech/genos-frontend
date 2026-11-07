/**
 * MIP-1130: the "Edited" word on a message or comment's meta line was hardcoded
 * English. It is now `chat.bubble.edited`, translated in all seven locales.
 * `DeepPartial<Messages>` lets a locale omit a key and quietly show English,
 * so this reads the raw catalogs.
 */
import { describe, expect, it } from "vitest";

import { ar } from "../i18n/locales/ar";
import { en } from "../i18n/locales/en";
import { es } from "../i18n/locales/es";
import { fr } from "../i18n/locales/fr";
import { hi } from "../i18n/locales/hi";
import { ja } from "../i18n/locales/ja";
import { zh } from "../i18n/locales/zh";

type Catalog = { chat?: { bubble?: Record<string, string> } };
const edited = (c: unknown) => (c as Catalog).chat?.bubble?.edited;

describe("chat.bubble.edited", () => {
    it("English says Edited", () => expect(edited(en)).toBe("Edited"));
    for (const [name, catalog] of Object.entries({ ja, zh, es, fr, hi, ar })) {
        it(`${name} has it, translated`, () => {
            expect(edited(catalog), name).toBeTruthy();
            expect(edited(catalog), `${name} is the English text`).not.toBe("Edited");
        });
    }
});
