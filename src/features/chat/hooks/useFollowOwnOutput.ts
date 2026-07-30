import { useCallback, useRef } from "react";

import {
    FollowOutputDecision,
    resolveFollowOutput,
    resolveOwnAppend,
} from "../utils/resolveFollowOutput";

interface UseFollowOwnOutputProps<T> {
    /** The rendered rows, oldest first — Virtuoso's `totalCount` source. */
    rows: readonly T[];
    /** Stable identity of a row. Only the tail's key is ever read. */
    getKey: (row: T) => string;
    /** Is this row authored by the signed-in user? */
    isOwn: (row: T) => boolean;
    /**
     * Identity of the list's SUBJECT (the open chat / thread / task).
     *
     * Load-bearing: this hook's bookkeeping outlives the Virtuoso
     * instance (the chat pane remounts Virtuoso per chat via its `key`,
     * but this hook lives in the component above it). Without a reset, a
     * pending "my own append" from the chat you just left would be
     * consumed by the first count change in the chat you just opened —
     * which, on a deep link, is the background sync landing, and the
     * forced scroll would throw away the jump `useScrollManagement` had
     * already performed.
     */
    resetKey: string;
}

/**
 * Virtuoso `followOutput` callback implementing "stick to the bottom
 * unless I've scrolled up to read history" — see `resolveFollowOutput`
 * for the policy and why `followOutput` is the right primitive.
 *
 * The returned callback is referentially stable and reads its inputs from
 * a ref, so it can't be captured with a stale `rows` closure: Virtuoso
 * samples the prop when `totalCount` changes, which is not guaranteed to
 * be the render that produced the new rows.
 */
export const useFollowOwnOutput = <T>({
    rows,
    getKey,
    isOwn,
    resetKey,
}: UseFollowOwnOutputProps<T>): ((isAtBottom: boolean) => FollowOutputDecision) => {
    const stateRef = useRef<{
        count: number;
        ownAppend: boolean;
        resetKey: string | undefined;
        tailKey: string | undefined;
    }>({ count: 0, ownAppend: false, resetKey: undefined, tailKey: undefined });

    const tail = rows.length > 0 ? rows[rows.length - 1] : undefined;
    const tailKey = tail === undefined ? undefined : getKey(tail);
    const state = stateRef.current;

    // Detection runs during render, not in an effect: Virtuoso applies its
    // props while rendering as our child, which is BEFORE any effect of
    // ours would run. Both branches are keyed on a value they also write,
    // so a repeated render with identical props is a no-op rather than a
    // second, wrong verdict.
    if (state.resetKey !== resetKey) {
        state.resetKey = resetKey;
        state.tailKey = tailKey;
        state.count = rows.length;
        state.ownAppend = false;
    } else if (state.tailKey !== tailKey) {
        state.ownAppend = resolveOwnAppend({
            count: rows.length,
            isOwnTail: tail !== undefined && isOwn(tail),
            prevCount: state.count,
        });
        state.tailKey = tailKey;
        state.count = rows.length;
    }

    return useCallback((isAtBottom: boolean) => {
        const isOwnAppend = stateRef.current.ownAppend;
        // One-shot. A single append must force exactly one follow; leaving
        // the flag up would let an unrelated later count change (a wider
        // history slice patched in behind the tail) inherit the force and
        // yank a reader who has since scrolled up.
        stateRef.current.ownAppend = false;
        return resolveFollowOutput({ isAtBottom, isOwnAppend });
    }, []);
};
