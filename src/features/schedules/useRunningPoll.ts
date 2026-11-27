import { useEffect, useRef } from "react";

import { FOLLOW_EVERY_MS } from "./followRun";

/**
 * Reads a list again every few seconds while one of its rows has a run going (MIP-2457), so
 * "Running…" ends when the server says so, whoever started the run. Quiet in a hidden tab.
 */
export const useRunningPoll = (anyRunning: boolean, reload: () => unknown) => {
    const latest = useRef(reload);
    latest.current = reload;
    useEffect(() => {
        if (!anyRunning) return undefined;
        const timer = window.setInterval(() => {
            if (!document.hidden) void latest.current();
        }, FOLLOW_EVERY_MS);
        return () => window.clearInterval(timer);
    }, [anyRunning]);
};
