import { useEffect, useRef } from "react";

import { onTaskMetadataSaved } from "../services/taskEvents";

/**
 * Run `callback` after a task's or milestone's metadata is saved. Debounced
 * so a burst of saves (several table edits, a run of board drags) runs it
 * once. `callback` is read at fire time, so it may close over fresh state.
 */
export const useOnTaskMetadataSaved = (callback: () => void, debounceMs: number): void => {
    const callbackRef = useRef(callback);
    callbackRef.current = callback;

    useEffect(() => {
        let timer: number | undefined;
        const unsubscribe = onTaskMetadataSaved(() => {
            window.clearTimeout(timer);
            timer = window.setTimeout(() => callbackRef.current(), debounceMs);
        });
        return () => {
            unsubscribe();
            window.clearTimeout(timer);
        };
    }, [debounceMs]);
};
