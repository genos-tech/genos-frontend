/**
 * MIP-1302: the discard-draft dialogs (new task, new milestone) have their words in all
 * seven locales. (The graph's delete confirm is gone: a card's Deleted is an Undo toast,
 * MIP-1303.)
 *
 * `DeepPartial<Messages>` lets a locale ship a catalog incrementally and the loader merges
 * every missing key onto English, so a locale that FORGOT a key type-checks and quietly shows
 * English. These read the raw catalogs.
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { ar } from "../i18n/locales/ar";
import { en } from "../i18n/locales/en";
import { es } from "../i18n/locales/es";
import { fr } from "../i18n/locales/fr";
import { hi } from "../i18n/locales/hi";
import { ja } from "../i18n/locales/ja";
import { zh } from "../i18n/locales/zh";

const OTHERS = { ja, es, fr, zh, ar, hi } as const;

type Catalog = {
    tasks?: {
        createForm?: Record<string, string>;
    };
};

const CREATE_FORM_KEYS = [
    "discardTaskTitle",
    "discardTaskBody",
    "discardMilestoneTitle",
    "discardMilestoneBody",
    "discardConfirm",
    "discardKeepEditing",
    "closeDraftTitle",
    "closeDraftBody",
    "closeDraftHide",
] as const;

const strings = (c: Catalog): Record<string, string | undefined> => ({
    ...Object.fromEntries(CREATE_FORM_KEYS.map((k) => [k, c.tasks?.createForm?.[k]])),
});

describe("discard-draft strings", () => {
    it("English has all of them", () => {
        for (const [key, value] of Object.entries(strings(en as Catalog))) {
            expect(value, key).toBeTruthy();
        }
    });

    for (const [name, catalog] of Object.entries(OTHERS)) {
        it(`${name} has all of them, translated (not the English)`, () => {
            const english = strings(en as Catalog);
            for (const [key, value] of Object.entries(strings(catalog as Catalog))) {
                expect(value, `${name}.${key}`).toBeTruthy();
                expect(value, `${name}.${key} is the English text`).not.toBe(english[key]);
            }
        });
    }

    it("titles are questions, bodies are statements, and no placeholder is left in", () => {
        for (const catalog of [en, ...Object.values(OTHERS)]) {
            const s = strings(catalog as Catalog);
            for (const title of [s.discardTaskTitle, s.discardMilestoneTitle, s.closeDraftTitle]) {
                expect(title).toMatch(/[?？؟]$/);
                expect(title).not.toMatch(/[{}]/);
            }
            for (const body of [s.discardTaskBody, s.discardMilestoneBody, s.closeDraftBody]) {
                expect(body).not.toMatch(/[{}]/);
                expect(body).not.toMatch(/[?？؟]/);
            }
        }
    });
});

describe("the dialogs read the catalog", () => {
    const SRC = join(dirname(fileURLToPath(import.meta.url)), "..");
    const read = (rel: string) => readFileSync(join(SRC, rel), "utf8");

    it("no create-form file carries the English discard copy any more", () => {
        for (const rel of [
            "features/tasks/components/contents/base/TaskCreateFooter.tsx",
            "features/tasks/components/contents/CreateTaskForm.tsx",
            "features/tasks/components/contents/base/TaskTitleBlock.tsx",
        ]) {
            const source = read(rel);
            // Code only: the comments in these files name the buttons in English.
            const code = source.replace(/\{\/\*[\s\S]*?\*\/\}|\/\/.*$/gm, "");
            expect(code, rel).not.toMatch(/Discard (this|draft)|Keep editing|Close this draft/);
            expect(code, rel).toContain("t.tasks.createForm.discardConfirm");
            expect(code, rel).toContain("t.tasks.createForm.discardKeepEditing");
        }
    });
});
