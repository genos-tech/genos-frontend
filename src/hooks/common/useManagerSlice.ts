import { useInsertionEffect, useMemo, useRef } from "react";

/**
 * A narrow, referentially stable view of one of the big manager objects
 * (`usePM`, `useTM`, `useSM`, `useTEM`, `useCM`), for a subtree that reads only
 * a few of its members (MIP-971).
 *
 * Why: `AppBody` renders about a dozen times for one task click and every
 * manager is a NEW object on every render (an object literal over dozens of
 * `useState`s, with most functions recreated each time). A subtree that takes
 * the whole manager as a prop re-renders on every one of those passes even
 * when none of the members it reads changed, and `memo` cannot help because
 * the prop itself is always new. A slice is a new object only when one of the
 * VALUES it carries changes, so `memo` on the subtree does its job.
 *
 * A slice spec names two kinds of member:
 *
 *  - `values`: state, and functions that are already stable (React `useState`
 *    setters, `useCallback`s). Carried as they are. The slice changes when one
 *    of them changes, which is a real change for a `useCallback` whose own
 *    dependencies moved, so a consumer that lists it in an effect's dependencies
 *    still re-runs it exactly when it did before.
 *  - `latest`: functions the manager recreates on every render (a plain
 *    `const fn = () => ...` in the hook body). The slice carries ONE stable
 *    wrapper per name that calls whatever the manager holds at that moment, the
 *    same "latest ref" idea as `useAvatarContextValue` (MIP-958). Nothing can
 *    call a stale closure, and the function's identity is never a reason for the
 *    slice to change. The wrapper is for event handlers and effects: it reads the
 *    manager as of the last COMMIT, so do not call it while rendering.
 *
 * TypeScript carries the safety net: a subtree typed with the slice type cannot
 * read a member outside its spec.
 *
 * The spec must be a constant: its lengths are the hook's dependency count.
 */

type FunctionKeys<M> = {
    [K in keyof M]: M[K] extends (...args: never[]) => unknown ? K : never;
}[keyof M];

export type SliceSpec<M> = {
    readonly values: readonly (keyof M)[];
    readonly latest: readonly FunctionKeys<M>[];
};

/** The type of the slice a spec describes. */
export type SliceOf<M, S extends SliceSpec<M>> = Pick<
    M,
    S["values"][number] | S["latest"][number]
>;

export const useManagerSlice = <M extends object, S extends SliceSpec<M>>(
    manager: M,
    spec: S
): SliceOf<M, S> => {
    // The newest manager, as of the last commit. Written in an insertion effect
    // (before any layout or passive effect and before any event can run), not
    // during render, so a render React throws away cannot leave it pointing at
    // a function that was never committed.
    const managerRef = useRef<M>(manager);
    useInsertionEffect(() => {
        managerRef.current = manager;
    });

    // One wrapper per `latest` name, created once: its identity never changes.
    const wrappers = useMemo(() => {
        const made: Record<PropertyKey, unknown> = {};
        for (const key of spec.latest) {
            made[key as PropertyKey] = (...args: unknown[]) => {
                const current = managerRef.current;
                const fn = current[key as keyof M] as unknown as (...a: unknown[]) => unknown;
                return fn.apply(current, args);
            };
        }
        return made;
        // The spec is a module constant; it never changes for a given call site.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const values = spec.values.map((key) => manager[key]);

    return useMemo(() => {
        const slice: Record<PropertyKey, unknown> = {};
        spec.values.forEach((key, i) => {
            slice[key as PropertyKey] = values[i];
        });
        for (const key of spec.latest) slice[key as PropertyKey] = wrappers[key as PropertyKey];
        return slice as SliceOf<M, S>;
        // The slice changes exactly when one of its values does. `values` is a
        // list of the same length on every render (the spec is a constant).
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, values);
};
