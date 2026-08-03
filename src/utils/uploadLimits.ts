/**
 * Per-file upload size limits — the CLIENT half of a limit the server
 * already owns.
 *
 * The ceiling is a paid entitlement (`upload_max_mb`: free 5 / core 25 /
 * pro 50 / max 100 / enterprise 200) enforced by
 * `origin/views/utils/upload_limits.check_upload_size` on every
 * attachment endpoint. This module exists so the browser rejects an
 * oversize file *before* a slow multipart POST that would 413 at the
 * end — it is a courtesy, never the enforcement.
 *
 * It used to be a flat `5 * 1024 * 1024`. That single constant sat
 * BELOW every paid tier's real limit, so the client — not the plan —
 * was the binding constraint: a Max subscriber with a 100 MB
 * entitlement was refused a 6 MB file by their own browser, and the
 * server's "Upgrade your plan to upload larger files" copy was
 * unreachable by construction. Hence every function here now takes the
 * limit rather than reading a constant; `resolveUploadLimitBytes`
 * supplies it.
 *
 * MiB, not MB: `get_upload_max_bytes` computes `mb * 1024 * 1024`, so
 * the client must use the same arithmetic or it would reject files the
 * server would have accepted (a ~4.9% band at every tier).
 */

/**
 * Absolute ceiling, mirroring `upload_limits.ABSOLUTE_MAX_UPLOAD_BYTES`.
 *
 * Used whenever the tier limit is not known: the payload hasn't loaded
 * yet, the fetch failed, or `upload_max_mb` came back null. In all
 * three the correct client behaviour is PERMISSIVE — hand the file to
 * the server and let its 413 be the answer. Defaulting to the smallest
 * limit "to be safe" would recreate the exact bug this module fixes,
 * for anyone on a slow first paint.
 *
 * Note that null does NOT mean unlimited on the server either:
 * `check_upload_size` resolves null → endpoint fallback → this ceiling.
 * Mirroring the number keeps the two halves honest about the same one.
 */
export const ABSOLUTE_MAX_UPLOAD_BYTES = 200 * 1024 * 1024;

/** Quick byte-count formatter used by the rejection toast. Intentionally
 *  not a public API (no localisation, no edge cases past GB) — extract
 *  to its own util if other surfaces need it. */
export const formatBytes = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
};

/**
 * The limit as the user should read it — "50 MB", matching the number on
 * the plans page and in the server's own 413 copy.
 *
 * Deliberately NOT `formatBytes`, which renders the 100 MB tier as
 * "100.0 MB": this is a plan figure, not a measurement, and the two sit
 * side by side in one toast ("big.pdf (104.9 MB)" against a "100 MB"
 * limit).
 */
export const formatLimitLabel = (bytes: number): string =>
    `${Math.round(bytes / (1024 * 1024))} MB`;

/** Description of files that exceeded the per-file size cap, plus the
 *  limit they were measured against. The file shape is small on purpose
 *  so the snackbar can show name + size without retaining the underlying
 *  `File` (which would keep blob memory pinned for the whole toast
 *  lifetime); `limitBytes` rides along so the toast names the number
 *  that actually applied rather than re-deriving one that may since
 *  have changed. */
export type FileSizeRejection = {
    files: { name: string; size: number }[];
    limitBytes: number;
};

export const isFileSizeAllowed = (file: File, limitBytes: number): boolean =>
    file.size <= limitBytes;

/**
 * One-pass split of `files` into "small enough" and "too large" groups.
 * `rejected` is `null` (not an empty wrapper) when nothing failed so
 * call sites can `if (rejected)` without juggling lengths.
 */
export const partitionBySize = (
    files: Iterable<File>,
    limitBytes: number
): { accepted: File[]; rejected: FileSizeRejection | null } => {
    const accepted: File[] = [];
    const rejectedFiles: { name: string; size: number }[] = [];
    for (const file of files) {
        if (isFileSizeAllowed(file, limitBytes)) {
            accepted.push(file);
        } else {
            rejectedFiles.push({ name: file.name, size: file.size });
        }
    }
    return {
        accepted,
        rejected: rejectedFiles.length > 0 ? { files: rejectedFiles, limitBytes } : null,
    };
};
