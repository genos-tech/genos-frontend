import { describe, expect, it } from "vitest";

import { fmt } from "../i18n/interpolate";
import { en } from "../i18n/locales/en";
import { Locale } from "../i18n/types";

/**
 * `fmt` used to anchor its plural pattern to the WHOLE template, so a plural
 * embedded in a sentence matched nothing — and then the placeholder pass read
 * that plural's `{member}` / `{members}` bodies as unknown variables and
 * resolved them to "". Three shipped member-count lines rendered as
 * "3 {count, plural, one {} other {}} selected" in every locale.
 *
 * The guard at the bottom is the important half: it holds for every message in
 * every locale, so a translator writing a plural mid-sentence — the natural
 * thing to do — can't reintroduce this.
 */
describe("a plural in the middle of a sentence", () => {
    it("picks the plural branch and keeps the words around it", () => {
        const template = "{count} {count, plural, one {member} other {members}} selected";
        expect(fmt(template, { count: 3 })).toBe("3 members selected");
    });

    it("picks the singular branch for exactly one", () => {
        const template = "{count} {count, plural, one {member} other {members}} selected";
        expect(fmt(template, { count: 1 })).toBe("1 member selected");
    });

    it("still substitutes # inside the branch it picked", () => {
        expect(fmt("You have {n, plural, one {# note} other {# notes}} left", { n: 2 })).toBe(
            "You have 2 notes left"
        );
    });

    it("handles a plural that is the whole message, as before", () => {
        expect(fmt("{count, plural, one {# task} other {# tasks}}", { count: 1 })).toBe("1 task");
    });

    it("leaves an unknown variable empty rather than throwing", () => {
        expect(fmt("Hello, {name}!", {})).toBe("Hello, !");
    });
});

const LOCALES: Locale[] = ["en", "ar", "es", "fr", "hi", "ja", "zh"];

/** Every string in a locale, however deeply nested. */
const stringsIn = (node: unknown, trail: string[] = []): [string, string][] => {
    if (typeof node === "string") return [[trail.join("."), node]];
    if (node === null || typeof node !== "object") return [];
    return Object.entries(node).flatMap(([key, value]) => stringsIn(value, [...trail, key]));
};

describe("no locale ships a plural the formatter can't read", () => {
    it.each(LOCALES)("%s renders every plural message with nothing left over", async (locale) => {
        // Each catalog is a named export under its own locale code, the same
        // way `localeLoaders` reaches for them.
        const module: Record<string, unknown> =
            locale === "en" ? { en } : await import(`../i18n/locales/${locale}/index.ts`);
        const messages = module[locale];
        const plurals = stringsIn(messages).filter(([, text]) => text.includes("plural,"));

        // Zero would make the rest of this vacuous — which is how the first
        // run of this test failed: the locale had been imported the wrong way
        // and every assertion below was passing over an empty list. Every
        // locale really does carry plurals.
        expect(plurals.length).toBeGreaterThan(0);

        for (const [path, text] of plurals) {
            for (const count of [0, 1, 5]) {
                // Every plural message in the app counts something called
                // `count`; a differently-named one would surface here as
                // leftover braces, which is the point.
                const rendered = fmt(text, { count });
                expect(rendered, `${locale}.${path} at count=${count}`).not.toMatch(/[{}]/);
            }
        }
    });
});
