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

import axios from "axios";

import { authApi } from "./api";
import { v3ApiBaseURL } from "./v3Api";

export interface ApiKey {
    id: string;
    name: string;
    prefix: string;
    scope: "read" | "write";
    /** May call the one tool that can't be undone (deleting a calendar
     *  event). Off unless asked for at mint time; write keys only. */
    allowDestructive: boolean;
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
    allowDestructive: boolean;
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
    /** Empty = every project. A filter, left unset. */
    projectIds: number[];
    /** Empty = NO channel. An allow-list, left empty — the opposite of
     *  `projectIds`, deliberately. Chat payloads carry message text, so
     *  there is no subscribe-to-all-chat and DMs are never eligible. */
    channelIds: string[];
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
    project_ids: number[];
    channel_ids: string[];
    is_active: boolean;
    consecutive_failures: number;
    disabled_at: string | null;
    created_at: string;
}

/** Every event the server will accept. Mirrors `webhook_models.EVENT_CHOICES`;
 *  these strings are a public contract, so renaming one is a breaking
 *  change for every integrator, not a refactor. */
export const WEBHOOK_EVENTS = [
    "task.created",
    "task.updated",
    "task.completed",
    "task.comment_created",
    "message.created",
] as const;

/** Events scoped by channel rather than project. The server requires a
 *  non-empty `channel_ids` for these and rejects DM channels outright,
 *  so the form must collect channels before it can submit one. */
export const CHANNEL_SCOPED_EVENTS: readonly string[] = ["message.created"];

