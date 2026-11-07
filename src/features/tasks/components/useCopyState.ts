import { useState } from "react";

const COPIED_FEEDBACK_MS = 1200;

/** Click-to-copy state shared by the task id controls. */
export const useCopyState = () => {
    const [copied, setCopied] = useState(false);
    const onClick = (text: string) => (event: React.SyntheticEvent) => {
        // Task ID chips are routinely nested inside row click handlers
        // (open task, navigate to thread, etc.). Without stopPropagation
        // a click would both copy AND navigate, which is surprising.
        event.stopPropagation();
        if (!text) return;
        navigator.clipboard
            .writeText(text)
            .then(() => {
                setCopied(true);
                window.setTimeout(() => setCopied(false), COPIED_FEEDBACK_MS);
            })
            .catch(() => {
                // Clipboard API rejected (insecure context, permissions
                // denied). Swallow — the chip is non-essential.
            });
    };
    return { copied, onClick };
};
