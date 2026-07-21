import { UserProps } from "../../../../types/admin";
import { loadSpecificNote } from "./loadSpecificNote";
import { downloadMarkdown, noteBlocksToMarkdown } from "./noteMarkdown";

type ExportNoteArgs = {
    myself: UserProps;
    /** 1 = personal, 2 = task, 3 = chat. Map noteType 4 (shared) to 1. */
    noteType: 1 | 2 | 3;
    noteId: number;
    accessToken: string | null;
    /** Used when the re-fetch fails or the note isn't loaded locally. */
    fallbackTitle?: string;
    fallbackBody?: unknown;
};

/**
 * Download one note as a markdown file.
 *
 * The note is re-fetched so the file reflects the latest SAVED body — the
 * in-memory note object can lag live edits (the editors autosave on a
 * short debounce, so "saved" is at most ~a second behind typing), and the
 * sidebar row menu can export a note that was never opened at all. Custom
 * blocks (mentions, alerts, #refs) are degraded to plain text by the
 * serializer — see noteMarkdown.ts.
 *
 * Shared by the note header's ⋮ menu and the sidebar row menu.
 */
export const exportNoteMarkdown = async ({
    myself,
    noteType,
    noteId,
    accessToken,
    fallbackTitle = "",
    fallbackBody,
}: ExportNoteArgs): Promise<void> => {
    try {
        const fresh = await loadSpecificNote(myself, noteType, noteId, accessToken);
        const body = fresh && !fresh.error ? fresh.body : fallbackBody;
        const md = await noteBlocksToMarkdown(Array.isArray(body) ? body : []);
        downloadMarkdown(fresh?.title || fallbackTitle, md);
    } catch (err) {
        console.error("Markdown export failed:", err);
    }
};
