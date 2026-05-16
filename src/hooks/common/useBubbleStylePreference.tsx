import { createContext, ReactNode, useCallback, useContext, useEffect, useState } from "react";

/**
 * Bubble layout preference: chooses between the WhatsApp/Teams-style
 * flexible-width balloons ("bubble") and a Slack-style full-width row
 * ("compact"). Each chat bubble component reads this hook and branches
 * its layout accordingly.
 *
 * Persists to localStorage as a single string so the choice survives
 * reloads. Mirrors the scalar pattern of `useThemePreference` since
 * there's only one discrete value.
 */

export type BubbleStyle = "bubble" | "compact";

const STORAGE_KEY = "weikiy-bubble-style-preference";

const readPreference = (): BubbleStyle => {
    if (typeof window === "undefined") return "bubble";
    const v = window.localStorage.getItem(STORAGE_KEY);
    return v === "bubble" || v === "compact" ? v : "bubble";
};

interface BubbleStylePreferenceContextValue {
    style: BubbleStyle;
    setStyle: (s: BubbleStyle) => void;
}

const BubbleStylePreferenceContext = createContext<BubbleStylePreferenceContextValue | null>(null);

export const BubbleStylePreferenceProvider = ({ children }: { children: ReactNode }) => {
    const [style, setStyleState] = useState<BubbleStyle>(readPreference);

    useEffect(() => {
        if (typeof window === "undefined") return;
        try {
            window.localStorage.setItem(STORAGE_KEY, style);
        } catch {
            // Private mode / quota — ignore. Default is the safer fallback.
        }
    }, [style]);

    const setStyle = useCallback((s: BubbleStyle) => {
        setStyleState(s);
    }, []);

    return (
        <BubbleStylePreferenceContext.Provider value={{ style, setStyle }}>
            {children}
        </BubbleStylePreferenceContext.Provider>
    );
};

export const useBubbleStylePreference = (): BubbleStylePreferenceContextValue => {
    const ctx = useContext(BubbleStylePreferenceContext);
    if (!ctx) {
        return { style: "bubble", setStyle: () => {} };
    }
    return ctx;
};
