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
