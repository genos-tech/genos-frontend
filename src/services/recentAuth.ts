// A recent password check, asked for before a lasting foothold is made (MIP-2240).
//
// Creating an API key, a webhook or an AI-app connection needs the password typed in the last
// few minutes: a stolen session alone must not be able to make something that outlives the
// owner's password reset. `POST /user/confirm-password/` checks the password and answers a
// short-lived token; the creating call carries it as `recent_auth_token`.
//
// The token is kept in memory only (a module variable, never storage): a reload asks again,
// and nothing here survives for a script that reads localStorage.

import { authApi } from "./api";

/** The server's code on the 403 that means "ask for the password". */
export const RECENT_AUTH_REQUIRED = "recent_auth_required";

export type ConfirmPasswordResult =
    | { status: "ok"; token: string }
    // An account with no password (signed in through Google or GitHub): nothing to ask.
    | { status: "not_required" }
    | { status: "wrong" }
    | { status: "throttled" }
    | { status: "error" };

let remembered: { token: string; until: number } | null = null;

/** Seconds shaved off the server's window so a token is never sent in its last moments. */
const MARGIN_MS = 20_000;

/** The token still inside its window, or null. */
export const getRecentAuthToken = (now: number = Date.now()): string | null => {
    if (remembered && remembered.until > now) return remembered.token;
    remembered = null;
    return null;
};

export const forgetRecentAuth = (): void => {
    remembered = null;
};

/** True when `error` is the server's "enter your password" refusal. */
export const isRecentAuthRefusal = (error: unknown): boolean => {
    const response = (error as { response?: { status?: number; data?: { code?: unknown } } })
        ?.response;
    return response?.status === 403 && response.data?.code === RECENT_AUTH_REQUIRED;
};

export const confirmPassword = async (
    accessToken: string | null,
    password: string
): Promise<ConfirmPasswordResult> => {
    const api = authApi(accessToken);
    if (!api) return { status: "error" };
    try {
        const res = await api.post<{
            required?: boolean;
            recent_auth_token?: string;
            expires_in?: number;
        }>("/user/confirm-password/", { password }, { suppressErrorToast: true });
        if (res.data.required === false) return { status: "not_required" };
        const token = res.data.recent_auth_token;
        if (!token) return { status: "error" };
        const seconds = Number(res.data.expires_in);
        remembered = {
            token,
            until: Date.now() + (Number.isFinite(seconds) ? seconds * 1000 : 0) - MARGIN_MS,
        };
        return { status: "ok", token };
    } catch (error: unknown) {
        const status = (error as { response?: { status?: number } })?.response?.status;
        if (status === 403) return { status: "wrong" };
        if (status === 429) return { status: "throttled" };
        return { status: "error" };
    }
};
