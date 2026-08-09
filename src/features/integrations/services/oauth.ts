/**
 * Helpers for navigating the user into a server-side OAuth flow.
 *
 * Two flows with different auth requirements:
 *
 *   - Login (signed-out user): a plain top-level navigation to the
 *     backend's GET initiate endpoint. The browser handles the 302 to
 *     the provider's consent screen automatically. No JWT needed.
 *
 *   - Connect (signed-in user): can't use top-level navigation because
 *     `window.location.href` won't carry the Authorization header.
 *     Instead we POST to the same path with a Bearer token, the
 *     backend returns the consent URL as JSON, and then we navigate.
 */

import { getMessages } from "../../../i18n";
import { authApi } from "../../../services/api";

const apiBase = (): string => (import.meta.env.VITE_API_BASE_URL as string).replace(/\/$/, "");

// Default landing path for OAuth login is `/jointeam`, mirroring the
// email/password sign-in flow — new users land there to pick or create
// a team, and existing users either auto-redirect from there or pick
// from their team list. Landing on `/workspace/*` directly would crash
// because the team-scoped endpoints expect a `teamId` in localStorage.
export const oauthLoginUrl = (provider: "google" | "github", next = "/jointeam"): string =>
    `${apiBase()}/oauth/${provider}/initiate/?intent=login&next=${encodeURIComponent(next)}`;

export const redirectToOAuthLogin = (provider: "google" | "github", next?: string): void => {
    window.location.href = oauthLoginUrl(provider, next);
};

/**
 * Authenticated connect flow. Asks the backend for the consent URL
 * (POST + Bearer), then sends the browser there.
 *
 * Returns false (and surfaces an error to the callback) if anything
 * fails before the redirect — the caller's UI should re-enable the
 * Connect button so the user can retry.
 */
export const redirectToOAuthConnect = async (
    provider: "google" | "github",
    accessToken: string,
    next = "/workspace/integrations",
    setErrorMessage?: (value: string) => void
): Promise<boolean> => {
    const messages = getMessages().integrations.errors;
    const api = authApi(accessToken);
    if (!api) {
        setErrorMessage?.(messages.notSignedIn);
        return false;
    }
    try {
        const res = await api.post<{ url: string }>(`/oauth/${provider}/initiate/`, {
            intent: "connect",
            next,
        });
        if (!res.data?.url) {
            setErrorMessage?.(messages.missingConsentUrl);
            return false;
        }
        window.location.href = res.data.url;
        return true;
    } catch (err) {
        console.error("OAuth connect initiate failed:", err);
        setErrorMessage?.(messages.connectFlowFailed);
        return false;
    }
};
