/**
 * The HTML-note strings (`notes.htmlNote.*`, `notes.htmlImport.*`, `notes.header.reloadPage`)
 * (MIP-2215) in all seven locales.
 *
 * A locale may ship a catalog incrementally and the loader merges every missing key onto English, so a
 * locale that FORGOT a key type-checks, renders and shows an English sentence in a Japanese dialog.
 * These read the raw catalogs so the merge cannot hide a gap.
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
const NAMES = Object.keys(OTHERS) as Array<keyof typeof OTHERS>;

type Tree = { [key: string]: Tree | string };
const leaves = (node: unknown, trail: string[] = []): Array<[string, string]> => {
    if (typeof node === "string") return [[trail.join("."), node]];
    if (node === null || typeof node !== "object") return [];
    return Object.entries(node as Tree).flatMap(([k, v]) => leaves(v, [...trail, k]));
};
const lookup = (tree: unknown, path: string): string | undefined =>
    path
        .split(".")
        .reduce<unknown>(
            (n, k) => (n && typeof n === "object" ? (n as Tree)[k] : undefined),
            tree
        ) as string | undefined;
const placeholders = (s: string) => [...s.matchAll(/\{(\w+)/g)].map((m) => m[1]).sort();

const enKeys = [
    ...leaves(en.notes.htmlNote, ["notes", "htmlNote"]),
    ...leaves(en.notes.htmlImport, ["notes", "htmlImport"]),
    ["notes.header.reloadPage", en.notes.header.reloadPage] as [string, string],
];

// The scan's finding codes (`html_notes._ADVICE` plus the two page-shape warnings on the server).
const SERVER_CODES = [
    "external_script",
    "external_css",
    "external_font",
    "remote_image",
    "external_frame",
    "network_call",
    "form",
    "window_open",
    "navigation",
    "storage",
    "no_doctype",
    "no_title",
];

describe("the HTML-note strings in every locale", () => {
    it("English has a line for every finding code the server can send", () => {
        expect(Object.keys(en.notes.htmlImport.warning).sort()).toEqual([...SERVER_CODES].sort());
    });

    it.each(NAMES)("%s has every key, translated, with the same placeholders", (name) => {
        const catalog = OTHERS[name];
        for (const [path, english] of enKeys) {
            const value = lookup(catalog, path);
            expect(value, `${name} is missing ${path}`).toBeTypeOf("string");
            expect(value, `${name}: ${path} is empty`).not.toBe("");
            expect(placeholders(value as string), `${name}: placeholders of ${path}`).toEqual(
                placeholders(english)
            );
        }
    });

    it.each(NAMES)("%s does not leave an English sentence in place of its own", (name) => {
        const catalog = OTHERS[name];
        // A plain label that is the same word in the language (a brand, a unit), by its own spelling.
        const SAME = new Set<string>();
        const english = enKeys.filter(([path, value]) => {
            const mine = lookup(catalog, path);
            return mine === value && !SAME.has(path);
        });
        expect(english.map(([path]) => path)).toEqual([]);
    });
});
