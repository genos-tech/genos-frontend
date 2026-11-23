import { describe, expect, it } from "vitest";

import {
    buildHtmlSrcdoc,
    HTML_NOTE_CSP,
    HTML_NOTE_SANDBOX,
    htmlNoteFamily,
    isHtmlNote,
    stripLeadingDoctype,
} from "../features/notes/common/utils/htmlNote";

describe("stripLeadingDoctype", () => {
    it("drops whitespace, comments and the doctype, keeps the rest", () => {
        expect(stripLeadingDoctype("  <!-- a --> <!--b-->\n<!DOCTYPE html>\n<p>x</p>")).toBe(
            "\n<p>x</p>"
        );
        expect(stripLeadingDoctype("<!doctype html PUBLIC 'x'><p>x</p>")).toBe("<p>x</p>");
    });

    it("returns a page with no doctype exactly as it is", () => {
        expect(stripLeadingDoctype("<p>x</p>")).toBe("<p>x</p>");
        expect(stripLeadingDoctype("")).toBe("");
        expect(stripLeadingDoctype("<!-- only a comment --><p>x</p>")).toBe(
            "<!-- only a comment --><p>x</p>"
        );
    });

    it("returns a page with an unterminated comment or doctype as it is", () => {
        expect(stripLeadingDoctype("<!-- never closed <!doctype html><p>x</p>")).toBe(
            "<!-- never closed <!doctype html><p>x</p>"
        );
        expect(stripLeadingDoctype("<!doctype html")).toBe("<!doctype html");
    });

    it("does not strip a doctype that is not the first thing", () => {
        expect(stripLeadingDoctype("<p>a</p><!doctype html>")).toBe("<p>a</p><!doctype html>");
    });

    it("stays linear on hostile input: a page that is 200 000 comment openers, and one of spaces", () => {
        for (const hostile of [
            "<!--".repeat(200_000),
            " ".repeat(500_000) + "x",
            "<!-- ".repeat(100_000) + "<!doctype",
        ]) {
            const t0 = performance.now();
            stripLeadingDoctype(hostile);
            expect(performance.now() - t0).toBeLessThan(1000);
        }
    });
});

const META_START = '<!doctype html><meta http-equiv="Content-Security-Policy" content="';

// The plan's probe 96: a <script> BEFORE <head>. A policy injected after "<head>" came too late for
// it and a remote image loaded; ours is the first thing in the document.
const PROBE_96 =
    "<!doctype html><html><script>\n" +
    "  const i = new Image(); i.src = 'https://www.google.com/favicon.ico?leak=1';\n" +
    "  fetch('https://www.google.com/generate_204');\n" +
    '</script><head lang="en"><meta charset="utf-8"><title>prehead</title></head>' +
    "<body><p>pre-head script probe</p></body></html>";

describe("buildHtmlSrcdoc (MIP-2215)", () => {
    it("starts with our doctype and our CSP meta", () => {
        const doc = buildHtmlSrcdoc("<html><body>hi</body></html>");
        expect(doc.startsWith(META_START)).toBe(true);
        expect(doc).toContain(`content="${HTML_NOTE_CSP}">`);
    });

    it("removes the author's doctype, so there is exactly one", () => {
        const doc = buildHtmlSrcdoc(
            "<!DOCTYPE html PUBLIC '-//W3C//DTD'><html><body>x</body></html>"
        );
        expect(doc.match(/<!doctype/gi)).toHaveLength(1);
        expect(doc.startsWith("<!doctype html><meta")).toBe(true);
    });

    it("removes a doctype that follows leading comments and a BOM", () => {
        const doc = buildHtmlSrcdoc("﻿<!-- generated -->\n  <!-- by -->\n<!doctype html><p>x</p>");
        expect(doc.match(/<!doctype/gi)).toHaveLength(1);
        expect(doc.endsWith("<p>x</p>")).toBe(true);
    });

    it("keeps a page that has no doctype whole", () => {
        const doc = buildHtmlSrcdoc("<p>just a paragraph</p>");
        expect(doc.endsWith("<p>just a paragraph</p>")).toBe(true);
    });

    it("probe 96: no author markup comes before the policy", () => {
        const doc = buildHtmlSrcdoc(PROBE_96);
        const meta = doc.indexOf("Content-Security-Policy");
        const firstScript = doc.indexOf("<script");
        expect(meta).toBeGreaterThan(-1);
        expect(firstScript).toBeGreaterThan(meta);
        // nothing at all before our meta except our own doctype
        expect(doc.slice(0, doc.indexOf("<meta"))).toBe("<!doctype html>");
        expect(doc.match(/<!doctype/gi)).toHaveLength(1);
    });

    it("an author's doctype after the opening tags is not special-cased away (only the leading one is)", () => {
        const doc = buildHtmlSrcdoc("<html><!doctype html><body>x</body></html>");
        // not leading, so left for the parser, which ignores a stray doctype
        expect(doc.match(/<!doctype/gi)).toHaveLength(2);
        expect(doc.startsWith(META_START)).toBe(true);
    });

    it("does not let the page close our meta tag: the policy is a constant with no quote in it", () => {
        expect(HTML_NOTE_CSP).not.toMatch(/["<>]/);
    });
});

describe("the policy and the sandbox", () => {
    it("allows no network and no way out", () => {
        const directives = Object.fromEntries(
            HTML_NOTE_CSP.split("; ").map((d) => {
                const [name, ...values] = d.split(" ");
                return [name, values.join(" ")];
            })
        );
        expect(directives["default-src"]).toBe("'none'");
        expect(directives["connect-src"]).toBe("'none'");
        expect(directives["form-action"]).toBe("'none'");
        expect(directives["frame-src"]).toBe("'none'");
        expect(directives["object-src"]).toBe("'none'");
        expect(directives["base-uri"]).toBe("'none'");
        expect(directives["worker-src"]).toBe("'none'");
        // media and fonts only from inside the page
        for (const name of ["img-src", "font-src", "media-src"]) {
            expect(directives[name]).not.toMatch(/https?:|\*/);
        }
        // the page's own inline script and style are the whole point
        expect(directives["script-src"]).toBe("'unsafe-inline'");
        expect(directives["style-src"]).toBe("'unsafe-inline'");
    });

    it("the sandbox is allow-scripts and nothing else", () => {
        expect(HTML_NOTE_SANDBOX).toBe("allow-scripts");
    });
});

describe("isHtmlNote / htmlNoteFamily", () => {
    it("is true only for bodyFormat html", () => {
        expect(isHtmlNote({ bodyFormat: "html" })).toBe(true);
        expect(isHtmlNote({ bodyFormat: "blocknote" })).toBe(false);
        expect(isHtmlNote({})).toBe(false);
        expect(isHtmlNote(null)).toBe(false);
        expect(isHtmlNote(undefined)).toBe(false);
    });

    it("names the family the read endpoint takes", () => {
        expect(htmlNoteFamily(1)).toBe("personal");
        expect(htmlNoteFamily(2)).toBe("task");
        expect(htmlNoteFamily(3)).toBe("chat");
    });
});
