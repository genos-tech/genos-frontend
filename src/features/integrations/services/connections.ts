import axios from "axios";

import { authApi } from "../../../services/api";

export interface Connection {
    /** Server-side id of this specific connection. Every per-account
     *  operation (calendar reads/writes, disconnect) keys on it — a
     *  user can hold several Google accounts, and `provider` alone no
     *  longer identifies one. */
    id: string;
    provider: "google" | "github";
    provider_email: string | null;
    /** Display name for the account — the provider email, falling back
     *  to the opaque provider id. This is how a user tells their work
     *  account from their personal one. */
    label: string;
    scopes: string[];
    connected_at: string;
    /** True only for the account the user signs in with, which can't be
     *  disconnected. Derived server-side from `is_login_identity` — NOT
     *  from "provider matches the signup provider", which would mark
     *  every Google account of a Google-signup user as primary. */
    is_primary: boolean;
}

export interface ConnectionsResponse {
    primary_auth_provider: "email" | "google" | "github";
    connections: Connection[];
}

// Specific Google Calendar API scope needed to read/write events. A
// sign-in-via-Google user starts with only `openid email profile` —
// any calendar call against that token returns 403 with
// `ACCESS_TOKEN_SCOPE_INSUFFICIENT`. The fix is to send the user back
// through the OAuth flow with intent=connect (which uses
// GOOGLE_CONNECT_SCOPES), and the existing account's scopes get
// upgraded in place by the callback handler.
export const CALENDAR_EVENTS_SCOPE = "https://www.googleapis.com/auth/calendar.events";

export const hasCalendarScope = (connection: Connection | undefined): boolean =>
    !!connection?.scopes?.includes(CALENDAR_EVENTS_SCOPE);

export const findGoogleConnection = (data: ConnectionsResponse | null): Connection | undefined =>
    data?.connections.find((c) => c.provider === "google");

/** Every Google account the user has connected, in server order
 *  (login identity first, then oldest). Prefer this over
 *  `findGoogleConnection` anywhere the answer drives what's rendered:
 *  a user with a work and a personal account has two, and picking just
 *  the first silently hides the other. */
export const findGoogleConnections = (data: ConnectionsResponse | null): Connection[] =>
    data?.connections.filter((c) => c.provider === "google") ?? [];

/** True when at least one connected Google account can read calendars.
 *  Deliberately "some" rather than "every": one account missing the
 *  scope shouldn't read as "calendar unavailable" when another account
 *  works fine. */
export const hasAnyCalendarScope = (connections: Connection[]): boolean =>
    connections.some((c) => hasCalendarScope(c));

/** Disconnect one specific account by id. The by-provider route can't
 *  express which of several accounts to drop, so it refuses when the
 *  choice is ambiguous — this is the route the UI uses. */
export const disconnectAccount = async (
    accessToken: string,
    accountId: string,
    setErrorMessage?: (value: string) => void
): Promise<boolean> => {
    try {
        const api = authApi(accessToken);
        if (!api) return false;
        await api.delete(`/integrations/account/${accountId}/`);
        return true;
    } catch (error: unknown) {
        if (axios.isAxiosError(error)) {
            const detail = (error.response?.data as { detail?: string })?.detail;
            setErrorMessage?.(detail || "Disconnect failed.");
        }
        return false;
    }
};

export const listConnections = async (
    accessToken: string,
    setErrorMessage?: (value: string) => void
): Promise<ConnectionsResponse | null> => {
    try {
        const api = authApi(accessToken);
        if (!api) return null;
        const res = await api.get<ConnectionsResponse>("/integrations/me/");
        return res.data;
    } catch (error: unknown) {
        if (axios.isAxiosError(error)) {
            console.error("listConnections error:", error.response?.status, error.response?.data);
        }
        setErrorMessage?.("Failed to load connected accounts.");
        return null;
    }
};

export const disconnectProvider = async (
    accessToken: string,
    provider: "google" | "github",
    setErrorMessage?: (value: string) => void
): Promise<boolean> => {
    try {
        const api = authApi(accessToken);
        if (!api) return false;
        await api.delete(`/integrations/${provider}/`);
        return true;
    } catch (error: unknown) {
        if (axios.isAxiosError(error)) {
            const detail = (error.response?.data as { detail?: string })?.detail;
            setErrorMessage?.(detail || "Disconnect failed.");
        }
        return false;
    }
};
