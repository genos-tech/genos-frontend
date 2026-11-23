// MIP-2215 / MIP-2228: the small pure helpers of the HTML note viewer. The page's policy and its
// pre-head ordering are the API route's now (genos-api `test_html_note_pages.py`), and a real browser
// runs a page under the production CSP in `htmlNoteProductionCspMIP2228.test.ts`.
import { describe, expect, it } from "vitest";

import {
    HTML_NOTE_LOADED_KEY,
    HTML_NOTE_SANDBOX,
    htmlNoteFamily,
    isHtmlNote,
} from "../features/notes/common/utils/htmlNote";

describe("the sandbox", () => {
    it("the sandbox is allow-scripts and nothing else", () => {
        expect(HTML_NOTE_SANDBOX).toBe("allow-scripts");
        expect(HTML_NOTE_SANDBOX).not.toContain("allow-same-origin");
    });

    it("the loaded signal's key is the one the server's sentinel posts", () => {
        // genos-api origin/services/html_note_pages.py LOADED_KEY
        expect(HTML_NOTE_LOADED_KEY).toBe("genosHtmlNoteLoaded");
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

    it("names the family the read endpoints take", () => {
        expect(htmlNoteFamily(1)).toBe("personal");
        expect(htmlNoteFamily(2)).toBe("task");
        expect(htmlNoteFamily(3)).toBe("chat");
    });
});
