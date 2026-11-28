/** Where to go once a signed-out visitor has signed in, for the one place that
 *  needs it: the AI-app consent page (`/oauth/consent?...`), which a client's
 *  browser lands on before anyone is signed in.
 *
 *  sessionStorage, not localStorage: it belongs to this tab's journey only and
 *  is gone when the tab closes. Only an exact, same-origin, known path is
 *  accepted back, so a crafted value can never turn sign-in into an open
 *  redirect. */

const KEY = "genos-pending-return";

/** Paths this may return to. Anything else is dropped. */
const ALLOWED = ["/oauth/consent"];

export const isAllowedReturn = (value: unknown): value is string => {
    if (typeof value !== "string" || !value.startsWith("/") || value.startsWith("//"))
        return false;
    // No backslash (some browsers read it as a slash) and no control characters.
    if (value.includes("\\") || [...value].some((ch) => ch.charCodeAt(0) < 32)) return false;
    const path = value.split("?")[0].split("#")[0];
    // A Settings link (MIP-2323): `/workspace?settings=<key>`, nothing else in the query but the
    // skills list of the Genos tab (MIP-2589).
    if (path === "/workspace") {
        return /^\/workspace\?settings=[A-Za-z]{1,40}(&skills=(hub|team))?$/.test(value);
    }
    return ALLOWED.includes(path);
};

export const rememberReturn = (path: string): void => {
    if (!isAllowedReturn(path)) return;
    try {
        sessionStorage.setItem(KEY, path);
    } catch {
        // Private mode: the visitor just lands on the usual page after sign-in.
    }
};

const isWorkspaceReturn = (value: string | null): boolean => !!value?.startsWith("/workspace?");

/** The remembered path, once: reading it clears it. A Settings link (`/workspace?settings=`)
 *  is left in place: sign-in sends everyone through the team picker first, and the picker
 *  returns it with `takeWorkspaceReturn`, so the tab survives choosing a team (MIP-2323). */
export const takeReturn = (): string | null => {
    try {
        const value = sessionStorage.getItem(KEY);
        if (isWorkspaceReturn(value)) return null;
        sessionStorage.removeItem(KEY);
        return isAllowedReturn(value) ? value : null;
    } catch {
        return null;
    }
};

/** The remembered Settings link, once, for the team picker to land on after a team is chosen. */
export const takeWorkspaceReturn = (): string | null => {
    try {
        const value = sessionStorage.getItem(KEY);
        if (!isWorkspaceReturn(value)) return null;
        sessionStorage.removeItem(KEY);
        return isAllowedReturn(value) ? value : null;
    } catch {
        return null;
    }
};
