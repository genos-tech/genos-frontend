import axios from "axios";

import { v3ApiBaseURL } from "../../../../services/v3Api";

/** What the scan found in the page (`html_notes._ADVICE` on the server): the code names the problem,
 *  the viewer words it in the member's language and falls back to the server's English `message`. */
export type HtmlImportWarning = {
    code: string;
    message: string;
    fix?: string;
    count?: number;
};

/** Where the page becomes a note: the same four places `create_note` has. */
export type HtmlImportTarget =
    | { kind: "personal"; folderId?: number | null }
    | { kind: "team"; folderId: number }
    | { kind: "task"; projectId: number; taskId: number }
    | { kind: "chat"; chatId: string; threadId?: string | null };

export type HtmlImportResult =
    | {
          status: "created";
          noteId: number;
          noteType: "personal" | "task" | "chat";
          title: string;
          warnings: HtmlImportWarning[];
      }
    // The plan has no HTML notes (Free): nothing was stored, and that is an answer, not an error.
    | { status: "not-on-plan"; yourPlan: string | null }
    // A refusal that says what to do (size, count, rate, a folder that is not yours...), in English
    // as the server wrote it.
    | { status: "refused"; httpStatus: number; reason: string };

const targetFields = (target: HtmlImportTarget): Record<string, unknown> => {
    switch (target.kind) {
        case "personal":
            return {
                note_type: "personal",
                ...(target.folderId != null ? { folder_id: target.folderId } : {}),
            };
        case "team":
            return { note_type: "team", folder_id: target.folderId };
        case "task":
            return { note_type: "task", project_id: target.projectId, task_id: target.taskId };
        case "chat":
            return {
                note_type: "chat",
                chat_id: target.chatId,
                ...(target.threadId ? { thread_id: target.threadId } : {}),
            };
    }
};

/**
 * Import a `.html` file as a new HTML note through `POST /api/v3/notes/html/import/`, which calls
 * the MCP tool `save_html_note`'s own function: the plan gate, the size, count and rate limits, the
 * scan and every access check are the server's, and this only reports what it said.
 */
export const importHtmlNote = async (args: {
    accessToken: string;
    teamId: string;
    html: string;
    title: string;
    target: HtmlImportTarget;
}): Promise<HtmlImportResult> => {
    try {
        const res = await axios.post<{
            saved: boolean;
            note_id?: number;
            note_type?: "personal" | "task" | "chat";
            title?: string;
            warnings?: HtmlImportWarning[];
            your_plan?: string | null;
        }>(
            `${v3ApiBaseURL()}/api/v3/notes/html/import/`,
            {
                team_id: args.teamId,
                html: args.html,
                title: args.title,
                ...targetFields(args.target),
            },
            {
                headers: { Authorization: `Bearer ${args.accessToken}` },
                withCredentials: true,
                // The dialog and the folder result say what happened; a toast on top would say it twice.
                suppressErrorToast: true,
            }
        );
        if (!res.data.saved || res.data.note_id == null) {
            return { status: "not-on-plan", yourPlan: res.data.your_plan ?? null };
        }
        return {
            status: "created",
            noteId: res.data.note_id,
            noteType: res.data.note_type ?? "personal",
            title: res.data.title ?? args.title,
            warnings: res.data.warnings ?? [],
        };
    } catch (error) {
        if (axios.isAxiosError(error)) {
            const data = error.response?.data as { error?: string } | undefined;
            return {
                status: "refused",
                httpStatus: error.response?.status ?? 0,
                reason: data?.error ?? error.message,
            };
        }
        return {
            status: "refused",
            httpStatus: 0,
            reason: error instanceof Error ? error.message : String(error),
        };
    }
};

const NAMED_ENTITIES: Record<string, string> = {
    amp: "&",
    lt: "<",
    gt: ">",
    quot: '"',
    apos: "'",
    nbsp: " ",
};

const decodeEntity = (_whole: string, body: string): string => {
    if (body[0] === "#") {
        const code =
            body[1] === "x" || body[1] === "X"
                ? parseInt(body.slice(2), 16)
                : Number(body.slice(1));
        return Number.isInteger(code) && code > 0 && code <= 0x10ffff
            ? String.fromCodePoint(code)
            : "";
    }
    return NAMED_ENTITIES[body.toLowerCase()] ?? "";
};

/**
 * The page's own `<title>`, as the default name of the note (the server reads it again on save).
 *
 * Read by scanning the text, never by parsing the file into a document: the file is untrusted, and
 * a parser is more than a title needs. The scan moves forward only (linear), takes the text between
 * the first `<title ...>` and the next `</title`, decodes the few entities a title has and folds
 * whitespace; anything unexpected reads as "no title" and the file name is used instead.
 */
export const htmlTitleOf = (html: string): string => {
    // ASCII-only lowercase keeps every index of `lower` the same as in `html`.
    const lower = html.replace(/[A-Z]/g, (c) => c.toLowerCase());
    let from = 0;
    for (;;) {
        const open = lower.indexOf("<title", from);
        if (open === -1) return "";
        const after = lower[open + 6];
        // `<titlefoo>` is some other tag.
        if (after === ">" || after === "/" || (after !== undefined && /\s/.test(after))) {
            const gt = lower.indexOf(">", open + 6);
            if (gt === -1) return "";
            const close = lower.indexOf("</title", gt + 1);
            if (close === -1) return "";
            return html
                .slice(gt + 1, close)
                .replace(/&(#x?[0-9a-f]{1,8}|[a-z]{2,6});/gi, decodeEntity)
                .replace(/\s+/g, " ")
                .trim()
                .slice(0, 255);
        }
        from = open + 6;
    }
};

/** True for a file name the import treats as an HTML page. */
export const isHtmlFileName = (name: string): boolean => /\.html?$/i.test(name);
