// Connecting an AI app (Claude, ChatGPT…) to Genos over MCP: the consent
// step and Settings → Connected apps (MIP-1077 / MIP-1079). Thin wrappers over
// `/mcp/oauth/consent/*` and `/mcp/connections/`; the rules live server-side.
//
// The consent page is the member's, so these calls go out with their JWT and
// nothing the page sends is trusted: the server validates the authorization
// request again from scratch on every call.

import { authApi } from "./api";

/** The authorization parameters the app was handed, as the API wants them
 *  back. `resource` may repeat (RFC 8707), so it alone can be a list. */
export type ConsentParams = Record<string, string | string[]>;

export type McpScopeName = "mcp:read" | "mcp:write" | "mcp:destructive";

export interface ConsentContext {
    client: {
        name: string;
        /** "registered": the app registered itself (anyone can, under any
         *  name). "metadata_document": it is the document at `host`. */
        kind: "registered" | "metadata_document";
        host: string;
        /** Where the browser is sent back to after the decision. */
        redirectHost: string;
    };
    scopes: { name: McpScopeName; description: string }[];
    teams: { id: string; name: string }[];
    planAllowed: boolean;
    existing: {
        active: boolean;
        scope: "read" | "write";
        allowDestructive: boolean;
        defaultTeamId: string;
        teamIds: string[];
    } | null;
}

/** A refusal. `redirectTo` is set only when the client's own redirect address
 *  is trustworthy, so the client can be told the outcome. */
export interface ConsentError {
    error: string;
    description: string;
    redirectTo: string | null;
    status: number;
}

export type ConsentContextResult =
    | { ok: true; context: ConsentContext }
    | { ok: false; failure: ConsentError };

export type ConsentDecisionResult =
    | { ok: true; redirectTo: string }
    | { ok: false; failure: ConsentError };

interface ErrorWire {
    error?: string;
    error_description?: string;
    redirect_to?: string | null;
}

const failureFrom = (error: unknown): ConsentError => {
    const res = (error as { response?: { status?: number; data?: ErrorWire } })?.response;
    const data = res?.data ?? {};
    return {
        error: typeof data.error === "string" ? data.error : "server_error",
        description: typeof data.error_description === "string" ? data.error_description : "",
        redirectTo: typeof data.redirect_to === "string" ? data.redirect_to : null,
        status: res?.status ?? 0,
    };
};

const SILENT = { suppressErrorToast: true } as const;

export const getConsentContext = async (
    accessToken: string | null,
    params: ConsentParams
): Promise<ConsentContextResult> => {
    const api = authApi(accessToken);
    if (!api) return { ok: false, failure: failureFrom(null) };
    try {
        const res = await api.post<ConsentContext>(
            "/mcp/oauth/consent/context/",
            { params },
            SILENT
        );
        return { ok: true, context: res.data };
    } catch (error) {
        return { ok: false, failure: failureFrom(error) };
    }
};

export type ConsentDecision =
    | { allow: false }
    | { allow: true; scopes: McpScopeName[]; teamIds: string[]; defaultTeamId: string };

export const submitConsentDecision = async (
    accessToken: string | null,
    params: ConsentParams,
    decision: ConsentDecision
): Promise<ConsentDecisionResult> => {
    const api = authApi(accessToken);
    if (!api) return { ok: false, failure: failureFrom(null) };
    const body = decision.allow
        ? {
              params,
              allow: true,
              scopes: decision.scopes,
              team_ids: decision.teamIds,
              default_team_id: decision.defaultTeamId,
          }
        : { params, allow: false };
    try {
        const res = await api.post<{ redirect_to: string }>(
            "/mcp/oauth/consent/decision/",
            body,
            SILENT
        );
        return { ok: true, redirectTo: res.data.redirect_to };
    } catch (error) {
        return { ok: false, failure: failureFrom(error) };
    }
};

// ── Connected apps ───────────────────────────────────────────────────

export interface McpConnection {
    id: string;
    client: { name: string; kind: "registered" | "metadata_document"; host: string };
    scope: "read" | "write";
    /** Needs write. Off unless the member ticked it at consent. */
    allowDestructive: boolean;
    defaultTeamId: string;
    teamIds: string[];
    /** The chosen teams that still exist and that the member is still in. */
    teams: { id: string; name: string }[];
    lastUsedAt: string | null;
    createdAt: string;
}

export interface McpConnectionList {
    connections: McpConnection[];
    /** Every team the member is in right now: what "add a team" may offer. */
    availableTeams: { id: string; name: string }[];
}

export const listMcpConnections = async (
    accessToken: string | null
): Promise<McpConnectionList | null> => {
    const api = authApi(accessToken);
    if (!api) return null;
    try {
        const res = await api.get<Partial<McpConnectionList>>("/mcp/connections/");
        return {
            connections: res.data.connections ?? [],
            availableTeams: res.data.availableTeams ?? [],
        };
    } catch {
        return null;
    }
};

export interface McpConnectionChange {
    scopes?: McpScopeName[];
    teamIds?: string[];
    defaultTeamId?: string;
}

/** `gone`: the connection is not there (revoked elsewhere, or not theirs): a 404.
 *  The list is stale, so the caller refreshes it instead of reporting a failure. */
export type McpWriteFailure = { gone: boolean; error: string | null };

export type UpdateConnectionResult =
    | { ok: true; connection: McpConnection }
    | ({ ok: false } & McpWriteFailure);

const writeFailure = (error: unknown): McpWriteFailure => {
    const res = (error as { response?: { status?: number; data?: { error?: string } } })?.response;
    return {
        gone: res?.status === 404,
        error: typeof res?.data?.error === "string" ? res.data.error : null,
    };
};

export const updateMcpConnection = async (
    accessToken: string | null,
    id: string,
    change: McpConnectionChange
): Promise<UpdateConnectionResult> => {
    const api = authApi(accessToken);
    if (!api) return { ok: false, gone: false, error: null };
    try {
        const res = await api.patch<McpConnection>(
            `/mcp/connections/${id}/`,
            {
                ...(change.scopes ? { scopes: change.scopes } : {}),
                ...(change.teamIds ? { team_ids: change.teamIds } : {}),
                ...(change.defaultTeamId ? { default_team_id: change.defaultTeamId } : {}),
            },
            SILENT
        );
        return { ok: true, connection: res.data };
    } catch (error) {
        return { ok: false, ...writeFailure(error) };
    }
};

/** Ends the connection and every token it holds: the app's next call fails. */
export type RevokeConnectionResult = { ok: true } | ({ ok: false } & McpWriteFailure);

export const revokeMcpConnection = async (
    accessToken: string | null,
    id: string
): Promise<RevokeConnectionResult> => {
    const api = authApi(accessToken);
    if (!api) return { ok: false, gone: false, error: null };
    try {
        await api.delete(`/mcp/connections/${id}/`, SILENT);
        return { ok: true };
    } catch (error) {
        return { ok: false, ...writeFailure(error) };
    }
};
