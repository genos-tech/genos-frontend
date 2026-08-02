// API keys + outbound webhooks (readiness plan §4.4). Thin wrappers over
// `/api-keys/` and `/webhooks/`; the rules live server-side — see
// genos-docs `operations/PUBLIC_API.md` for the contract.
//
// Both create calls return a SECRET EXACTLY ONCE. There is no recovery
// path by design (the server stores a hash for keys, and only ever
// re-shows nothing for webhooks), so the UI has to say so before the
// dialog closes. That is why `create*` returns the plaintext separately
// rather than folding it into the list shape — it makes the one-shot
// nature visible in the type.

import { authApi } from "./api";

export interface ApiKey {
    id: string;
    name: string;
    prefix: string;
    scope: "read" | "write";
    teamId: string | null;
    lastUsedAt: string | null;
    expiresAt: string | null;
    createdAt: string;
}

interface ApiKeyWire {
    id: string;
    name: string;
    prefix: string;
    scope: "read" | "write";
    teamId: string | null;
    lastUsedAt: string | null;
    expiresAt: string | null;
    createdAt: string;
}

export interface WebhookEndpoint {
    id: string;
    url: string;
    description: string;
    events: string[];
    isActive: boolean;
    consecutiveFailures: number;
    disabledAt: string | null;
    createdAt: string;
}

interface WebhookWire {
    id: string;
    url: string;
    description: string;
    events: string[];
    is_active: boolean;
    consecutive_failures: number;
    disabled_at: string | null;
    created_at: string;
}

/** Every event the server will accept. Mirrors `webhook_models.EVENT_CHOICES`;
 *  these strings are a public contract, so renaming one is a breaking
 *  change for every integrator, not a refactor. */
export const WEBHOOK_EVENTS = ["task.created", "task.updated", "task.completed"] as const;

const toWebhook = (w: WebhookWire): WebhookEndpoint => ({
    id: w.id,
    url: w.url,
    description: w.description,
    events: w.events ?? [],
    isActive: w.is_active,
    consecutiveFailures: w.consecutive_failures,
    disabledAt: w.disabled_at,
    createdAt: w.created_at,
});

// ── API keys ─────────────────────────────────────────────────────────

export const listApiKeys = async (accessToken: string | null): Promise<ApiKey[] | null> => {
    const api = authApi(accessToken);
    if (!api) return null;
    try {
        const res = await api.get<{ api_keys: ApiKeyWire[] }>("/api-keys/");
        return res.data.api_keys ?? [];
    } catch {
        return null;
    }
};

export type CreateApiKeyResult =
    | { status: "created"; key: string; created: ApiKey }
    | { status: "error"; message?: string };

export const createApiKey = async (
    accessToken: string | null,
    input: { name: string; scope: "read" | "write"; teamId?: string | null }
): Promise<CreateApiKeyResult> => {
    const api = authApi(accessToken);
    if (!api) return { status: "error" };
    try {
        const res = await api.post<ApiKeyWire & { key: string }>("/api-keys/", {
            name: input.name,
            scope: input.scope,
            ...(input.teamId ? { team_id: input.teamId } : {}),
        });
        const { key, ...rest } = res.data;
        return { status: "created", key, created: rest };
    } catch (error: unknown) {
        const message = (error as { response?: { data?: { error?: string } } })?.response?.data
            ?.error;
        return { status: "error", message };
    }
};

export const revokeApiKey = async (accessToken: string | null, id: string): Promise<boolean> => {
    const api = authApi(accessToken);
    if (!api) return false;
    try {
        await api.delete(`/api-keys/${id}/`);
        return true;
    } catch {
        return false;
    }
};

// ── Webhooks ─────────────────────────────────────────────────────────

export const listWebhooks = async (
    accessToken: string | null,
    teamId: string
): Promise<WebhookEndpoint[] | null> => {
    const api = authApi(accessToken);
    if (!api) return null;
    try {
        const res = await api.get<{ webhooks: WebhookWire[] }>("/webhooks/", {
            params: { team_id: teamId },
        });
        return (res.data.webhooks ?? []).map(toWebhook);
    } catch {
        return null;
    }
};

export type CreateWebhookResult =
    | { status: "created"; secret: string; created: WebhookEndpoint }
    // The server validates the URL (https only, must resolve to a public
    // address) and returns a specific reason. Surfaced verbatim rather
    // than replaced with a generic failure: the person reading it is the
    // one who typed the URL, and "must resolve to a public address" is
    // the difference between fixing it and filing a bug.
    | { status: "invalid"; message: string }
    | { status: "forbidden" }
    | { status: "error" };

export const createWebhook = async (
    accessToken: string | null,
    input: { teamId: string; url: string; events: string[]; description?: string }
): Promise<CreateWebhookResult> => {
    const api = authApi(accessToken);
    if (!api) return { status: "error" };
    try {
        const res = await api.post<WebhookWire & { secret: string }>(
            "/webhooks/",
            {
                team_id: input.teamId,
                url: input.url,
                events: input.events,
                description: input.description ?? "",
            },
            // Validation errors are rendered inline next to the field, so
            // the global toast would be a duplicate.
            { suppressErrorToast: true }
        );
        const { secret, ...rest } = res.data;
        return { status: "created", secret, created: toWebhook(rest) };
    } catch (error: unknown) {
        const response = (error as { response?: { status?: number; data?: { error?: string } } })
            ?.response;
        if (response?.status === 400 && response.data?.error) {
            return { status: "invalid", message: response.data.error };
        }
        if (response?.status === 403) return { status: "forbidden" };
        return { status: "error" };
    }
};

export const deleteWebhook = async (accessToken: string | null, id: string): Promise<boolean> => {
    const api = authApi(accessToken);
    if (!api) return false;
    try {
        await api.delete(`/webhooks/${id}/`);
        return true;
    } catch {
        return false;
    }
};
