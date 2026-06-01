import { RefObject, useEffect, useRef } from "react";

// Scheme-less but clearly domain-shaped text: "example.com", "www.x.io/path".
// Requires a dotted alphabetic TLD and no whitespace, so ordinary text pasted
// over a selection isn't mistaken for a link.
const SCHEME_LESS_DOMAIN_RE = /^(www\.)?[a-z0-9-]+(\.[a-z0-9-]+)*\.[a-z]{2,}(:\d+)?(\/\S*)?$/i;

// Common web TLDs, used to tell a bare scheme-less domain ("example.com") apart
// from a dotted word like "Node.js" or "file.txt" pasted over a selection. Not
// exhaustive — an unrecognized bare TLD simply isn't auto-linked (paste with an
// https:// scheme or a /path to force it). Deliberately omits extensions that
// happen to be ccTLDs (py, rs, sh, md, …) since a pasted word is far likelier
// than those bare domains in a todo title.
// prettier-ignore
const COMMON_TLDS = new Set([
    "com", "org", "net", "edu", "gov", "mil", "int", "io", "co", "ai",
    "app", "dev", "xyz", "info", "biz", "me", "tv", "cc", "cloud", "tech",
    "online", "site", "store", "blog", "page", "link", "live", "news",
    "us", "uk", "ca", "de", "fr", "jp", "cn", "au", "in", "br", "ru",
    "nl", "eu", "ch", "es", "it", "se", "no", "fi", "dk", "kr", "sg",
    "hk", "tw", "nz", "ie", "be", "at", "pt", "pl", "cz", "mx", "za",
]);

// Decide whether pasted clipboard text should become a link, returning the
// normalized href (https:// added when the scheme is missing) or null. Accepts
// absolute http(s) URLs and scheme-less domains; rejects everything else so a
// plain word/phrase pasted over a selection stays a normal replace.
export const toLinkableUrl = (raw: string): string | null => {
    const s = raw.trim();
    if (!s || /\s/.test(s)) return null;
    if (/^https?:\/\/\S+$/i.test(s)) return s;
    if (!SCHEME_LESS_DOMAIN_RE.test(s)) return null;
    // Scheme-less + domain-shaped. Require a strong "this is a link" signal — a
    // www. prefix, an explicit /path, or a recognized web TLD — so a dotted
    // word like "Node.js" or "file.txt" stays plain text.
    const tld = (s.split("/")[0].split(":")[0].split(".").pop() ?? "").toLowerCase();
    if (/^www\./i.test(s) || s.includes("/") || COMMON_TLDS.has(tld)) {
        return `https://${s}`;
    }
    return null;
};

// Rich-text-style linking without a rich editor: when a URL is pasted over a
// non-empty selection, wrap the selected text as "[selection](url)" — which
// read mode then renders as a clickable word. Returns the rewritten value plus
// the caret position to restore, or null when the paste should fall through to
// the browser's default (no selection, or the clipboard isn't a single URL).
export const linkifyPasteOverSelection = (
    value: string,
    selStart: number,
    selEnd: number,
    pasted: string
): { value: string; caret: number } | null => {
    if (selStart === selEnd) return null;
    const url = toLinkableUrl(pasted);
    if (url === null) return null;
    // Escape parens so URLs like Wikipedia's "…_(disambiguation)" don't get
    // truncated at the first ")" when the markdown link is parsed back.
    const safeUrl = url.replace(/\(/g, "%28").replace(/\)/g, "%29");
    const markdown = `[${value.slice(selStart, selEnd)}](${safeUrl})`;
    return {
        value: value.slice(0, selStart) + markdown + value.slice(selEnd),
        caret: selStart + markdown.length,
    };
};

// Wires paste-to-link onto any todo-title <input>: select a word, paste a URL,
// and the word becomes "[word](url)". Shared by every title field (the
// existing-item editor plus the "+ Add item" / "+ Add subitem" inputs) so the
// behavior is identical everywhere.
//
// Implemented as a NATIVE paste listener on the real element — Joy's synthetic
// onPaste forwards under jsdom but not on an actual browser paste — and reads
// the value/selection off the element so it never sees a stale closure. Pass
// `enabled` for inputs that mount conditionally (e.g. the title editor) so the
// listener re-attaches when the element appears.
export const useLinkifyPaste = (
    inputRef: RefObject<HTMLInputElement | null>,
    value: string,
    setValue: (next: string) => void,
    enabled: boolean = true
): void => {
    const pendingCaretRef = useRef<number | null>(null);

    // After a rewrite, put the caret just past the inserted "[label](url)"
    // rather than letting the controlled-value update bounce it to the end.
    useEffect(() => {
        if (pendingCaretRef.current !== null && inputRef.current) {
            const pos = pendingCaretRef.current;
            inputRef.current.setSelectionRange(pos, pos);
            pendingCaretRef.current = null;
        }
    }, [value, inputRef]);

    useEffect(() => {
        const input = inputRef.current;
        if (!input || !enabled) return;
        const onPaste = (e: ClipboardEvent) => {
            const pasted =
                e.clipboardData?.getData("text/plain") || e.clipboardData?.getData("text") || "";
            const { selectionStart, selectionEnd, value: current } = input;
            if (selectionStart === null || selectionEnd === null) return;
            const result = linkifyPasteOverSelection(
                current,
                selectionStart,
                selectionEnd,
                pasted
            );
            if (!result) return;
            e.preventDefault();
            pendingCaretRef.current = result.caret;
            setValue(result.value);
        };
        input.addEventListener("paste", onPaste);
        return () => input.removeEventListener("paste", onPaste);
    }, [inputRef, setValue, enabled]);
};
