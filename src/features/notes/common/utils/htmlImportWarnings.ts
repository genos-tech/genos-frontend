import { fmt, type Messages } from "../../../../i18n";
import type { HtmlImportWarning } from "../services/importHtmlNote";

/**
 * One line for a scan finding, in the member's language (MIP-2215).
 *
 * The server's own `message` and `fix` are written for the model that authored the page, in English;
 * a person importing a file needs only what will not work. A code the viewer has no line for (the
 * server may learn a new one before this client does) reads as the generic line, never as nothing.
 */
export const htmlWarningText = (t: Messages, warning: HtmlImportWarning): string => {
    const lines = t.notes.htmlImport.warning as Record<string, string>;
    const line = lines[warning.code];
    return line ? fmt(line, { count: warning.count ?? 1 }) : t.notes.htmlImport.fallbackWarning;
};
