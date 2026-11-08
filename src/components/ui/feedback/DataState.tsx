import { ReactNode } from "react";

import { EmptyState, EmptyStateProps } from "./EmptyState";
import { ErrorState, ErrorStateProps } from "./ErrorState";

/**
 * The one wrapper for a surface that loads data (MIP-1276):
 * skeleton -> content, a failure with Retry, an empty state.
 *
 * Precedence is the part every hand-rolled copy got wrong:
 *
 *   1. `hasData`         -> the content. A refresh that FAILED keeps the rows
 *                           on screen (a dropped connection must not wipe a
 *                           list; MIP-973), so `error` is ignored here.
 *   2. `loading`         -> the `skeleton` the caller passes (it knows the
 *                           shape: rows, lines, a spinner).
 *   3. `error`           -> `ErrorState` with Retry. A failed request is NOT an
 *                           empty answer: never fall through to "No X yet".
 *   4. `empty` supplied  -> `EmptyState` (the request worked, there is nothing).
 *   5. otherwise         -> the content (a surface that draws its own empty).
 *
 * `hasData` is the caller's call: fold `!loading` into it to show the skeleton
 * during a user-asked refresh (GitHub repo access does), leave it out to keep
 * the old rows on screen meanwhile (the default for a background refresh).
 *
 * Retry sets `loading` again on the caller's side; because `loading` outranks
 * `error`, the skeleton shows during the retry and no stale error lingers.
 */
type DataStateProps = {
    /** There is something to show (rows, a note, a chart series). */
    hasData: boolean;
    /** A request is in flight. */
    loading: boolean;
    /** The latest request failed. */
    error: boolean;
    /** Shown while loading with nothing to show. */
    skeleton: ReactNode;
    /** What to show when the request succeeded and returned nothing. */
    empty?: EmptyStateProps;
    /** `onRetry` and `title` are required; the rest follows the size below. */
    errorState: Omit<ErrorStateProps, "size" | "fill">;
    /** Same sizes as `EmptyState`/`ErrorState`, applied to both. */
    size?: "md" | "sm" | "xs";
    fill?: boolean;
    children?: ReactNode;
};

export const DataState = ({
    hasData,
    loading,
    error,
    skeleton,
    empty,
    errorState,
    size,
    fill,
    children,
}: DataStateProps) => {
    if (hasData) return <>{children}</>;
    if (loading) return <>{skeleton}</>;
    if (error) return <ErrorState {...errorState} fill={fill} size={size} />;
    // `??`: an `undefined` here would override the size/fill the caller put on `empty`.
    if (empty) {
        return <EmptyState {...empty} fill={fill ?? empty.fill} size={size ?? empty.size} />;
    }
    return <>{children}</>;
};
