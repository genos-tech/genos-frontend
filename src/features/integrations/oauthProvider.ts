/**
 * Which sign-in provider a person is using, carried between two pages.
 *
 * When a brand-new person presses "Continue with Google" on the SIGN-IN page,
 * the API refuses (no consent given) and sends the browser back to
 * `/oauth/success?error=terms_required`. That redirect names no provider, so the
 * sign-in page remembers it in sessionStorage before leaving, the bounce page
 * reads it, and the sign-up page gets it as `?provider=` so it can highlight
 * the same button. It is only a hint for the UI: consent is never implied.
 */

export const OAUTH_PROVIDERS = ["google", "github"] as const;
export type OAuthProvider = (typeof OAUTH_PROVIDERS)[number];

const STORAGE_KEY = "genosOAuthSignInProvider";

/**
 * The one place a provider name is validated: an exact match against the known
 * list, anything else (other case, whitespace, `constructor`, arrays) is null.
 */
export const parseOAuthProvider = (value: unknown): OAuthProvider | null =>
    typeof value === "string" && (OAUTH_PROVIDERS as readonly string[]).includes(value)
        ? (value as OAuthProvider)
        : null;

/** `/signup`, with `?provider=` only when the provider is a known one. */
export const signUpPathFor = (provider: unknown): string => {
    const known = parseOAuthProvider(provider);
    return known ? `/signup?${new URLSearchParams({ provider: known }).toString()}` : "/signup";
};

// Storage can throw (private windows, blocked site data): every access is a
// best-effort hint, so a failure just means "no remembered provider".
export const rememberOAuthProvider = (provider: OAuthProvider): void => {
    try {
        sessionStorage.setItem(STORAGE_KEY, provider);
    } catch {
        /* hint only */
    }
};

/** Read without clearing, so a re-render or a double effect reads the same thing. */
export const peekRememberedOAuthProvider = (): OAuthProvider | null => {
    try {
        return parseOAuthProvider(sessionStorage.getItem(STORAGE_KEY));
    } catch {
        return null;
    }
};

export const forgetRememberedOAuthProvider = (): void => {
    try {
        sessionStorage.removeItem(STORAGE_KEY);
    } catch {
        /* hint only */
    }
};
