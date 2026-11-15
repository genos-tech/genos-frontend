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

// --- the window's own strings (`taskAsk.*`) ----------------------------------------------------

type Window = typeof en.taskAsk;
const win = (c: typeof en | (typeof OTHERS)[Name]) => (c.taskAsk ?? {}) as Window;

/** Pairs that say the same thing about a task and about a milestone: a locale must tell them apart. */
const PAIRS: Array<[string, (w: Window) => string, (w: Window) => string]> = [
    ["title", (w) => w.modal.titleTask, (w) => w.modal.titleMilestone],
    ["gone title", (w) => w.gone.titleTask, (w) => w.gone.titleMilestone],
    ["empty hint", (w) => w.conversation.emptyTask, (w) => w.conversation.emptyMilestone],
    [
        "placeholder",
        (w) => w.conversation.placeholderTask,
        (w) => w.conversation.placeholderMilestone,
    ],
];

describe("the task / milestone Ask window's strings", () => {
    it("English names Genos in the title and says the old conversation is kept, not deleted", () => {
        expect(en.taskAsk.modal.titleTask).toContain("Genos");
        expect(en.taskAsk.modal.titleMilestone).toContain("Genos");
        expect(en.taskAsk.conversation.newConversationHint).toMatch(/stays/);
        expect(en.taskAsk.conversation.newConversationHint).not.toMatch(/delet|erase|lose/i);
    });

    it("English says a gone task calmly: may have been deleted OR access lost, no blame, history kept", () => {
        const { body } = en.taskAsk.gone;
        expect(body).toMatch(/deleted/);
        expect(body).toMatch(/access/);
        expect(body).toMatch(/stay in your past conversations/);
        expect(body).not.toMatch(/denied|forbidden|error|failed/i);
    });

    it.each(names)("%s has every string, none left as English", (name) => {
        const w = win(OTHERS[name]);
        const leaves = (node: unknown, prefix = ""): Array<[string, string]> =>
            Object.entries((node ?? {}) as Record<string, unknown>).flatMap(([k, v]) =>
                typeof v === "string"
                    ? [[`${prefix}${k}`, v] as [string, string]]
                    : leaves(v, `${prefix}${k}.`)
            );
        const mine = Object.fromEntries(leaves(w));
        const english = Object.fromEntries(leaves(en.taskAsk));
        expect(Object.keys(mine).sort(), name).toEqual(Object.keys(english).sort());
        for (const [key, value] of Object.entries(mine)) {
            expect(value.trim(), `${name}.${key}`).toBeTruthy();
            expect(value, `${name}.${key}`).not.toBe(english[key]);
        }
    });

    it.each(names)("%s tells a task from a milestone", (name) => {
        const w = win(OTHERS[name]);
        for (const [what, task, milestone] of PAIRS) {
            expect(task(w), `${name} ${what}`).not.toBe(milestone(w));
        }
    });

    it.each(names)(
        "%s names Genos in both titles and in the sentence that says what it knows",
        (name) => {
            const w = win(OTHERS[name]);
            expect(w.modal.titleTask, name).toContain("Genos");
            expect(w.modal.titleMilestone, name).toContain("Genos");
            expect(w.conversation.emptyTask, name).toContain("Genos");
            expect(w.conversation.emptyMilestone, name).toContain("Genos");
        }
    );

    it("the Arabic strings are Arabic, not English under an Arabic key", () => {
        const leaf = (v: unknown): string[] =>
            typeof v === "string" ? [v] : Object.values((v ?? {}) as object).flatMap(leaf);
        for (const text of leaf(ar.taskAsk)) expect(text).toMatch(/[\u0600-\u06FF]/);
    });
});
