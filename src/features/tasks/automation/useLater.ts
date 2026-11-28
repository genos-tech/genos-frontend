import { useCallback, useEffect, useRef } from "react";

/** `setTimeout` that does not outlive the component: focus moves wait for a menu or a view. */
export const useLater = () => {
    const timers = useRef(new Set<number>());
    useEffect(() => {
        const pending = timers.current;
        return () => {
            pending.forEach((id) => window.clearTimeout(id));
            pending.clear();
        };
    }, []);
    return useCallback((run: () => void, ms: number) => {
        const id = window.setTimeout(() => {
            timers.current.delete(id);
            run();
        }, ms);
        timers.current.add(id);
        return id;
    }, []);
};
