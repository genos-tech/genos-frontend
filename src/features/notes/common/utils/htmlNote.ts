/**
 * HTML notes (MIP-2215): a note whose body is one HTML page, shown read-only in a sandboxed frame.
 *
 * THE BOUNDARY IS THE SANDBOX PLUS THE CSP, never a sanitizer. The page is untrusted: it is shown in
 * an `<iframe sandbox="allow-scripts">` (no `allow-same-origin`, so the frame has an opaque origin and
 * can reach no cookie, storage or parent DOM), and this module puts a Content-Security-Policy in front
 * of it so the page can load nothing from the network.
 */

import type { NoteBodyFormat } from "../../../../types/notes";

/** What the frame may do: run inline script and style, draw `data:` / `blob:` media. Nothing leaves
 *  the page: no fetch, XHR, WebSocket, form post, nested frame, worker or plugin, and no `<base>`.
 *  `frame-ancestors` and `sandbox` are not here on purpose: a `<meta>` policy ignores both (the
 *  iframe attribute supplies the sandbox, and a `srcdoc` frame is ours by construction). */
export const HTML_NOTE_CSP = [
    "default-src 'none'",
    "script-src 'unsafe-inline'",
    "style-src 'unsafe-inline'",
    "img-src data: blob:",
    "font-src data:",
    "media-src data: blob:",
    "connect-src 'none'",
    "form-action 'none'",
    "object-src 'none'",
    "base-uri 'none'",
    "frame-src 'none'",
    "worker-src 'none'",
    "manifest-src 'none'",
].join("; ");

/** The one `sandbox` value the frame ever gets. `allow-same-origin`, `allow-popups`, `allow-forms`,
 *  `allow-top-navigation` and `allow-modals` are all deliberately absent. */
export const HTML_NOTE_SANDBOX = "allow-scripts";

/** A leading BOM, then any comments, then the author's doctype: the part we replace with our own. */
const LEADING_DOCTYPE = /^\s*(?:<!--[\s\S]*?-->\s*)*<!doctype[^>]*>/i;

/** True for a note shown as an HTML page. Anything else (undefined included) is an ordinary note. */
export const isHtmlNote = (
    note: { bodyFormat?: NoteBodyFormat | string | null } | null | undefined
) => note?.bodyFormat === "html";

/**
 * The document for the frame's `srcdoc`.
 *
 * Our doctype and CSP `<meta>` come FIRST, then the author's page with its own doctype removed.
 * Order is the whole point: a meta policy covers only content parsed AFTER it, and a script placed
 * before `<head>` ran before a policy injected after `<head>` and loaded a remote image (probe 96).
 * The HTML parser merges the author's later `<html>` / `<head>` tags into the implied ones, so no
 * author markup runs before the policy is in force, and our doctype keeps the page in standards mode.
 *
 * An author's own CSP `<meta>` can only narrow this policy: browsers enforce every policy they have
 * seen, so a second one never widens the first.
 */
export const buildHtmlSrcdoc = (html: string, nonce?: string): string => {
    const withoutBom = html.charCodeAt(0) === 0xfeff ? html.slice(1) : html;
    const rest = withoutBom.replace(LEADING_DOCTYPE, "");
    return `<!doctype html><meta http-equiv="Content-Security-Policy" content="${HTML_NOTE_CSP}">${
        nonce ? loadedSentinel(nonce) : ""
    }${rest}`;
};

/** What our sentinel posts to the viewer once the document it sits in has finished loading. */
export const HTML_NOTE_LOADED_KEY = "genosHtmlNoteLoaded";

/**
 * The one script of ours inside the frame, right after the policy and before any author markup.
 *
 * It exists to catch a page that navigates ITSELF while it is still being parsed: such a page
 * replaces its own document before the first `load`, so the viewer would see one `load` event (the
 * replacement's) and a load counter alone would show the replacement page as if it were the note.
 * The sentinel removes itself from the DOM (so no later script can read the nonce out of the
 * markup), then posts the nonce to the parent when the ORIGINAL document finishes loading. A
 * document that was replaced never gets there: the viewer sees a `load` with no matching message and
 * treats the frame as navigated. This is a one-way, constant signal, not a bridge: the viewer reads
 * only whether the message carrying its own nonce arrived, and never uses any data from the page.
 *
 * `nonce` is generated per frame by the viewer from `crypto.randomUUID()`; it is hex and dashes, so
 * it cannot break out of the string. The CSP above allows it as inline script.
 */
const loadedSentinel = (nonce: string): string =>
    `<script>(function(n){var s=document.currentScript;if(s&&s.parentNode)s.parentNode.removeChild(s);` +
    `addEventListener("load",function(){try{parent.postMessage({${HTML_NOTE_LOADED_KEY}:n},"*")}catch(e){}})` +
    `})(${JSON.stringify(nonce.replace(/[^0-9a-zA-Z-]/g, ""))})</script>`;

/** The family name the read endpoint takes for a note type number. */
export const htmlNoteFamily = (noteType: number): "personal" | "task" | "chat" =>
    noteType === 2 ? "task" : noteType === 3 ? "chat" : "personal";
