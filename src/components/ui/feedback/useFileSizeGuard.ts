import { useCallback, useState } from "react";

import {
    FileSizeRejection,
    isFileSizeAllowed,
    MAX_UPLOAD_FILE_SIZE_LABEL,
    partitionBySize,
} from "../../../utils/uploadLimits";

/**
 * State holder + ergonomic wrappers around the per-file size cap.
 *
 * Two surfaces it covers:
 *   - `filterFiles`: pre-flight check for surfaces that *receive* a list
 *     of files (drag-and-drop / file input). Returns only the accepted
 *     files; the rejected ones are stashed for the toast.
 *   - `guardUploadFile`: decorates an editor's `uploadFile` callback so
 *     a single oversize file is rejected before the network call. Both
 *     records the rejection for the toast AND throws so BlockNote's
 *     internal upload pipeline can show its built-in error UI.
 *
 * Pair with `FileSizeRejectionSnackbar` and pass `rejection` /
 * `dismissRejection` straight through.
 */
export const useFileSizeGuard = () => {
    const [rejection, setRejection] = useState<FileSizeRejection | null>(null);

    const dismissRejection = useCallback(() => setRejection(null), []);

    const reportRejection = useCallback((next: FileSizeRejection) => {
        // Coalesce concurrent rejections into the same toast — e.g. a
        // user drops 5 oversize files; we'd rather show one snackbar
        // with all 5 than spawn 5 stacking ones. The dedup is keyed on
        // (name, size) so genuinely-distinct dropped files still all
        // appear, but a noisy retry of the same file doesn't double up.
        setRejection((prev) => {
            if (!prev) return next;
            const seen = new Set(prev.files.map((f) => `${f.name}\u0000${f.size}`));
            const merged = [...prev.files];
            for (const file of next.files) {
                const key = `${file.name}\u0000${file.size}`;
                if (!seen.has(key)) {
                    seen.add(key);
                    merged.push(file);
                }
            }
            return { files: merged };
        });
    }, []);

    const filterFiles = useCallback(
        (files: Iterable<File>): File[] => {
            const { accepted, rejected } = partitionBySize(files);
            if (rejected) reportRejection(rejected);
            return accepted;
        },
        [reportRejection]
    );

    /**
     * Wrap `uploadFile(file)` so it rejects oversize files before any
     * fetch happens. The thrown Error is what BlockNote (and the
     * `pendingFiles` loop in `bnChatEditor` / `bnThreadEditor`) catches
     * to mark the slot as failed.
     */
    const guardUploadFile = useCallback(
        <R>(uploadFile: (file: File) => Promise<R>) => {
            return async (file: File): Promise<R> => {
                if (!isFileSizeAllowed(file)) {
                    reportRejection({ files: [{ name: file.name, size: file.size }] });
                    throw new Error(
                        `File "${file.name}" exceeds the ${MAX_UPLOAD_FILE_SIZE_LABEL} limit`
                    );
                }
                return uploadFile(file);
            };
        },
        [reportRejection]
    );

    return {
        rejection,
        dismissRejection,
        reportRejection,
        filterFiles,
        guardUploadFile,
    };
};
