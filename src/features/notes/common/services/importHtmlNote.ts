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

/** The page's own `<title>`, read by an inert parser (no script runs, nothing is fetched). */
export const htmlTitleOf = (html: string): string => {
    try {
        return (
            new DOMParser().parseFromString(html, "text/html").title.replace(/\s+/g, " ").trim() ||
            ""
        );
    } catch {
        return "";
    }
};

/** True for a file name the import treats as an HTML page. */
export const isHtmlFileName = (name: string): boolean => /\.html?$/i.test(name);
