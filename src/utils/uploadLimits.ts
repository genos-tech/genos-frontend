/**
 * Hard cap on a single attachment / chat-file upload, in bytes.
 *
 * 5 MB is the prototype's chosen ceiling for two reasons:
 *   1. The Django backend stores attachments on disk and a few legacy
 *      endpoints still serialise them inline as base64 in the response
 *      (see the pre-optimisation `ChildTaskView` for the canonical
 *      example) — keeping individual files small caps the worst-case
 *      payload size before that pattern is fixed everywhere.
 *   2. The product target is chat / task collaboration, not file
 *      hosting; large media should live elsewhere and be linked.
 *
 * If you raise this number, also bump (or audit) the Django
 * `DATA_UPLOAD_MAX_MEMORY_SIZE` / `FILE_UPLOAD_MAX_MEMORY_SIZE` settings
 * so the server-side multipart parser keeps up.
 */
export const MAX_UPLOAD_FILE_SIZE_BYTES = 5 * 1024 * 1024;

/** Human-friendly form of `MAX_UPLOAD_FILE_SIZE_BYTES` for the toast. */
export const MAX_UPLOAD_FILE_SIZE_LABEL = "5 MB";

/** Quick byte-count formatter used by the rejection toast. Intentionally
 *  not a public API (no localisation, no edge cases past GB) — extract
 *  to its own util if other surfaces need it. */
export const formatBytes = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
};

/** Description of files that exceeded the per-file size cap. The shape
 *  is small on purpose so the snackbar can show name + size without
 *  retaining the underlying `File` (which would keep blob memory
 *  pinned for the whole toast lifetime). */
export type FileSizeRejection = {
    files: { name: string; size: number }[];
};

export const isFileSizeAllowed = (file: File): boolean => file.size <= MAX_UPLOAD_FILE_SIZE_BYTES;

/**
 * One-pass split of `files` into "small enough" and "too large" groups.
 * `rejected` is `null` (not an empty wrapper) when nothing failed so
 * call sites can `if (rejected)` without juggling lengths.
 */
export const partitionBySize = (
    files: Iterable<File>
): { accepted: File[]; rejected: FileSizeRejection | null } => {
    const accepted: File[] = [];
    const rejectedFiles: { name: string; size: number }[] = [];
    for (const file of files) {
        if (isFileSizeAllowed(file)) {
            accepted.push(file);
        } else {
            rejectedFiles.push({ name: file.name, size: file.size });
        }
    }
    return {
        accepted,
        rejected: rejectedFiles.length > 0 ? { files: rejectedFiles } : null,
    };
};
