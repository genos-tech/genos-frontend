import { useEffect, useState } from "react";

/**
 * When the first-screen prompts (notifications bar, install banner) may appear (MIP-1866).
 *
 * A new account used to see both prompts above its first content. They wait until the person
 * has seen the app: from the second visit on, or from the first action of the first visit.
 *
 *   - A visit is counted once per browser session (a sessionStorage flag), in localStorage.
 *   - The decision is made once per session and kept in sessionStorage, so a remount does not
 *     flip it. "open" once the visit count was already at least 1 before this session, or once
 *     the person has pointed or typed in this session.
 *
 * Storage can be blocked or throw (private windows): every access is guarded, and without it the
 * prompts simply wait for the first action.
 */
const VISITS_KEY = "genos:visitCount";
const DECISION_KEY = "genos:firstRunPromptGate";

const readVisits = (): number => {
    try {
        return Number(localStorage.getItem(VISITS_KEY)) || 0;
    } catch {
        return 0;
    }
};

const writeVisits = (count: number) => {
    try {
        localStorage.setItem(VISITS_KEY, String(count));
    } catch {
        // Storage is blocked: the count is simply not kept.
    }
};

// "open" | "closed" | null (not decided yet this session).
const readDecision = (): "open" | "closed" | null => {
    try {
        const value = sessionStorage.getItem(DECISION_KEY);
        return value === "open" || value === "closed" ? value : null;
    } catch {
        return null;
    }
};

const writeDecision = (value: "open" | "closed") => {
    try {
        sessionStorage.setItem(DECISION_KEY, value);
    } catch {
        // Storage is blocked: the decision is made again on the next mount.
    }
};

export const useFirstRunPromptGate = (): boolean => {
    const [open, setOpen] = useState<boolean>(() => readDecision() === "open");

    // Count this visit and decide, once per session.
    useEffect(() => {
        if (readDecision() !== null) return;
        const before = readVisits();
        writeVisits(before + 1);
        const seenAppBefore = before >= 1;
        writeDecision(seenAppBefore ? "open" : "closed");
        if (seenAppBefore) setOpen(true);
    }, []);

    // A first action in this visit opens the prompts for the rest of the session.
    useEffect(() => {
        if (open) return undefined;
        const onAction = () => {
            writeDecision("open");
            setOpen(true);
        };
        window.addEventListener("pointerdown", onAction, { once: true, capture: true });
        window.addEventListener("keydown", onAction, { once: true, capture: true });
        return () => {
            window.removeEventListener("pointerdown", onAction, { capture: true });
            window.removeEventListener("keydown", onAction, { capture: true });
        };
    }, [open]);

    return open;
};
