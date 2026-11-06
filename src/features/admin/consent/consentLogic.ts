// The pure rules of the AI-app consent page (MIP-1079): what to read from the
// URL, which teams and scopes start selected, and where an outcome sends the
// browser. Kept out of the component so each rule has a plain test.

import type {
    ConsentContext,
    ConsentError,
    ConsentParams,
    McpScopeName,
} from "../../../services/mcpConnections";

/** What the authorization endpoint always sends. Without these the page has
 *  nothing meaningful to ask, so it says so instead of calling the API. */
const REQUIRED = ["response_type", "client_id", "redirect_uri", "code_challenge"] as const;

/** Parameters the page passes back to the API, from `location.search`. The
 *  API validates them again, so this only keeps the shape right: strings, with
 *  `resource` (which may repeat) as a list. Anything else is dropped. */
export const paramsFromSearch = (search: string): ConsentParams | null => {
    const query = new URLSearchParams(search);
    const params: ConsentParams = {};
    for (const key of new Set(query.keys())) {
        const values = query.getAll(key);
        if (key === "resource") params[key] = values;
        else params[key] = values[0];
    }
    for (const key of REQUIRED) {
        if (!params[key]) return null;
    }
    return params;
};

/** Where `redirect_to` may take the browser. The server only registers https
 *  addresses and http to a loopback host, so anything else is refused here too
 *  (a `javascript:` or `data:` URL must never be assigned to the location). */
export const isSafeRedirect = (url: unknown): url is string => {
    if (typeof url !== "string" || url.length === 0) return false;
    let parsed: URL;
    try {
        parsed = new URL(url);
    } catch {
        return false;
    }
    if (parsed.protocol === "https:") return true;
    return (
        parsed.protocol === "http:" &&
        ["localhost", "127.0.0.1", "[::1]"].includes(parsed.hostname)
    );
};

/** What to do with a refusal: send the browser back to the client (it learns
 *  the outcome) only when the server says the address is trustworthy, else
 *  show the error and stay. */
export type FailureAction = { kind: "navigate"; url: string } | { kind: "show" };

export const actionForFailure = (failure: ConsentError): FailureAction =>
    isSafeRedirect(failure.redirectTo)
        ? { kind: "navigate", url: failure.redirectTo }
        : { kind: "show" };

/** Which team starts as the default: the one an existing connection used, else
 *  the team the member is working in if offered, else the first offered. */
export const chooseDefaultTeam = (
    teams: ConsentContext["teams"],
    currentTeamId: string | null,
    existing: ConsentContext["existing"]
): string => {
    const offered = new Set(teams.map((t) => t.id));
    if (existing && offered.has(existing.defaultTeamId)) return existing.defaultTeamId;
    if (currentTeamId && offered.has(currentTeamId)) return currentTeamId;
    return teams[0]?.id ?? "";
};

/** Teams ticked at the start: an existing connection's (that are still
 *  offered), else the default alone. Asking for more than one team is the
 *  member's choice, never the starting point. */
export const initialTeamIds = (
    teams: ConsentContext["teams"],
    defaultTeamId: string,
    existing: ConsentContext["existing"]
): string[] => {
    const offered = new Set(teams.map((t) => t.id));
    const kept = (existing?.teamIds ?? []).filter((id) => offered.has(id));
    if (kept.length > 0) return kept;
    return defaultTeamId ? [defaultTeamId] : [];
};

/** Ticking a team keeps the default among the ticked ones; unticking the
 *  default hands it to the first team still ticked. */
export const toggleTeam = (
    teamIds: string[],
    defaultTeamId: string,
    toggled: string
): { teamIds: string[]; defaultTeamId: string } => {
    if (teamIds.includes(toggled)) {
        const next = teamIds.filter((id) => id !== toggled);
        if (next.length === 0) return { teamIds, defaultTeamId };
        return {
            teamIds: next,
            defaultTeamId: toggled === defaultTeamId ? next[0] : defaultTeamId,
        };
    }
    return { teamIds: [...teamIds, toggled], defaultTeamId };
};

/** Picking the default ticks that team too. */
export const pickDefault = (
    teamIds: string[],
    teamId: string
): { teamIds: string[]; defaultTeamId: string } => ({
    teamIds: teamIds.includes(teamId) ? teamIds : [...teamIds, teamId],
    defaultTeamId: teamId,
});

export interface ScopeChoice {
    write: boolean;
    destructive: boolean;
}

/** Read is always on; "allow deleting" only exists with write. */
export const normalizeChoice = (choice: ScopeChoice): ScopeChoice => ({
    write: choice.write,
    destructive: choice.write && choice.destructive,
});

/** What the client asked for, as the starting choice. An existing
 *  connection's own setting wins (narrowing is what a returning member
 *  expects to see). Deleting always starts off. */
export const initialChoice = (
    requested: McpScopeName[],
    existing: ConsentContext["existing"]
): ScopeChoice => {
    if (existing?.active) {
        return normalizeChoice({
            write: existing.scope === "write" && requested.includes("mcp:write"),
            destructive: existing.allowDestructive && requested.includes("mcp:destructive"),
        });
    }
    return { write: requested.includes("mcp:write"), destructive: false };
};

/** The scope names to send for a choice, never more than was asked for. */
export const scopesFor = (choice: ScopeChoice, requested: McpScopeName[]): McpScopeName[] => {
    const c = normalizeChoice(choice);
    const out: McpScopeName[] = ["mcp:read"];
    if (c.write && requested.includes("mcp:write")) out.push("mcp:write");
    if (c.destructive && requested.includes("mcp:destructive")) out.push("mcp:destructive");
    return out;
};

/** What identifies a metadata-document client: its full address, the host only if
 *  an older API sent no address, and nothing for a registered app (anyone can
 *  register one under any name, so there is nothing to show). */
export const clientAddress = (client: { kind: string; host?: string; url?: string }): string =>
    client.kind === "metadata_document" ? client.url || client.host || "" : "";
