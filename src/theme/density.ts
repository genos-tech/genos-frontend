/**
 * Row density (MIP-1119): how tall a row in a list or table is.
 *
 * One attribute, `data-density` on `<html>`, selects which of the three row
 * heights `--g-row` resolves to (see `tokenStyles.ts`). Switching is a
 * single attribute write, so every surface that reads `g.row.current`
 * follows with no React render, the same way a theme switch works.
 *
 * `installActiveDensity()` runs at module import (from `installDesignTokens`,
 * before React mounts) so a saved choice never paints at the wrong height
 * first. The stored value is only written on an EXPLICIT pick; absence means
 * "never chose", and `DEFAULT_DENSITY` is then the single source of truth.
 */

export const DENSITIES = ["compact", "default", "comfortable"] as const;
export type Density = (typeof DENSITIES)[number];

export const DEFAULT_DENSITY: Density = "default";

/** Device-preference key: also listed in `DEVICE_PREFERENCE_LOCAL_STORAGE_KEYS`
 *  (AuthContext) so a user switch on the same device does not wipe it. */
export const DENSITY_STORAGE_KEY = "genos-density-preference";

export const isDensity = (v: unknown): v is Density =>
    typeof v === "string" && (DENSITIES as readonly string[]).includes(v);

/** The saved pick, or null when none or invalid. Never throws: storage can be blocked. */
export const readStoredDensity = (): Density | null => {
    if (typeof window === "undefined") return null;
    try {
        const raw = window.localStorage.getItem(DENSITY_STORAGE_KEY);
        return isDensity(raw) ? raw : null;
    } catch {
        return null;
    }
};

export const storeDensity = (d: Density): void => {
    if (typeof window === "undefined") return;
    try {
        window.localStorage.setItem(DENSITY_STORAGE_KEY, d);
    } catch {
        // Private mode / quota: the choice still applies for this session.
    }
};

/** Point `<html>` at a density. The only operation a switch performs. */
export const applyDensity = (d: Density): void => {
    if (typeof document === "undefined") return;
    document.documentElement.dataset.density = d;
};

/** Select the saved density (or the default) before first paint. Idempotent. */
export const installActiveDensity = (): Density => {
    const d = readStoredDensity() ?? DEFAULT_DENSITY;
    applyDensity(d);
    return d;
};
