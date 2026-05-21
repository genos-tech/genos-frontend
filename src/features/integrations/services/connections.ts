import axios from "axios";

import { authApi } from "../../../services/api";

export interface Connection {
    provider: "google" | "github";
    provider_email: string | null;
    scopes: string[];
    connected_at: string;
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
