/**
 * Which attachments can be imported as a note.
 *
 * Matched on the FILE EXTENSION, not the MIME type: uploads are stored
 * under generated names with whatever content type the browser guessed
 * (`.md` is routinely `application/octet-stream` or empty), so the MIME
 * type is the unreliable half. Same set the file picker in
 * `ModalImportMarkdown` accepts.
 */
const IMPORTABLE_EXTENSIONS = [".md", ".markdown", ".txt"];

export const isImportableTextFile = (fileName: string | null | undefined): boolean => {
    if (!fileName) return false;
    const lower = fileName.trim().toLowerCase();
    return IMPORTABLE_EXTENSIONS.some((ext) => lower.endsWith(ext) && lower.length > ext.length);
};
