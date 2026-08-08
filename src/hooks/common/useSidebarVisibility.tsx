import { useCallback } from "react";

import { useUiSettings } from "./useUiSettings";

/**
 * Which sidebar entries the user has chosen to show. Backed by the
 * cross-device `ui_settings` store (key `sidebarVisibility`) so the choice
 * follows the user to another device, exactly like theme / bubble style.
 *
 * The stored shape is a flat `{ [key]: boolean }` map. A KEY THAT IS ABSENT
 * MEANS "visible" — we only ever persist an explicit `false` for a hidden
 * item (and drop the key again when it's re-shown). That keeps the blob
 * small and, more importantly, makes "show everything" the default for any
 * account that never touched the setting, and for any item added to the
 * sidebar later.
 *
 * Genos is deliberately NOT toggleable — it's the AI entry point and is
 * always rendered — so it has no key here and no switch in Settings.
 */

// Every hideable sidebar entry. Genos is intentionally excluded (always on).
export const HIDEABLE_SIDEBAR_ITEMS = ["inbox", "chats", "tasks", "notes", "todo"] as const;

export type SidebarItemKey = (typeof HIDEABLE_SIDEBAR_ITEMS)[number];

const UI_SETTINGS_KEY = "sidebarVisibility";

type VisibilityMap = Partial<Record<SidebarItemKey, boolean>>;

export interface SidebarVisibility {
    /** True while the cross-device store is still loading (consumers can
     *  render optimistically off the local cache regardless). */
    loading: boolean;
    /** Whether a given entry should be rendered. Absent key ⇒ visible. */
    isVisible: (key: SidebarItemKey) => boolean;
    /** Show / hide an entry. Persists only explicit `false`; re-showing an
     *  item deletes its key so the map stays minimal. */
    setVisible: (key: SidebarItemKey, visible: boolean) => void;
}

export const useSidebarVisibility = (): SidebarVisibility => {
    const { loaded, get, set } = useUiSettings();

    const map = get<VisibilityMap>(UI_SETTINGS_KEY, {});

    const isVisible = useCallback(
        (key: SidebarItemKey): boolean => {
            // Absent / non-false ⇒ visible; only an explicit `false` hides.
            return map[key] !== false;
        },
        [map]
    );

    const setVisible = useCallback(
        (key: SidebarItemKey, visible: boolean) => {
            const current = get<VisibilityMap>(UI_SETTINGS_KEY, {});
            const next: VisibilityMap = { ...current };
            if (visible) {
                // Re-showing: drop the key so the default ("visible") applies.
                delete next[key];
            } else {
                next[key] = false;
            }
            // Empty map ⇒ delete the whole key (reset to default) rather than
            // persisting `{}`; `set(key, null)` is the store's delete signal.
            set(UI_SETTINGS_KEY, Object.keys(next).length === 0 ? null : next);
        },
        [get, set]
    );

    return { loading: !loaded, isVisible, setVisible };
};
