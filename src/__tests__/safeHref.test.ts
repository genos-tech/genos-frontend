/**
 * A link's URL becomes an `href` only if it is a web link (MIP-821).
 *
 * The same corpus the server's validator is held to
 * (`origin/tests/test_link_scheme.py`), so the two layers keep one standard:
 * a `javascript:` href runs in the app's origin when a teammate clicks it.
 */

import { describe, expect, it } from "vitest";

import { isWebUrl, safeWebHref } from "../utils/safeHref";

const DANGEROUS = [
    "javascript:alert(1)",
    "JavaScript:alert(1)",
    "JAVASCRIPT:alert(1)",
    "jAvAsCrIpT:alert(1)",
    " javascript:alert(1)",
    "\tjavascript:alert(1)",
    "\n\r\t javascript:alert(1)",
    "\x00javascript:alert(1)",
    "\x01\x02javascript:alert(1)",
    "java\tscript:alert(1)",
    "java\nscript:alert(1)",
    "java\rscript:alert(1)",
    "ja\tva\ns\rcript:alert(1)",
    " \tJa\nVa\rScRiPt:alert(document.cookie)",
    "javascript://%0aalert(1)",
    "javascript:/*http://x*/alert(1)",
    "data:text/html,<script>alert(1)</script>",
    "DATA:text/html;base64,PHNjcmlwdD4=",
    "vbscript:msgbox(1)",
    "file:///etc/passwd",
    "ftp://example.com/x",
    "mailto:a@b.co",
    "tel:+81000",
    "blob:https://example.com/uuid",
    "about:blank",
    "chrome://settings",
    "view-source:https://example.com",
];

const WEB = [
    "https://example.com",
    "http://example.com",
    "HTTPS://EXAMPLE.COM/Path",
    "Http://example.com",
    "https://example.com:8443/a/b?c=d&e=f#frag",
    "https://github.com/owner/repo/pull/12",
    "https://example.com/a:b",
    "https://example.com/?next=javascript:alert(1)",
    "https://example.com/#javascript:alert(1)",
    "https://例え.jp/パス",
    "https://[2001:db8::1]/x",
    "https://user@example.com/",
];

describe("safeWebHref", () => {
    it("refuses every script-capable form", () => {
        for (const url of DANGEROUS) {
            expect(safeWebHref(url), JSON.stringify(url)).toBeUndefined();
            expect(isWebUrl(url), JSON.stringify(url)).toBe(false);
        }
    });

    it("keeps every real web link, returning it unchanged", () => {
        for (const url of WEB) {
            expect(safeWebHref(url), url).toBe(url);
            expect(isWebUrl(url), url).toBe(true);
        }
    });

    it("refuses what is not an absolute URL at all", () => {
        // On a task link these would resolve against the app's own origin and open
        // the wrong page. (The server leaves them alone; this is the stricter layer.)
        for (const url of [
            "example.com",
            "www.example.com",
            "/relative",
            "#anchor",
            "//x.com/y",
            "",
        ]) {
            expect(safeWebHref(url), JSON.stringify(url)).toBeUndefined();
        }
    });

    it("treats a missing or non-string value as no link", () => {
        for (const value of [undefined, null, 7, {}, []] as unknown[]) {
            expect(safeWebHref(value as never)).toBeUndefined();
        }
    });

    it("does not rewrite the URL it accepts", () => {
        const url = "https://example.com/a b?x=1";
        expect(safeWebHref(url)).toBe(url);
    });

    it("hands back the string exactly as given, surrounding whitespace included", () => {
        // `new URL` accepts a web link with leading/trailing whitespace and the
        // browser ignores it in an href. The helper must return what it was given
        // and not a trimmed copy, so what is stored and what is rendered match.
        for (const url of [
            "  https://example.com",
            "https://example.com  ",
            "\thttps://example.com\n",
        ]) {
            expect(safeWebHref(url), JSON.stringify(url)).toBe(url);
        }
    });

    it("reads the scheme the way a browser does, not by looking at how the string starts", () => {
        // Leading whitespace and control characters are skipped by the URL parser
        // before it reads the scheme, so these ARE web links...
        expect(isWebUrl("   https://example.com")).toBe(true);
        expect(isWebUrl("\x01https://example.com")).toBe(true);
        // ...and a scheme with a tab inside is the OTHER scheme, whatever it looks like.
        expect(isWebUrl("htt\tps://example.com")).toBe(true);
        expect(isWebUrl("java\tscript:alert(1)")).toBe(false);
    });
});
