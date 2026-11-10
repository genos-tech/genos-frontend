/**
 * The create-task / create-milestone buttons and their shortcut tooltip are translated
 * (MIP-1313; they were English literals around the registry's key text). Raw catalogs, not
 * the merged ones: a locale that falls back to English would pass the merged check.
 */
import { describe, expect, it } from "vitest";

import { ar } from "../i18n/locales/ar";
import { en } from "../i18n/locales/en";
import { es } from "../i18n/locales/es";
import { fr } from "../i18n/locales/fr";
import { hi } from "../i18n/locales/hi";
import { ja } from "../i18n/locales/ja";
import { zh } from "../i18n/locales/zh";

const KEYS = ["cancel", "createTask", "createMilestone", "creating", "withShortcut"] as const;

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
            for (const k of ["cancel", "createTask", "createMilestone", "creating"])
                expect(form[k], `${l} ${k}`).not.toBe(
                    (en.tasks.createForm as Record<string, string>)[k]
                );
        }
    );
});
