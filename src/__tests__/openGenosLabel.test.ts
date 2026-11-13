/**
 * MIP-1404: the floating button's label says "Open Genos" as a verb in every
 * locale. Arabic had "مفتوح Genos" (the adjective "open", as in "an open door"),
 * so a screen reader announced a status instead of an action.
 */
import { describe, expect, it } from "vitest";

import { ar } from "../i18n/locales/ar";
import { en } from "../i18n/locales/en";
import { es } from "../i18n/locales/es";
import { fr } from "../i18n/locales/fr";
import { hi } from "../i18n/locales/hi";
import { ja } from "../i18n/locales/ja";
import { zh } from "../i18n/locales/zh";

type Catalog = { layout?: { mobile?: { openGenos?: string } } };
const label = (c: unknown) => (c as Catalog).layout?.mobile?.openGenos;

describe("layout.mobile.openGenos", () => {
    it.each([
        ["en", en, "Open Genos"],
        ["ja", ja, "Genosを開く"],
        ["zh", zh, "打开Genos"],
        ["es", es, "Abrir Genos"],
        ["fr", fr, "Ouvrir Genos"],
        ["hi", hi, "Genos खोलें"],
        // The verb "to open", matching the other "open ..." actions in `ar`
        // (`فتح ملفي الشخصي`, `فتح صندوق الوارد`).
        ["ar", ar, "فتح Genos"],
    ])("%s reads as the action", (_locale, catalog, expected) => {
        expect(label(catalog)).toBe(expected);
    });
});
