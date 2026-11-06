// The pure part of editing a connected app (MIP-1079): what a connection's
// scope means as choices, and what removing one of its teams does.

import type {
    McpConnection,
    McpConnectionChange,
    McpScopeName,
} from "../../../services/mcpConnections";
import { normalizeChoice, type ScopeChoice } from "./consentLogic";

export const scopeChoiceOf = (c: Pick<McpConnection, "scope" | "allowDestructive">): ScopeChoice =>
    normalizeChoice({ write: c.scope === "write", destructive: c.allowDestructive });

export const sameChoice = (a: ScopeChoice, b: ScopeChoice): boolean =>
    a.write === b.write && a.destructive === b.destructive;

/** The scope names a PATCH sends for a choice. Read is always there. */
export const chooseScopes = (choice: ScopeChoice): McpScopeName[] => {
    const c = normalizeChoice(choice);
    const out: McpScopeName[] = ["mcp:read"];
    if (c.write) out.push("mcp:write");
    if (c.destructive) out.push("mcp:destructive");
    return out;
};

/** Dropping a team from a connection. The last team cannot be dropped (that is
 *  revoking), and dropping the default hands it to the first one left. */
export const removeTeam = (
    c: Pick<McpConnection, "teams" | "defaultTeamId">,
    teamId: string
): McpConnectionChange | null => {
    const left = c.teams.filter((t) => t.id !== teamId).map((t) => t.id);
    if (left.length === 0 || left.length === c.teams.length) return null;
    return {
        teamIds: left,
        defaultTeamId: c.defaultTeamId === teamId ? left[0] : c.defaultTeamId,
    };
};

/** Adding a team to a connection: the teams it has plus the new one, the default
 *  untouched. Null when the team is already there. */
export const addTeam = (
    c: Pick<McpConnection, "teams" | "defaultTeamId">,
    teamId: string
): McpConnectionChange | null => {
    if (c.teams.some((t) => t.id === teamId)) return null;
    return { teamIds: [...c.teams.map((t) => t.id), teamId], defaultTeamId: c.defaultTeamId };
};

/** The member's teams a connection does not have yet. */
export const addableTeams = (
    c: Pick<McpConnection, "teams">,
    available: { id: string; name: string }[]
): { id: string; name: string }[] => {
    const have = new Set(c.teams.map((t) => t.id));
    return available.filter((t) => !have.has(t.id));
};
