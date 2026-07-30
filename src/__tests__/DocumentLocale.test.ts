import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { applyDocumentLocale, localeDirection, type Locale } from "../i18n/types";

const ALL_LOCALES: Locale[] = ["en", "ja", "es", "fr", "zh", "ar", "hi"];

afterEach(() => {
    document.documentElement.lang = "en";
    document.documentElement.dir = "";
});

describe("localeDirection", () => {
    it("renders Arabic right-to-left", () => {
        expect(localeDirection("ar")).toBe("rtl");
    });

    it("renders every other shipped locale left-to-right", () => {
        for (const locale of ALL_LOCALES.filter((l) => l !== "ar")) {
            expect(localeDirection(locale)).toBe("ltr");
        }
    });

    it("answers for every shipped locale — a new one can't fall through", () => {
        // `Locale` is a closed union, so this loop is exhaustive by
        // construction: adding a locale without deciding its direction is a
        // type error at the call site, not a silent `undefined` here.
        for (const locale of ALL_LOCALES) {
            expect(["ltr", "rtl"]).toContain(localeDirection(locale));
        }
    });
});

describe("applyDocumentLocale", () => {
    it("writes lang so screen readers don't read every locale in an English voice", () => {
        applyDocumentLocale("ja");
        expect(document.documentElement.lang).toBe("ja");
    });

    it("writes dir alongside lang", () => {
        applyDocumentLocale("ar");
        expect(document.documentElement.lang).toBe("ar");
        expect(document.documentElement.dir).toBe("rtl");
    });

    it("resets dir when switching back out of an RTL locale", () => {
        // The failure this guards: writing `dir` only for RTL locales leaves
        // the document stuck in `rtl` for the rest of the session once a user
        // has visited Arabic.
        applyDocumentLocale("ar");
        applyDocumentLocale("fr");
        expect(document.documentElement.dir).toBe("ltr");
    });

    it("overwrites the hard-coded lang that index.html ships", () => {
        // `index.html` has `<html lang="en">` and this is a pure client-render
        // SPA, so that is what every request receives until something writes
        // over it.
        document.documentElement.lang = "en";
        applyDocumentLocale("hi");
        expect(document.documentElement.lang).toBe("hi");
    });
});

describe("boot order", () => {
    // Importing `main.tsx` would boot the entire app, so this asserts the one
    // property that matters and can't be observed any other way here: the
    // document's locale is written BEFORE the mount. Move the call below the
    // `initialLocale === "en"` branch and a non-English user's document
    // claims `lang="en"` for the whole catalog fetch — the bug this closes.
    const main = readFileSync(join(process.cwd(), "src/main.tsx"), "utf8");

    it("writes the document locale at boot", () => {
        expect(main).toContain("applyDocumentLocale(initialLocale)");
    });

    it("writes it before mounting React", () => {
        expect(main.indexOf("applyDocumentLocale(initialLocale)")).toBeLessThan(
            main.indexOf('if (initialLocale === "en")')
        );
    });

    it("still ships a static lang in index.html as the pre-JS fallback", () => {
        // Not redundant with the above: if JS fails to run at all, this is the
        // only `lang` a screen reader ever sees.
        expect(readFileSync(join(process.cwd(), "index.html"), "utf8")).toMatch(/<html lang="/);
    });
});
