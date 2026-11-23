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

import axios from "axios";

import { getMessages } from "../../../i18n";
import { authApi } from "../../../services/api";
import { activeTeamId } from "./activeTeam";

const apiBase = (): string => (import.meta.env.VITE_API_BASE_URL as string).replace(/\/$/, "");

// Default landing path for OAuth login is `/jointeam`, mirroring the
// email/password sign-in flow — new users land there to pick or create
// a team, and existing users either auto-redirect from there or pick
// from their team list. Landing on `/workspace/*` directly would crash
// because the team-scoped endpoints expect a `teamId` in localStorage.
//
// `acceptedTerms` is the sign-up screen's consent checkbox. The server carries
// it through the provider round trip and needs it to create a NEW account;
// signing in to an existing one never asks. Only the sign-up screen sets it.
export const oauthLoginUrl = (
    provider: "google" | "github",
    next = "/jointeam",
    acceptedTerms = false
): string =>
    `${apiBase()}/oauth/${provider}/initiate/?intent=login&next=${encodeURIComponent(next)}` +
    (acceptedTerms ? "&accepted_terms=true" : "");

export const redirectToOAuthLogin = (
    provider: "google" | "github",
    next?: string,
    acceptedTerms?: boolean
): void => {
    window.location.href = oauthLoginUrl(provider, next, acceptedTerms);
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
        // `withCredentials`: the server pins this connect to this browser with an HttpOnly cookie
        // set on this very response (MIP-2170); without it the browser drops the cookie and the
        // callback refuses to connect anything. Set per request, not on `authApi`, so no other
        // call changes its cross-origin behaviour.
        //
        // GitHub also names the team the installation is linked into (MIP-2090): the server takes
        // the person's only team when none is sent and answers `team_required` for a person in
        // several. Sent only for GitHub (the App flow reads it; Google has no use for it).
        const teamId = provider === "github" ? activeTeamId() : null;
        const res = await api.post<{ url: string }>(
            `/oauth/${provider}/initiate/`,
            { intent: "connect", next, ...(teamId ? { team_id: teamId } : {}) },
            { withCredentials: true }
        );
        if (!res.data?.url) {
            setErrorMessage?.(messages.missingConsentUrl);
            return false;
        }
        window.location.href = res.data.url;
        return true;
    } catch (err) {
        console.error("OAuth connect initiate failed:", err);
        setErrorMessage?.(initiateErrorMessage(err, provider));
        return false;
    }
};

/** The App flow's refusals at `initiate` are `{detail: "<reason>"}` (400/403/404): each one says
 *  what to do, where the generic "could not start" would not. Anything else stays generic. */
const initiateErrorMessage = (err: unknown, provider: "google" | "github"): string => {
    const messages = getMessages().integrations.errors;
    if (provider === "github" && axios.isAxiosError(err)) {
        const detail = (err.response?.data as { detail?: unknown } | undefined)?.detail;
        if (detail === "team_required") return messages.githubAppTeamRequired;
        if (detail === "team_not_found") return messages.githubAppTeamNotFound;
        if (detail === "team_not_allowed") return messages.githubAppTeamNotAllowed;
    }
    return messages.connectFlowFailed;
};
