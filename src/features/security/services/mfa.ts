// Two-factor sign-in (MIP-2239). Thin wrappers over `/user/mfa/*` and `/user/signin/mfa/`;
// the rules (lock after five wrong codes, replay, recovery codes, the pending token) live
// server-side, see genos-api `origin/services/mfa.py`.
//
// Every call here answers a typed result instead of throwing: the screens render their own
// inline wording from `code`, so none of them wants the global error toast. A refusal never
// carries a secret, a code or a hash; the secret and the recovery codes come back exactly
// once, from `startMfaSetup` and `confirmMfaSetup` / `newRecoveryCodes`, and are only ever
// held in component state.

import axios from "axios";

import { authApi, nonAuthApi } from "../../../services/api";
import type { SignInResponse } from "../../../types/admin";

export interface MfaStatus {
    enabled: boolean;
    /** False for an account that signs in with Google or GitHub: it has no password to pair with. */
    eligible: boolean;
    enabledAt: string | null;
    recoveryCodesRemaining: number;
}

export type MfaRefusal =
    | "bad_password"
    | "invalid_code"
    | "mfa_locked"
    | "mfa_token_invalid"
    | "not_eligible"
    | "already_enabled"
    | "not_enabled"
    | "no_setup"
    | "throttled"
    | "network"
    | "unknown";

export type MfaResult<T> =
    | { ok: true; data: T }
    | { ok: false; code: MfaRefusal; retryAfterSeconds?: number };

const KNOWN: ReadonlySet<string> = new Set<MfaRefusal>([
    "bad_password",
    "invalid_code",
    "mfa_locked",
    "mfa_token_invalid",
    "not_eligible",
    "already_enabled",
    "not_enabled",
    "no_setup",
]);

const refusal = (error: unknown): { ok: false; code: MfaRefusal; retryAfterSeconds?: number } => {
    if (!axios.isAxiosError(error) || !error.response) return { ok: false, code: "network" };
    const body = error.response.data as { code?: unknown; retry_after?: unknown } | undefined;
    const code = typeof body?.code === "string" ? body.code : "";
    const retry = typeof body?.retry_after === "number" ? body.retry_after : undefined;
    if (KNOWN.has(code)) {
        return { ok: false, code: code as MfaRefusal, retryAfterSeconds: retry };
    }
    // The per-person or per-address rate limit answers a bare 429 with no `code`.
    if (error.response.status === 429) return { ok: false, code: "throttled" };
    return { ok: false, code: "unknown" };
};

const NO_TOAST = { suppressErrorToast: true } as const;

interface StatusWire {
    enabled: boolean;
    eligible: boolean;
    enabled_at: string | null;
    recovery_codes_remaining: number;
}

export const getMfaStatus = async (accessToken: string | null): Promise<MfaStatus | null> => {
    const api = authApi(accessToken);
    if (!api) return null;
    try {
        const res = await api.get<StatusWire>("/user/mfa/", NO_TOAST);
        return {
            enabled: !!res.data.enabled,
            eligible: !!res.data.eligible,
            enabledAt: res.data.enabled_at ?? null,
            recoveryCodesRemaining: res.data.recovery_codes_remaining ?? 0,
        };
    } catch {
        return null;
    }
};

export interface MfaSetup {
    /** Base32, shown once for typing into an app by hand. */
    secret: string;
    /** `otpauth://` link: the content of the QR code, and a tap target on a phone. */
    otpauthUri: string;
}

const post = async <T>(
    accessToken: string | null,
    path: string,
    body: Record<string, unknown>,
    pick: (data: Record<string, unknown>) => T
): Promise<MfaResult<T>> => {
    const api = authApi(accessToken);
    if (!api) return { ok: false, code: "unknown" };
    try {
        const res = await api.post<Record<string, unknown>>(path, body, NO_TOAST);
        return { ok: true, data: pick(res.data) };
    } catch (error) {
        return refusal(error);
    }
};

/** Step 1 of turning it on. Needs the password; nothing about signing in changes yet. */
export const startMfaSetup = (accessToken: string | null, password: string) =>
    post<MfaSetup>(accessToken, "/user/mfa/setup/", { password }, (d) => ({
        secret: String(d.secret ?? ""),
        otpauthUri: String(d.otpauth_uri ?? ""),
    }));

/** Step 2: the first code from the app turns it on and returns the recovery codes, once. */
export const confirmMfaSetup = (accessToken: string | null, code: string) =>
    post<string[]>(accessToken, "/user/mfa/enable/", { code }, (d) =>
        Array.isArray(d.recovery_codes) ? (d.recovery_codes as string[]) : []
    );

export const disableMfa = (accessToken: string | null, password: string) =>
    post<true>(accessToken, "/user/mfa/disable/", { password }, () => true);

/** A new set of ten; the old ones stop working. */
export const newRecoveryCodes = (accessToken: string | null, password: string) =>
    post<string[]>(accessToken, "/user/mfa/recovery-codes/", { password }, (d) =>
        Array.isArray(d.recovery_codes) ? (d.recovery_codes as string[]) : []
    );

/** The second step of signing in: the pending token from the password step plus a code. */
export const signInWithCode = async (
    mfaToken: string,
    code: string
): Promise<MfaResult<SignInResponse>> => {
    try {
        const res = await nonAuthApi().post<SignInResponse>(
            "/user/signin/mfa/",
            { mfa_token: mfaToken, code },
            NO_TOAST
        );
        return { ok: true, data: res.data };
    } catch (error) {
        return refusal(error);
    }
};

/** Whole minutes to show for a lock, never less than one. */
export const lockMinutes = (seconds: number | undefined): number =>
    Math.max(1, Math.ceil((seconds ?? 60) / 60));
