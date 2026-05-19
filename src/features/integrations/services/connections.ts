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