const toWebhook = (w: WebhookWire): WebhookEndpoint => ({
    id: w.id,
    url: w.url,
    description: w.description,
    events: w.events ?? [],
    projectIds: w.project_ids ?? [],
    channelIds: w.channel_ids ?? [],
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

/** Lifetimes the create form offers. Every key expires — the server
 *  defaults an omitted lifetime to 90 days and refuses anything past 365
 *  — so "never" is deliberately not on the list. */
export const API_KEY_EXPIRY_DAYS = [30, 90, 180, 365] as const;
export const DEFAULT_API_KEY_EXPIRY_DAYS = 90;

export const createApiKey = async (
    accessToken: string | null,
    input: {
        name: string;
        scope: "read" | "write";
        teamId?: string | null;
        expiresInDays?: number;
        allowDestructive?: boolean;
    }
): Promise<CreateApiKeyResult> => {
    const api = authApi(accessToken);
    if (!api) return { status: "error" };
    try {
        const res = await api.post<ApiKeyWire & { key: string }>("/api-keys/", {
            name: input.name,
            scope: input.scope,
            ...(input.teamId ? { team_id: input.teamId } : {}),
            ...(input.expiresInDays ? { expires_in_days: input.expiresInDays } : {}),
            // Sent only when asked for: the server refuses it on a read
            // key, and omitting it is the safe default.
            ...(input.allowDestructive ? { allow_destructive: true } : {}),
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

/** A team key, as its team's owner sees it — whoever minted it. */
export interface TeamApiKey extends ApiKey {
    userId: string;
    userName: string;
    userEmail: string;
}

/** Every live key bound to `teamId`. Owner only: the server answers 404
 *  to everyone else (editors included), and that is `null` here, which
 *  the panel reads as "don't show the section" rather than an error. */
export const listTeamApiKeys = async (
    accessToken: string | null,
    teamId: string
): Promise<TeamApiKey[] | null> => {
    const api = authApi(accessToken);
    if (!api) return null;
    try {
        const res = await api.get<{ api_keys: TeamApiKey[] }>("/team/api-keys/", {
            params: { team_id: teamId },
            // A non-owner's 404 is the normal answer, not a failure.
            suppressErrorToast: true,
        });
        return res.data.api_keys ?? [];
    } catch {
        return null;
    }
};

export const revokeTeamApiKey = async (
    accessToken: string | null,
    teamId: string,
    id: string
): Promise<boolean> => {
    const api = authApi(accessToken);
    if (!api) return false;
    try {
        await api.delete(`/team/api-keys/${id}/`, { params: { team_id: teamId } });
        return true;
    } catch {
        return false;
    }
};

// ── Security log ─────────────────────────────────────────────────────

/** One row of the team's security audit log. `actionLabel` is the
 *  server's English label, the fallback for an action this client has
 *  no translation for yet. */
export interface SecurityEvent {
    id: number;
    createdAt: string;
    action: string;
    actionLabel: string;
    actorId: string | null;
    actorLabel: string;
    targetType: string;
    targetId: string;
    targetLabel: string;
    /** "app" | "api_key" | "mcp" | "agent" | "system" | "anonymous". */
    source: string;
    apiKeyId: string | null;
    ip: string | null;
    userAgent: string;
    metadata: Record<string, unknown>;
}

export interface SecurityEventPage {
    events: SecurityEvent[];
    /** Pass as `before` for the next page; `null` on the last one. */
    nextBefore: number | null;
}

/** A page of `teamId`'s security log, newest first. Owner only, with
 *  the same 404 for everyone else as the team key list — `null` here,
 *  which the panel reads as "don't show the section". */
export const listTeamSecurityEvents = async (
    accessToken: string | null,
    teamId: string,
    before?: number | null
): Promise<SecurityEventPage | null> => {
    const api = authApi(accessToken);
    if (!api) return null;
    try {
        const res = await api.get<SecurityEventPage>("/team/security-events/", {
            params: { team_id: teamId, ...(before ? { before } : {}) },
            // A non-owner's 404 is the normal answer, not a failure.
            suppressErrorToast: true,
        });
        return { events: res.data.events ?? [], nextBefore: res.data.nextBefore ?? null };
    } catch {
        return null;
    }
};

/** A page of the signed-in person's OWN security log: their sign-ins, exports,
 *  connected accounts and API keys, plus failed sign-in attempts against their
 *  account (MIP-745), newest first.
 *
 *  `null` means the request FAILED. Unlike the team log there is no "not
 *  allowed" answer to read as "hide the section", so a failure must not look
 *  like an empty log: "nothing recorded" would be a false statement about
 *  someone's own account. The caller shows an error. */
export const listMySecurityEvents = async (
    accessToken: string | null,
    before?: number | null
): Promise<SecurityEventPage | null> => {
    const api = authApi(accessToken);
    if (!api) return null;
    try {
        const res = await api.get<SecurityEventPage>("/user/security-events/", {
            params: before ? { before } : {},
        });
        return { events: res.data.events ?? [], nextBefore: res.data.nextBefore ?? null };
    } catch {
        return null;
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
    input: {
        teamId: string;
        url: string;
        events: string[];
        projectIds?: number[];
        channelIds?: string[];
        description?: string;
    }
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
                project_ids: input.projectIds ?? [],
                channel_ids: input.channelIds ?? [],
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

// ── scope options ────────────────────────────────────────────────────

export interface ScopeOptions {
    projects: { id: number; name: string }[];
    /** Group / project / multi-DM channels only. DMs are filtered out
     *  HERE as well as rejected server-side: a picker that offers a
     *  private conversation and then errors has already suggested that
     *  routing it somewhere was a supported idea. */
    channels: { id: string; title: string }[];
}

const DM_KIND = 1;

/** Everything a webhook can be scoped to, for one team.
 *
 * Two calls because projects and channels live on different surfaces
 * (v2 and v3). Failure of either yields an empty list rather than an
 * error: scope is optional for task events, so a hiccup here must not
 * block creating a webhook that needs no scope at all.
 */
export const listScopeOptions = async (
    accessToken: string | null,
    teamId: string,
    userId: string
): Promise<ScopeOptions> => {
    const api = authApi(accessToken);
    if (!api || !teamId) return { projects: [], channels: [] };

    const projects = api
        .get(`/project/projects/?team_id=${teamId}&attendee_id=${userId}`)
        .then((res) =>
            (res.data ?? []).map((p: { projectId: number; projectName: string }) => ({
                id: p.projectId,
                name: p.projectName,
            }))
        )
        .catch(() => []);

    const channels = axios
        .get(`${v3ApiBaseURL()}/api/v3/channels/?team_id=${teamId}`, {
            headers: { Authorization: `Bearer ${accessToken}` },
        })
        .then((res) =>
            (res.data?.channels ?? [])
                .filter((c: { kind: number }) => c.kind !== DM_KIND)
                .map((c: { id: string; title: string; kind: number }) => ({
                    id: c.id,
                    title: c.title || `(untitled ${c.kind === 3 ? "project" : "group"} chat)`,
                }))
        )
        .catch(() => []);

    const [p, c] = await Promise.all([projects, channels]);
    return { projects: p, channels: c };
};
