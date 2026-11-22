import { useCallback, useEffect, useMemo, useState, type CSSProperties } from "react";

import { composite, contrast, hexToOklch, oklchToHex } from "../../theme/tokens/color";
import { buildRoles, type Mode, type RoleColors } from "../../theme/tokens/roles";
import { roleVars } from "../../theme/tokens/tokenStyles";

const AA_TEXT = 4.5;

/** The page background and the surfaces the public pages stack on. */
export const lpSurfaces = (r: RoleColors): Record<string, string> => ({
    bg: r.bg,
    bgSubtle: r.bgSubtle,
    surface: r.surface,
    surfaceRaised: r.surfaceRaised,
});

/** Each surface, then the same surface under a translucent fill: how a hovered
 *  ghost button, a selected tab or a badge tint actually paints. */
export const withFill = (
    base: Record<string, string>,
    label: string,
    fill: { hex: string; a: number }
) =>
    Object.fromEntries(
        Object.entries(base).map(([k, c]) => [`${k}+${label}`, composite(fill.hex, fill.a, c)])
    );

/** Every backdrop public-page text can sit on. */
export const lpTextBackdrops = (r: RoleColors): Record<string, string> => {
    const base = lpSurfaces(r);
    return {
        ...base,
        ...withFill(base, "hover", r.hover),
        ...withFill(base, "active", r.active),
        ...withFill(base, "accentSubtle", r.accentSubtle),
        ...withFill(base, "successSubtle", r.success.subtle),
        ...withFill(base, "dangerSubtle", r.danger.subtle),
    };
};

/**
 * `hex` moved along OKLCH lightness only (hue and chroma kept) until it reads
 * AA on every backdrop: darker in light mode, lighter in dark, in the smallest
 * steps that pass. A colour that already passes comes back unchanged.
 */
const toAA = (hex: string, backdrops: string[], mode: Mode): string => {
    const { l, c, h } = hexToOklch(hex);
    const step = mode === "light" ? -0.005 : 0.005;
    const worst = (fg: string) => Math.min(...backdrops.map((b) => contrast(fg, b)));
    let out = hex;
    for (let i = 1; i <= 120 && worst(out) < AA_TEXT; i++) {
        out = oklchToHex(Math.min(1, Math.max(0, l + step * i)), c, h);
    }
    return out;
};

/**
 * The app's roles as the public pages paint them. The app's roles stay as they
 * are; two text roles are darkened (light) or lightened (dark) just enough to
 * pass 4.5:1 on every backdrop the public pages put them on (MIP-1846):
 *  - tertiary text (captions, timeline dates, footer line, field hints), which
 *    the app holds to 3:1 on purpose (designTokens.test.ts);
 *  - accent text, which also paints the selected and pressed washes; the focus
 *    ring is the accent text (buildRoles), so it follows.
 */
export const lpRolesFor = (mode: Mode): RoleColors => {
    const r = buildRoles("purple", mode);
    const backdrops = Object.values(lpTextBackdrops(r));
    const accentText = toAA(r.accentText, backdrops, mode);
    return {
        ...r,
        textTertiary: toAA(r.textTertiary, backdrops, mode),
        accentText,
        focus: r.focus === r.accentText ? accentText : r.focus,
    };
};

/**
 * The marketing pages paint with the app's own colour roles (MIP-1232).
 *
 * They don't mount the app's theme provider (no auth stack, no settings), so
 * instead of copying hex values they build the same roles the app builds for
 * the default purple theme and publish them as `--lp-*` variables on the page
 * root. `lp.css` only ever reads those variables: change a role in
 * `theme/tokens/roles.ts` and the LP follows, light and dark alike.
 */
export const lpVarsFor = (mode: Mode): CSSProperties => {
    const out: Record<string, string> = {};
    for (const [key, value] of roleVars(lpRolesFor(mode))) {
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

    const style = useMemo(() => lpVarsFor(mode), [mode]);
    return { mode, toggleMode, style };
};
