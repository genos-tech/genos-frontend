/**
 * Customize Task Fields copy matches the permission (MIP-2318).
 *
 * The API (`ProjectTaskFieldRulesView.put`, `can_manage`) lets the project owner OR an editor
 * change the rules, so neither the description nor the save-failed text may say "owner only".
 * Each locale must name the editors next to the owner.
 */
import { describe, expect, it } from "vitest";

import { ar } from "../i18n/locales/ar";
import { en } from "../i18n/locales/en";
import { es } from "../i18n/locales/es";
import { fr } from "../i18n/locales/fr";
import { hi } from "../i18n/locales/hi";
import { ja } from "../i18n/locales/ja";
import { zh } from "../i18n/locales/zh";

// The word each language uses for "editors"; both strings must carry it.
const EDITORS = {
    en: { catalog: en, word: "editors" },
    ar: { catalog: ar, word: "والمحررين" },
    es: { catalog: es, word: "los editores" },
    fr: { catalog: fr, word: "les éditeurs" },
    hi: { catalog: hi, word: "संपादक" },
    ja: { catalog: ja, word: "編集者" },
    zh: { catalog: zh, word: "编辑者" },
} as const;

describe("Customize Task Fields wording (MIP-2318)", () => {
    for (const [name, { catalog, word }] of Object.entries(EDITORS)) {
        const copy = (
            catalog as unknown as {
                tasks: {
                    modals: { customizeFields: { description: string; saveFailed: string } };
                };
            }
        ).tasks.modals.customizeFields;

        it(`${name}: description names editors`, () => {
            expect(copy.description).toContain(word);
        });
        it(`${name}: save-failed text names editors`, () => {
            expect(copy.saveFailed).toContain(word);
        });
    }
});
