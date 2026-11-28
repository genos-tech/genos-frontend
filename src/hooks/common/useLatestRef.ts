import { useLayoutEffect, useRef } from "react";

/**
 * A ref that always holds the value of the last committed render.
 *
 * For an effect that must READ a value without RUNNING when it changes: listing a
 * manager object or a function that is re-created on every render would re-run the
 * effect on each of them. The ref is written in a layout effect, so it is current
 * before any `useEffect` of the same commit reads it.
 */
export function useLatestRef<T>(value: T) {
    const ref = useRef(value);
    useLayoutEffect(() => {
        ref.current = value;
    });
    return ref;
}
