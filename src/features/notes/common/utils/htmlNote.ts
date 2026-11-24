/**
 * HTML notes (MIP-2215, MIP-2228): a note whose body is one HTML page, shown read-only in a sandboxed
 * frame.
 *
 * THE BOUNDARY IS THE SANDBOX PLUS THE CSP, never a sanitizer. The page is untrusted: it is shown in
 * an `<iframe sandbox="allow-scripts">` (no `allow-same-origin`, so the frame has an opaque origin and
 * can reach no cookie, storage or parent DOM), and the API route that serves it
 * (`GET <api>/h/<token>`, genos-api `services/html_note_pages.py`) sends the Content-Security-Policy
 * that lets the page load nothing from the network.
 *
 * It is NOT a `srcdoc` frame (MIP-2228): a `srcdoc` document inherits the embedding app's CSP, and the
 * production app's `script-src 'self'` blocked every inline script of every page.
 */

import type { NoteBodyFormat } from "../../../../types/notes";

/** The one `sandbox` value the frame ever gets. `allow-same-origin`, `allow-popups`, `allow-forms`,
 *  `allow-top-navigation` and `allow-modals` are all deliberately absent. The route's own header
 *  policy carries the same `sandbox allow-scripts`, so the page is sandboxed even outside this frame. */
export const HTML_NOTE_SANDBOX = "allow-scripts";

/** True for a note shown as an HTML page. Anything else (undefined included) is an ordinary note. */
export const isHtmlNote = (
    note: { bodyFormat?: NoteBodyFormat | string | null } | null | undefined
) => note?.bodyFormat === "html";

/** What the page's first script posts to the viewer once the document it sits in has finished
 *  loading, with the nonce the API gave the viewer for this URL. A one-way, constant signal: the
 *  viewer reads only whether the message carrying its own nonce arrived, never any data from the
 *  page (the self-navigation guard in `HtmlNoteView`; the script is the server's, in
 *  `html_note_pages.document`). */
export const HTML_NOTE_LOADED_KEY = "genosHtmlNoteLoaded";

/** The family name the read endpoints take for a note type number. */
export const htmlNoteFamily = (noteType: number): "personal" | "task" | "chat" =>
    noteType === 2 ? "task" : noteType === 3 ? "chat" : "personal";
