import { useCallback, useState } from "react";

/**
 * Tracks in-flight uploads with a counter so callers can flip a single
 * number into the `FileUploadStatusBadge` (or any custom visual). `wrap`
 * decorates an async upload function so it bumps the counter on entry
 * and decrements in a `finally` (so the counter still reaches zero after
 * rejected uploads).
 *
 * Primary consumer: each editor's `uploadFile` callback — wrapping
 * keeps the call sites a single line ("`uploadFile = wrap(uploadFile)`")
 * even when upload work spans BlockNote's internal flow plus the
 * editor's own `pendingFiles` loop.
 *
 * Lives in its own module (separate from `FileUploadProgress.tsx`) so
 * React Fast Refresh stays happy — that file only exports components.
 */
export const useUploadCounter = () => {
    const [activeCount, setActiveCount] = useState(0);

    const wrap = useCallback(<Args extends unknown[], R>(fn: (...args: Args) => Promise<R>) => {
        return async (...args: Args): Promise<R> => {
            setActiveCount((c) => c + 1);
            try {
                return await fn(...args);
            } finally {
                setActiveCount((c) => Math.max(0, c - 1));
            }
        };
    }, []);

    return { activeCount, wrap };
};
