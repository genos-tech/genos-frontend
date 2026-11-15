/**
 * The strings of "Ask Genos about a message / selected text" (MIP-1058) in all seven locales:
 * the message menu item, the button next to a selection, the toolbar tooltip in notes, and the
 * quote above the Spotlight input. `DeepPartial<Messages>` lets a locale ship without a key and
 * show English; these read the raw catalogs so the merge cannot hide a gap.
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
type Tree = { [key: string]: Tree | string };

const lookup = (tree: unknown, path: string): string | undefined =>
    path
        .split(".")
        .reduce<unknown>(
            (n, k) => (n && typeof n === "object" ? (n as Tree)[k] : undefined),
            tree
        ) as string | undefined;

const placeholders = (s: string) => [...s.matchAll(/\{(\w+)/g)].map((m) => m[1]).sort();

const KEYS = [
    "chat.messageActions.askGenos",
    "chat.messageActions.askGenosSelection",
    "chat.messageActions.askGenosShort",
    "chat.messageActions.askGenosFallback",
    "common.editor.askGenosSelection",
    "spotlight.selection.label",
    "spotlight.selection.remove",
    "spotlight.selection.truncated",
    "spotlight.selection.placeholder",
];
// Not translated on purpose: "Message" is the same word in French.
const MAY_MATCH_ENGLISH: Record<string, string[]> = {
    fr: ["chat.messageActions.askGenosFallback"],
};
// Those that must say Genos (the others are labels of the passage itself).
const NAME_GENOS = KEYS.filter((k) => /askGenos(?!Fallback)/.test(k) || k.endsWith("placeholder"));

describe("the message and selection strings", () => {
    it.each(KEYS)("English defines %s", (path) => {
        expect(lookup(en, path)?.trim()).toBeTruthy();
    });

    it.each(NAME_GENOS)("English names Genos in %s", (path) => {
        expect(lookup(en, path)).toContain("Genos");
    });

    it.each(Object.keys(OTHERS) as Array<keyof typeof OTHERS>)(
        "%s defines every one, in its own words, still naming Genos where English does",
        (name) => {
            const raw = OTHERS[name];
            const missing = KEYS.filter((p) => !lookup(raw, p)?.trim());
            expect({ locale: name, missing }).toEqual({ locale: name, missing: [] });
            const untranslated = KEYS.filter(
                (p) =>
                    lookup(raw, p) === lookup(en, p) &&
                    !(MAY_MATCH_ENGLISH[name] ?? []).includes(p)
            );
            expect({ locale: name, untranslated }).toEqual({ locale: name, untranslated: [] });
            for (const path of NAME_GENOS)
                expect(lookup(raw, path), `${name}.${path}`).toContain("Genos");
        }
    );

    it.each(Object.keys(OTHERS) as Array<keyof typeof OTHERS>)(
        "%s keeps the placeholders the code fills in",
        (name) => {
            const broken = KEYS.filter(
                (p) =>
                    placeholders(lookup(OTHERS[name], p) ?? "").join() !==
                    placeholders(lookup(en, p) ?? "").join()
            );
            expect({ locale: name, broken }).toEqual({ locale: name, broken: [] });
        }
    );

    it("the cut note names the count the code fills in", () => {
        expect(placeholders(en.spotlight.selection.truncated)).toEqual(["count"]);
    });
});
