import axios from "axios";

import { v3ApiBaseURL } from "../../../../services/v3Api";
import { htmlNoteFamily } from "../utils/htmlNote";

/** What `GET /api/v3/notes/<family>/<id>/html` answers (MIP-2214). */
export type HtmlNotePage = {
    html: string;
    rev: number;
    size: number;
    warnings: { code: string; message: string; fix: string; count?: number }[];
    savedAt: string;
};

/**
 * Fetch the saved page of an HTML note. The note's own ACL decides who may read it: a missing note,
 * one the caller cannot read and the switch being off all answer 404, so the viewer shows one
 * "couldn't load" state for all of them with a Retry. Never cached on the client: a reload must show
 * the latest page, and the answer is `private, no-store`.
 */
export const loadHtmlNote = async (
    noteType: number,
    noteId: number,
    accessToken: string | null,
    signal?: AbortSignal
): Promise<HtmlNotePage> => {
    if (!accessToken) throw new Error("not signed in");
    const res = await axios.get<{
        html: string;
        rev: number;
        size: number;
        warnings?: HtmlNotePage["warnings"];
        saved_at: string;
    }>(`${v3ApiBaseURL()}/api/v3/notes/${htmlNoteFamily(noteType)}/${noteId}/html`, {
        headers: { Authorization: `Bearer ${accessToken}` },
        withCredentials: true,
        // The viewer shows its own error state with a Retry; a toast on top would say it twice.
        suppressErrorToast: true,
        signal,
    });
    return {
        html: res.data.html,
        rev: res.data.rev,
        size: res.data.size,
        warnings: res.data.warnings ?? [],
        savedAt: res.data.saved_at,
    };
};
