import { useEffect, useRef } from "react";

import { onTaskOpened } from "../services/taskEvents";

/**
 * Run `callback` after the server has recorded a task open. Debounced so a run
 * of opens (stepping through a list) reloads once. `callback` is read at fire
 * time, so it may close over fresh state.
 */
export const useOnTaskOpened = (callback: () => void, debounceMs: number): void => {
    const callbackRef = useRef(callback);
    callbackRef.current = callback;

    useEffect(() => {
        let timer: number | undefined;
        const unsubscribe = onTaskOpened(() => {
            window.clearTimeout(timer);
            timer = window.setTimeout(() => callbackRef.current(), debounceMs);
        });
        return () => {
            unsubscribe();
            window.clearTimeout(timer);
        };
    }, [debounceMs]);
};
