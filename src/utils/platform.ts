/**
 * Returns true when running on macOS. Mirrors the detection used by
 * `useGlobalServiceShortcut`, so any UI that displays a modifier key (e.g.
 * tooltips, the Settings keyboard-shortcut card) shows the same combo the
 * shortcut listener actually responds to.
 */
export const isMac = (): boolean => {
    if (typeof navigator === "undefined") return false;
    const platform = (navigator.platform || "").toLowerCase();
    if (platform.includes("mac")) return true;
    return /macintosh|mac os x/i.test(navigator.userAgent || "");
};

/**
 * Display strings for the global service-shortcut modifier:
 *   - Mac:   Ctrl + ⌘
 *   - Other: Ctrl + Alt
 */
export const getServiceShortcutModifierKeys = (): string[] =>
    isMac() ? ["Ctrl", "⌘"] : ["Ctrl", "Alt"];
