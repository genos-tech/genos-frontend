import { useSyncExternalStore } from "react";

import { getShortcutsVersion, subscribeShortcuts } from "./overrides";

/**
 * Re-render when the member's chords change (MIP-2413). A component that prints a rebindable
 * shortcut with `shortcutText` calls this, or its text stays on the old keys.
 */
export const useShortcutsVersion = (): number =>
    useSyncExternalStore(subscribeShortcuts, getShortcutsVersion, getShortcutsVersion);
