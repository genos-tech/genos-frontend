import { createContext, useContext } from "react";

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
export const STORAGE_KEY = "genos-bubble-style-preference-v2";
// Key inside the cross-device `ui_settings` store. As with theme,
// localStorage stays the synchronous first-paint source; the server value
// is adopted once loaded so the choice follows the user across devices.
export const UI_SETTINGS_KEY = "bubbleStyle";

export const isBubbleStyle = (v: unknown): v is BubbleStyle => v === "bubble" || v === "compact";

export const readStored = (): BubbleStyle | null => {
    if (typeof window === "undefined") return null;
    const v = window.localStorage.getItem(STORAGE_KEY);
    return isBubbleStyle(v) ? v : null;
};

export const readPreference = (): BubbleStyle => readStored() ?? DEFAULT_STYLE;

interface BubbleStylePreferenceContextValue {
    style: BubbleStyle;
    setStyle: (s: BubbleStyle) => void;
}

export const BubbleStylePreferenceContext =
    createContext<BubbleStylePreferenceContextValue | null>(null);

export const useBubbleStylePreference = (): BubbleStylePreferenceContextValue => {
    const ctx = useContext(BubbleStylePreferenceContext);
    if (!ctx) {
        return { style: DEFAULT_STYLE, setStyle: () => {} };
    }
    return ctx;
};
