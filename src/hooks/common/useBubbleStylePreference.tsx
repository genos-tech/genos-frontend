import { createContext, ReactNode, useCallback, useContext, useState } from "react";

/**
 * Bubble layout preference: chooses between the WhatsApp/Teams-style
 * flexible-width balloons ("bubble") and a Slack-style full-width row
 * ("compact"). Each chat bubble component reads this hook and branches
 * its layout accordingly.
 *
 * Persists to localStorage as a single string so the choice survives
 * reloads. Mirrors the scalar pattern of `useThemePreference` since
 * there's only one discrete value.
 *
 * The default is "compact" (the Slack-style full-width row).
 *
 * Two things had to change together to make that default actually
 * reachable, and both are load-bearing:
 *
 *  1. The key is versioned (`…-v2`). The v1 provider persisted on
 *     *mount*, so every browser that ever loaded the app had "bubble"
 *     written under the old key — flipping the fallback alone would
 *     have changed nothing for anyone but a brand-new profile. The
 *     bump retires those implicit writes; the stale v1 entry is inert.
 *  2. We only write on an EXPLICIT `setStyle`. Persisting the
 *     *default* is what made the v1 key un-defaultable in the first
 *     place, and it would make the next default change a no-op too.
 *     Absence of a stored value now genuinely means "user hasn't
 *     chosen", so the default below is the single source of truth.
 */

export type BubbleStyle = "bubble" | "compact";

const DEFAULT_STYLE: BubbleStyle = "compact";

// Bumped from `genos-bubble-style-preference` — see the note above.
// Keep in sync with DEVICE_PREFERENCE_LOCAL_STORAGE_KEYS in
// context/AuthContext.tsx (a PRESERVE list — an unlisted key is wiped
// when a different user signs in on the same device).
const STORAGE_KEY = "genos-bubble-style-preference-v2";

const readPreference = (): BubbleStyle => {
    if (typeof window === "undefined") return DEFAULT_STYLE;
    const v = window.localStorage.getItem(STORAGE_KEY);
    return v === "bubble" || v === "compact" ? v : DEFAULT_STYLE;
};

interface BubbleStylePreferenceContextValue {
    style: BubbleStyle;
    setStyle: (s: BubbleStyle) => void;
}

const BubbleStylePreferenceContext = createContext<BubbleStylePreferenceContextValue | null>(null);

export const BubbleStylePreferenceProvider = ({ children }: { children: ReactNode }) => {
    const [style, setStyleState] = useState<BubbleStyle>(readPreference);

    // Write on the explicit pick only — NOT in an effect keyed on
    // `style`. An effect fires on mount too, which would persist the
    // default and pin every user to whatever the default was on their
    // first load (exactly how the v1 key became un-defaultable).
    const setStyle = useCallback((s: BubbleStyle) => {
        setStyleState(s);
        if (typeof window === "undefined") return;
        try {
            window.localStorage.setItem(STORAGE_KEY, s);
        } catch {
            // Private mode / quota — ignore. The choice still applies
            // for this session; it just won't survive a reload.
        }
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
        return { style: DEFAULT_STYLE, setStyle: () => {} };
    }
    return ctx;
};
