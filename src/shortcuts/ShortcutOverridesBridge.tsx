import { useEffect } from "react";

import { readCache, useUiSettings } from "../hooks/common/uiSettingsState";
import { parseOverrides, SHORTCUT_SETTINGS_KEYS } from "./custom";
import { applyOverrides } from "./overrides";
import type { Platform } from "./registry";

const PLATFORMS: readonly Platform[] = ["mac", "other"];

/**
 * Feeds the account's chords (`ui_settings`) into the shortcut store. Renders nothing.
 *
 * Before the server answers it reads the localStorage mirror, never `get()`: the provider
 * keeps the previous token's blob in memory until the new one arrives, while the mirror is
 * wiped when another user signs in.
 */
export const ShortcutOverridesBridge = () => {
    const { loaded, get } = useUiSettings();
    useEffect(() => {
        const cache = loaded ? null : readCache();
        for (const platform of PLATFORMS) {
            const key = SHORTCUT_SETTINGS_KEYS[platform];
            const raw = cache ? cache[key] : get<unknown>(key, null);
            applyOverrides(platform, parseOverrides(raw, platform));
        }
    }, [loaded, get]);
    return null;
};
