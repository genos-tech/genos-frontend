import { createContext, ReactNode, useCallback, useContext, useEffect, useState } from "react";

import { useUiSettings } from "./useUiSettings";

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
// Key inside the cross-device `ui_settings` store. As with theme,
// localStorage stays the synchronous first-paint source; the server value
// is adopted once loaded so the choice follows the user across devices.
const UI_SETTINGS_KEY = "bubbleStyle";

const isBubbleStyle = (v: unknown): v is BubbleStyle => v === "bubble" || v === "compact";

const readStored = (): BubbleStyle | null => {
    if (typeof window === "undefined") return null;
    const v = window.localStorage.getItem(STORAGE_KEY);
    return isBubbleStyle(v) ? v : null;
};

const readPreference = (): BubbleStyle => readStored() ?? DEFAULT_STYLE;

interface BubbleStylePreferenceContextValue {
    style: BubbleStyle;
    setStyle: (s: BubbleStyle) => void;
}

const BubbleStylePreferenceContext = createContext<BubbleStylePreferenceContextValue | null>(null);

export const BubbleStylePreferenceProvider = ({ children }: { children: ReactNode }) => {
    const { loaded, get, set } = useUiSettings();
    const [style, setStyleState] = useState<BubbleStyle>(readPreference);

    // Reconcile with the cross-device store once loaded. Same one-shot
    // adopt-on-load as theme, but preserving this hook's "never persist
    // the default" invariant: we only migrate a value UP to the server
    // when this device has an EXPLICIT stored pick (readStored non-null),
    // never the bare default.
    useEffect(() => {
        if (!loaded) return;
        const synced = get<BubbleStyle | null>(UI_SETTINGS_KEY, null);
        if (isBubbleStyle(synced)) {
            setStyleState((prev) => (prev === synced ? prev : synced));
            if (typeof window !== "undefined") {
                try {
                    window.localStorage.setItem(STORAGE_KEY, synced);
                } catch {
                    /* private mode / quota — ignore */
                }
            }
        } else {
            const stored = readStored();
            if (stored) set(UI_SETTINGS_KEY, stored);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [loaded]);

    // Write on the explicit pick only — NOT in an effect keyed on
    // `style`. An effect fires on mount too, which would persist the
    // default and pin every user to whatever the default was on their
    // first load (exactly how the v1 key became un-defaultable).
    const setStyle = useCallback(
        (s: BubbleStyle) => {
            setStyleState(s);
            if (typeof window !== "undefined") {
                try {
                    window.localStorage.setItem(STORAGE_KEY, s);
                } catch {
                    // Private mode / quota — ignore. The choice still applies
                    // for this session; it just won't survive a reload.
                }
            }
            // Durable per-account copy so the choice syncs across devices.
            set(UI_SETTINGS_KEY, s);
        },
        [set]
    );

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
