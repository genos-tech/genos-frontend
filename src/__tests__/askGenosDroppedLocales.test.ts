/**
 * The dropped-references notice (MIP-1058, `task` added by MIP-1585): `spotlight.dropped.*` in all
 * seven locales.
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
const KEYS = ["message", "messages", "selection", "selectedFrom", "task"] as const;

// The glossary's words (locales/GLOSSARY.md) for the two things a `"task"` kind can be: the
// sentence names both, because the server's kind covers the task OR milestone a conversation is
// about and the client cannot tell which.
const TASK_AND_MILESTONE = {
    ja: ["タスク", "マイルストーン"],
    zh: ["任务", "里程碑"],
    es: ["tarea", "hito"],
    fr: ["tâche", "jalon"],
    hi: ["टास्क", "माइलस्टोन"],
    ar: ["مهمة", "معلم"],
} as const;

describe("the dropped-references strings", () => {
    it("English has all five, each naming Genos", () => {
        for (const key of KEYS) {
            expect(en.spotlight.dropped[key].trim(), key).toBeTruthy();
            expect(en.spotlight.dropped[key], key).toContain("Genos");
        }
    });

    it("English never says 'read' (the server's word for why is not ours to say)", () => {
        for (const key of KEYS) expect(en.spotlight.dropped[key]).not.toMatch(/\bread\b/i);
    });

    it.each(Object.keys(OTHERS) as Array<keyof typeof OTHERS>)(
        "%s has all five, translated, each still naming Genos",
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

describe("the sentence for a lost task or milestone", () => {
    it("English says 'could not use', and never why (the server gives one value for every cause)", () => {
        const sentence = en.spotlight.dropped.task;
        expect(sentence).toMatch(/could not use/i);
        expect(sentence).toMatch(/task or milestone/i);
        // Missing, unreadable and deleted are one answer on the server: no existence oracle.
        expect(sentence).not.toMatch(
            /\b(read|deleted|missing|removed|access|permission|found)\b/i
        );
    });

    it.each(Object.keys(TASK_AND_MILESTONE) as Array<keyof typeof TASK_AND_MILESTONE>)(
        "%s names the task and the milestone in the glossary's words",
        (name) => {
            const sentence = (OTHERS[name].spotlight?.dropped?.task ?? "").toLowerCase();
            for (const term of TASK_AND_MILESTONE[name]) {
                expect(sentence, `${name}: ${term}`).toContain(term.toLowerCase());
            }
        }
    );
});
