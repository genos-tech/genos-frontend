/**
 * The strings of "Ask Genos about a task or milestone" (MIP-1057) in all seven locales.
 * `DeepPartial<Messages>` lets a locale ship without a key and show English; these read the raw
 * catalogs so the merge cannot hide a gap (the whole-catalog test checks presence and placeholders;
 * this one checks the claims each sentence makes).
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
type Name = keyof typeof OTHERS;
const names = Object.keys(OTHERS) as Name[];

const agent = (c: typeof en | (typeof OTHERS)[Name]) =>
    (c.services?.agent ?? {}) as Record<string, string | undefined>;
const surfaces = (c: typeof en | (typeof OTHERS)[Name]) =>
    (c.services?.notifications?.agentRun ?? {}) as Record<string, string | undefined>;

describe("services.agent.taskNotFound (the sentence under a question whose task is gone)", () => {
    it("English says it calmly, names both a task and a milestone, and does not accuse", () => {
        const s = en.services.agent.taskNotFound;
        expect(s).toMatch(/task or milestone/);
        expect(s).toContain("Genos");
        expect(s).not.toMatch(/denied|forbidden|not authori[sz]ed|deleted/i);
    });

    it.each(names)("%s has it, translated, still naming Genos", (name) => {
        const s = agent(OTHERS[name]).taskNotFound;
        expect(s?.trim(), name).toBeTruthy();
        expect(s, name).not.toBe(en.services.agent.taskNotFound);
        expect(s, name).toContain("Genos");
    });
});

describe("services.agent.taskSessionLoadFailed", () => {
    it.each(names)("%s has it, translated", (name) => {
        const s = agent(OTHERS[name]).taskSessionLoadFailed;
        expect(s?.trim(), name).toBeTruthy();
        expect(s, name).not.toBe(en.services.agent.taskSessionLoadFailed);
    });
});

describe("the completion notice's label for a task conversation", () => {
    it("is its own label, not the note's or the thread's, in every locale", () => {
        expect(en.services.notifications.agentRun.surfaceTask).toBe("Ask about this task");
        for (const name of names) {
            const s = surfaces(OTHERS[name]);
            expect(s.surfaceTask?.trim(), name).toBeTruthy();
            expect(s.surfaceTask, name).not.toBe(s.surfaceNote);
            expect(s.surfaceTask, name).not.toBe(s.surfaceThread);
        }
    });
});
