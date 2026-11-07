import { ReactNode, useCallback, useEffect, useState } from "react";

import {
    applyDensity,
    DEFAULT_DENSITY,
    Density,
    isDensity,
    readStoredDensity,
    storeDensity,
} from "../../theme/density";
import { DensityPreferenceContext } from "./densityContext";
import { useUiSettings } from "./useUiSettings";

/**
 * Row density preference (MIP-1119): Compact 32px, Default 36px,
 * Comfortable 44px rows. Same shape as `useBubbleStylePreference`:
 *
 *  - localStorage is the synchronous source for first paint
 *    (`installActiveDensity()` reads it before React mounts);
 *  - the cross-device `ui_settings` store is adopted once loaded, and an
 *    EXPLICIT local pick is migrated up when the account has none;
 *  - we write only on an explicit `setDensity`, never the default, so
 *    "nothing stored" keeps meaning "never chose".
 *
 * The preference reaches the page as `data-density` on `<html>` (effect
 * below), which `--g-row` keys on; no component re-renders for a switch
 * except the Settings control itself.
 *
 * Mounted inside `ThemePreferenceProvider` at the app root, NOT in a keep-alive
 * Home, so the adopt-on-load effect runs once per session regardless of
 * which Home is active.
 */

// Key inside the cross-device `ui_settings` store.
const UI_SETTINGS_KEY = "density";

export const DensityPreferenceProvider = ({ children }: { children: ReactNode }) => {
    const { loaded, get, set } = useUiSettings();
    const [density, setDensityState] = useState<Density>(
        () => readStoredDensity() ?? DEFAULT_DENSITY
    );

    // One-shot adopt-on-load, as theme and bubble style do. Synced value wins
    // (that is what makes the choice follow the user); with none on the
    // account, an explicit local pick moves up so it starts syncing.
    useEffect(() => {
        if (!loaded) return;
        const synced = get<Density | null>(UI_SETTINGS_KEY, null);
        if (isDensity(synced)) {
            setDensityState((prev) => (prev === synced ? prev : synced));
            storeDensity(synced);
        } else {
            const stored = readStoredDensity();
            if (stored) set(UI_SETTINGS_KEY, stored);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [loaded]);

    // The attribute IS the switch; see `theme/density.ts`.
    useEffect(() => {
        applyDensity(density);
    }, [density]);

    const setDensity = useCallback(
        (d: Density) => {
            setDensityState(d);
            storeDensity(d);
            set(UI_SETTINGS_KEY, d);
        },
        [set]
    );

    return (
        <DensityPreferenceContext.Provider value={{ density, setDensity }}>
            {children}
        </DensityPreferenceContext.Provider>
    );
};
