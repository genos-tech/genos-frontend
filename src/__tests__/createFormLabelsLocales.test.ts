/**
 * The create-task / create-milestone buttons and their shortcut tooltip are translated
 * (MIP-1313; they were English literals around the registry's key text), and so are the
 * "Create:" label, the Task / Milestone toggle and "Select Files" (MIP-1392; they showed in
 * English in `ja`). Raw catalogs, not the merged ones: a locale that falls back to English
 * would pass the merged check.
 */
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { ar } from "../i18n/locales/ar";
import { en } from "../i18n/locales/en";
import { es } from "../i18n/locales/es";
import { fr } from "../i18n/locales/fr";
import { hi } from "../i18n/locales/hi";
import { ja } from "../i18n/locales/ja";
import { zh } from "../i18n/locales/zh";

const KEYS = [
    "cancel",
    "createTask",
    "createMilestone",
    "creating",
    "withShortcut",
    "createLabel",
    "kindTask",
    "kindMilestone",
    "selectFiles",
] as const;
const TRANSLATED = [
    "cancel",
    "createTask",
    "createMilestone",
    "creating",
    "createLabel",
    "kindTask",
    "kindMilestone",
    "selectFiles",
] as const;
const srcDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const source = (path: string) => readFileSync(resolve(srcDir, path), "utf8").replace(/\s+/g, " ");

describe("create form button labels", () => {
    it.each(Object.entries({ en, ja, zh, es, fr, hi, ar }))(
        "%s translates all of them",
        (l, cat) => {
            const form = cat.tasks?.createForm as Record<string, string> | undefined;
            for (const k of KEYS)
                expect((form?.[k] ?? "").trim().length, `${l} ${k}`).toBeGreaterThan(0);
            expect(form?.withShortcut, l).toContain("{label}");
            expect(form?.withShortcut, l).toContain("{shortcut}");
        }
    );

    it.each(["ja", "zh", "es", "fr", "hi", "ar"] as const)(
        "%s is not the English text under another key",
        (l) => {
            const cat = { ja, zh, es, fr, hi, ar }[l];
            const form = cat.tasks?.createForm as Record<string, string>;
            for (const k of TRANSLATED)
                expect(form[k], `${l} ${k}`).not.toBe(
                    (en.tasks.createForm as Record<string, unknown>)[k]
                );
        }
    );
});

describe("the create form no longer prints English literals", () => {
    it("CreateTaskForm: the label and the toggle read the catalog", () => {
        const text = source("features/tasks/components/contents/CreateTaskForm.tsx");
        for (const k of ["createLabel", "kindTask", "kindMilestone"])
            expect(text, k).toContain(`{t.tasks.createForm.${k}}`);
        expect(text).not.toMatch(/> Create: </);
    });

    it.each([
        "features/tasks/components/contents/base/TaskCreateAttachmentBlock.tsx",
        "features/tasks/components/contents/base/TaskTabBlock.tsx",
    ])("%s: Select Files reads the catalog", (file) => {
        const text = source(file);
        expect(text).toContain("{t.tasks.createForm.selectFiles}");
        expect(text).not.toMatch(/> Select Files </);
    });
});
