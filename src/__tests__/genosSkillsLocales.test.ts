/**
 * The Skills settings page (MIP-2041) has every string in every locale.
 *
 * `DeepPartial<Messages>` lets a catalog ship incrementally and the loader merges missing keys
 * onto English, so a locale that forgot a key still type-checks and shows an English sentence in
 * the middle of a translated page. These tests read the raw catalogs so the merge cannot hide a
 * gap (the same approach as `genosMemoryLocales.test.ts`).
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

const placeholders = (s: string) => [...s.matchAll(/\{(\w+)/g)].map((m) => m[1]).sort();

const lookup = (tree: unknown, path: string): string | undefined =>
    path
        .split(".")
        .reduce<unknown>(
            (n, k) => (n && typeof n === "object" ? (n as Tree)[k] : undefined),
            tree
        ) as string | undefined;

const enSkills = leaves(en.settings.genosSkills, ["settings", "genosSkills"]);

describe("Skills settings has every string in every locale", () => {
    it("has a page worth testing", () => {
        expect(enSkills.length).toBeGreaterThan(80);
    });

    it.each(NAMES)("%s defines every key English has, and none it doesn't", (name) => {
        const own = leaves(OTHERS[name].settings?.genosSkills, ["settings", "genosSkills"]).map(
            ([path]) => path
        );
        const wanted = enSkills.map(([path]) => path);
        expect({ locale: name, missing: wanted.filter((p) => !own.includes(p)) }).toEqual({
            locale: name,
            missing: [],
        });
        expect({ locale: name, extra: own.filter((p) => !wanted.includes(p)) }).toEqual({
            locale: name,
            extra: [],
        });
    });

    it.each(NAMES)("%s is translated, not copied from English", (name) => {
        const untouched = enSkills
            .filter(([, text]) => text.length > 40)
            .filter(([path, text]) => lookup(OTHERS[name], path) === text)
            .map(([path]) => path);
        expect({ locale: name, untouched }).toEqual({ locale: name, untouched: [] });
    });

    it.each(NAMES)("%s keeps every {placeholder} the code fills in", (name) => {
        const broken = enSkills
            .filter(([path, text]) => {
                const own = lookup(OTHERS[name], path);
                return own === undefined || placeholders(own).join() !== placeholders(text).join();
            })
            .map(([path]) => path);
        expect({ locale: name, broken }).toEqual({ locale: name, broken: [] });
    });

    it.each(NAMES)("%s has no empty string", (name) => {
        const empty = leaves(OTHERS[name].settings?.genosSkills)
            .filter(([, text]) => text.trim() === "")
            .map(([path]) => path);
        expect(empty).toEqual([]);
    });
});
