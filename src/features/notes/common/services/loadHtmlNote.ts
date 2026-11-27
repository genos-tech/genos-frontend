import axios from "axios";

import { v3ApiBaseURL } from "../../../../services/v3Api";
import { htmlNoteFamily } from "../utils/htmlNote";

/** What `GET /api/v3/notes/<family>/<id>/html/frame` answers (MIP-2228), ready for the viewer. */
export type HtmlNoteFrame = {
    /** Absolute URL of the page on the API host: `<api>/h/<signed token>`. */
    url: string;
    /** The secret the page's first script posts back once the ORIGINAL document has loaded. */
    nonce: string;
    rev: number;
    size: number;
    warnings: { code: string; message: string; fix: string; count?: number }[];
    savedAt: string;
    /** True for a page the server drew itself: the viewer then opens the in-app link a click in it
     *  posts (MIP-2417). Anything but a literal `true` is false. */
    links: boolean;
};

/** The API's own page route: `/h/<signed token>`. Anything else is not a page this viewer may frame. */
const PAGE_PATH = /^\/h\/[A-Za-z0-9_\-:.]+$/;

/**
 * Ask the API for the single-use URL of an HTML note's page. The note's own ACL decides who gets one:
 * a missing note, one the caller cannot read and the switch being off all answer 404, so the viewer
 * shows one "couldn't load" state for all of them with a Retry. Never cached on the client: a reload
 * must show the latest page, and the answer is `private, no-store`.
 */
export const loadHtmlNoteFrame = async (
    noteType: number,
    noteId: number,
    accessToken: string | null,
    signal?: AbortSignal
): Promise<HtmlNoteFrame> => {
    if (!accessToken) throw new Error("not signed in");
    const base = v3ApiBaseURL();
    const res = await axios.get<{
        path: string;
        nonce: string;
        rev: number;
        size: number;
        warnings?: HtmlNoteFrame["warnings"];
        saved_at: string;
        links?: boolean;
    }>(`${base}/api/v3/notes/${htmlNoteFamily(noteType)}/${noteId}/html/frame`, {
        headers: { Authorization: `Bearer ${accessToken}` },
        withCredentials: true,
        // The viewer shows its own error state with a Retry; a toast on top would say it twice.
        suppressErrorToast: true,
        signal,
    });
    if (!PAGE_PATH.test(res.data.path)) throw new Error("unexpected page path");
    return {
        url: `${base}${res.data.path}`,
        nonce: res.data.nonce,
        rev: res.data.rev,
        size: res.data.size,
        warnings: res.data.warnings ?? [],
        savedAt: res.data.saved_at,
        links: res.data.links === true,
    };
};
