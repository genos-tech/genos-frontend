/**
 * The answer turn's label contract, and the locale keys it added, across all
 * seven locales.
 *
 * `DeepPartial<Messages>` lets a translator ship a catalog incrementally and the
 * loader merges every missing key onto English, so a locale that simply FORGOT
 * a key type-checks, renders, and shows an English word inside a Japanese turn.
 * These tests read the raw catalogs (like `genosMemoryLocales.test.ts`) so the
 * merge can't hide a gap, then build the contract from the merged catalogs the
 * way the hosts do.
 *
 * Keys added with the single answer turn:
 *   spotlight.states.noAnswer    "(no answer)" was hard-coded English in the Ask
 *                                modals
 *   spotlight.actions.copied     the Copy tooltip's "Copied": Spotlight had none
 *   common.editor.mention*       the @/# dropdown's kind words (Person, Group,
 *                                Todo, Direct message, Group DM): present in
 *                                English only, so every other locale showed them
 *                                in English
 */
import { beforeAll, describe, expect, it } from "vitest";

import {
    buildAgentTurnLabels,
    type AgentTurnHost,
    type AgentTurnLabels,
} from "../features/agentQA/agentTurnLabels";
import { getMessages, loadLocale, type Locale } from "../i18n";
import { ar } from "../i18n/locales/ar";
import { en } from "../i18n/locales/en";
import { es } from "../i18n/locales/es";
import { fr } from "../i18n/locales/fr";
import { hi } from "../i18n/locales/hi";
import { ja } from "../i18n/locales/ja";
import { zh } from "../i18n/locales/zh";

const OTHERS = { ja, es, fr, zh, ar, hi } as const;
const NAMES = Object.keys(OTHERS) as Array<keyof typeof OTHERS>;

type Tree = { [key: string]: Tree | string };

const lookup = (tree: unknown, path: string): string | undefined =>
    path
        .split(".")
        .reduce<unknown>(
            (n, k) => (n && typeof n === "object" ? (n as Tree)[k] : undefined),
            tree
        ) as string | undefined;

