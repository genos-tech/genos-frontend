import { ReactNode, useCallback, useEffect, useMemo, useState } from "react";

import {
    BubbleStyle,
    BubbleStylePreferenceContext,
    isBubbleStyle,
    readPreference,
    readStored,
    STORAGE_KEY,
    UI_SETTINGS_KEY,
} from "./bubbleStylePreferenceState";
import { useUiSettings } from "./uiSettingsState";

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

    // Memoised: the provider re-renders with every App-root write (its `children`
    // is a new element each time), and a fresh value object would re-render every
    // consumer, including the Spotlight conversation, on each keystroke (MIP-904).
    const value = useMemo(() => ({ style, setStyle }), [style, setStyle]);

    return (
        <BubbleStylePreferenceContext.Provider value={value}>
            {children}
        </BubbleStylePreferenceContext.Provider>
    );
};
