import { ReactNode, useCallback, useEffect, useState } from "react";

import {
    DEFAULT_QUICK_REACTIONS,
    QUICK_REACTION_SLOTS,
    QuickReactionsPreferenceContext,
    readPreference,
    STORAGE_KEY,
} from "./quickReactionsState";

export const QuickReactionsPreferenceProvider = ({ children }: { children: ReactNode }) => {
    const [emojis, setEmojis] = useState<string[]>(readPreference);

    useEffect(() => {
        if (typeof window === "undefined") return;
        try {
            window.localStorage.setItem(STORAGE_KEY, JSON.stringify(emojis));
        } catch {
            // Private mode / quota — ignore, the in-memory value still applies.
        }
    }, [emojis]);

    const setEmojiAt = useCallback((index: number, emoji: string) => {
        if (index < 0 || index >= QUICK_REACTION_SLOTS || !emoji) return;
        setEmojis((prev) => {
            const next = [...prev];
            next[index] = emoji;
            return next;
        });
    }, []);

    const reset = useCallback(() => {
        setEmojis([...DEFAULT_QUICK_REACTIONS]);
    }, []);

    return (
        <QuickReactionsPreferenceContext.Provider value={{ emojis, setEmojiAt, reset }}>
            {children}
        </QuickReactionsPreferenceContext.Provider>
    );
};