const placeholders = (s: string) => [...s.matchAll(/\{(\w+)/g)].map((m) => m[1]).sort();

const NEW_KEYS = [
    "spotlight.states.noAnswer",
    "spotlight.actions.copied",
    "common.editor.mentionPerson",
    "common.editor.mentionGroupLabel",
    "common.editor.mentionTodo",
    "common.editor.mentionDirectMessage",
    "common.editor.mentionMultiDm",
];

describe("the keys added for the single answer turn", () => {
    it.each(NEW_KEYS)("English defines %s", (path) => {
        expect(lookup(en, path)?.trim()).toBeTruthy();
    });

    it.each(NAMES)("%s defines every one of them, in its own words", (name) => {
        const missing = NEW_KEYS.filter((p) => !lookup(OTHERS[name], p)?.trim());
        expect({ locale: name, missing }).toEqual({ locale: name, missing: [] });
        // Translated, not pasted from English (these are all short labels, but
        // none of them is a word that is the same in all six languages).
        const untranslated = NEW_KEYS.filter((p) => lookup(OTHERS[name], p) === lookup(en, p));
        expect({ locale: name, untranslated }).toEqual({ locale: name, untranslated: [] });
    });

    it.each(NAMES)("%s keeps the placeholders the code fills in", (name) => {
        const broken = NEW_KEYS.filter((p) => {
            const own = lookup(OTHERS[name], p) ?? "";
            return placeholders(own).join() !== placeholders(lookup(en, p) ?? "").join();
        });
        expect({ locale: name, broken }).toEqual({ locale: name, broken: [] });
    });
});

const LOCALES: Locale[] = ["en", "ja", "es", "fr", "zh", "ar", "hi"];
const HOSTS: AgentTurnHost[] = ["spotlight", "threadAsk", "noteAsk"];

beforeAll(async () => {
    for (const l of LOCALES) await loadLocale(l);
});

const strings = (node: unknown, trail: string[] = []): Array<[string, string]> => {
    if (typeof node === "string") return [[trail.join("."), node]];
    if (node === null || typeof node !== "object") return [];
    return Object.entries(node as Record<string, unknown>).flatMap(([k, v]) =>
        strings(v, [...trail, k])
    );
};

describe.each(LOCALES)("the label contract in %s", (locale) => {
    it.each(HOSTS)("%s: every label is a non-empty string", (host) => {
        const labels = buildAgentTurnLabels(getMessages(locale), host);
        const all = strings(labels);
        expect(all.length).toBeGreaterThan(40);
        expect(all.filter(([, text]) => text.trim() === "").map(([path]) => path)).toEqual([]);
    });

    it.each(HOSTS)("%s: the templates still carry their placeholders", (host) => {
        const labels = buildAgentTurnLabels(getMessages(locale), host);
        expect(labels.states.answeredIn).toContain("{duration}");
        expect(labels.actions.moreCount).toContain("{count}");
        expect(labels.approval.titleWithTool).toContain("{toolName}");
        expect(labels.chip.taskPlain).toContain("{id}");
        expect(labels.chip.taskPlain).toContain("{subtitle}");
    });
});

describe("where each host's labels come from", () => {
    const t = () => getMessages("ja");

    it("Spotlight reads its own namespace throughout", () => {
        const sp = t().spotlight;
        const l = buildAgentTurnLabels(t(), "spotlight");
        expect(l.turnLabelQ).toBe(sp.conversation.turnLabelQ);
        expect(l.states).toEqual({
            streaming: sp.states.streaming,
            thinking: sp.states.thinking,
            awaitingApproval: sp.states.awaitingApproval,
            answeredIn: sp.conversation.answeredIn,
            noAnswer: sp.states.noAnswer,
        });
        expect(l.actions).toEqual({
            approve: sp.actions.approve,
            reject: sp.actions.reject,
            copyAnswer: sp.actions.copyAnswer,
            copied: sp.actions.copied,
            retry: sp.actions.retry,
            feedbackUp: sp.actions.feedbackUp,
            feedbackDown: sp.actions.feedbackDown,
            moreCount: sp.actions.moreCount,
            showLess: sp.actions.showLess,
        });
        expect(l.approval.titleWithTool).toBe(sp.approval.titleWithTool);
    });

    it.each([
        ["threadAsk", () => t().threadAsk],
        ["noteAsk", () => t().noteAsk],
    ] as const)("%s keeps its own wording, and borrows Spotlight's for the rest", (host, ns) => {
        const own = ns();
        const sp = t().spotlight;
        const l = buildAgentTurnLabels(t(), host);
        // What the modal already translated stays the modal's ...
        expect(l.turnLabelQ).toBe(own.conversation.turnLabelQ);
        expect(l.turnLabelA).toBe(own.conversation.turnLabelA);
        expect(l.states.streaming).toBe(own.states.streaming);
        expect(l.states.thinking).toBe(own.states.thinking);
        expect(l.states.answeredIn).toBe(own.states.answeredIn);
        expect(l.actions.approve).toBe(own.actions.approve);
        expect(l.actions.reject).toBe(own.actions.reject);
        expect(l.actions.copyAnswer).toBe(own.actions.copyAnswer);
        expect(l.actions.copied).toBe(own.actions.copied);
        expect(l.actions.retry).toBe(own.actions.retry);
        expect(l.approval.titleWithTool).toBe(own.approval.titleWithTool);
        // ... and what it never had is Spotlight's.
        expect(l.states.awaitingApproval).toBe(sp.states.awaitingApproval);
        expect(l.states.noAnswer).toBe(sp.states.noAnswer);
        expect(l.actions.feedbackUp).toBe(sp.actions.feedbackUp);
        expect(l.actions.feedbackDown).toBe(sp.actions.feedbackDown);
        expect(l.actions.moreCount).toBe(sp.actions.moreCount);
        expect(l.actions.showLess).toBe(sp.actions.showLess);
        expect(l.chip).toEqual(sp.chip);
        expect(l.entitySubtitle).toEqual(sp.entitySubtitle);
    });

    it("names a tool from the agentApproval catalog, and falls back to the raw name", () => {
        const l = buildAgentTurnLabels(t(), "spotlight");
        expect(l.approval.toolLabel("update_task")).toBe(t().agentApproval.toolNames.update_task);
        expect(l.approval.toolLabel("some_new_tool")).toBe("some_new_tool");
    });
});

describe("the contract is complete by type", () => {
    it("rejects a label set with a missing key", () => {
        const full = buildAgentTurnLabels(getMessages("en"), "spotlight");
        // Not enforced by CI's `tsc` (tests are excluded from it); it is here to be
        // read, and holds when `tsc` is run over this file.
        const incomplete: AgentTurnLabels = {
            ...full,
            // @ts-expect-error `noAnswer` is required
            states: { streaming: "", thinking: "", awaitingApproval: "", answeredIn: "" },
        };
        expect(Object.keys(incomplete.states)).not.toContain("noAnswer");
    });
});
