import { useCallback, useEffect, useMemo, useState, type CSSProperties } from "react";

import { buildRoles, type Mode } from "../../theme/tokens/roles";
import { roleVars } from "../../theme/tokens/tokenStyles";

/**
 * The marketing pages paint with the app's own colour roles (MIP-1232).
 *
 * They don't mount the app's theme provider (no auth stack, no settings), so
 * instead of copying hex values they build the same roles the app builds for
 * the default purple theme and publish them as `--lp-*` variables on the page
 * root. `lp.css` only ever reads those variables: change a role in
 * `theme/tokens/roles.ts` and the LP follows, light and dark alike.
 */
const varsFor = (mode: Mode): CSSProperties => {
    const out: Record<string, string> = {};
    for (const [key, value] of roleVars(buildRoles("purple", mode))) {
        out[`--lp-${key}`] = value;
    }
    return out as CSSProperties;
};

const STORAGE_KEY = "genos-lp-mode";

const initialMode = (): Mode => {
    try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored === "light" || stored === "dark") return stored;
    } catch {
        // Storage blocked (private mode): fall through to the OS preference.
    }
    if (typeof window !== "undefined" && window.matchMedia) {
        return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
    }
    return "light";
};

/**
 * Light or dark for a marketing page: the visitor's stored choice, else the OS
 * preference. The toggle persists the choice (best effort) so the next page of
 * the site opens the same way.
 */
export const useLpMode = (): {
    mode: Mode;
    toggleMode: () => void;
    style: CSSProperties;
} => {
    const [mode, setMode] = useState<Mode>(initialMode);

    const toggleMode = useCallback(() => {
        const next: Mode = mode === "dark" ? "light" : "dark";
        setMode(next);
        try {
            localStorage.setItem(STORAGE_KEY, next);
        } catch {
            // Not persisted; the page still switches.
        }
    }, [mode]);

    // Native controls and scrollbars follow the page.
    useEffect(() => {
        const root = document.documentElement;
        const previous = root.style.colorScheme;
        root.style.colorScheme = mode;
        return () => {
            root.style.colorScheme = previous;
        };
    }, [mode]);

    const style = useMemo(() => varsFor(mode), [mode]);
    return { mode, toggleMode, style };
};
