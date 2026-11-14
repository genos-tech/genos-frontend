import { authApi } from "./api";

/** One connected AI app (Claude, ChatGPT…) that can work in the team (MIP-1371). */
export interface TeamMcpConnection {
    id: string;
    userId: string;
    userName: string;
    /** Owner only: the server leaves the key out for an editor (api #825), so never assume it. */
    userEmail?: string;
    client: { name: string; kind: string; host: string; url: string };
    scope: "read" | "write";
    allowDestructive: boolean;
    isDefaultTeam: boolean;
    /** How many OTHER teams of that person the app can also work in. */
    otherTeams: number;
    lastUsedAt: string | null;
    createdAt: string;
    /** May THIS caller end it: the owner anyone's, an editor a viewer's or their own. */
    revocable: boolean;
}

/** Every connected AI app that can work in `teamId`, whoever connected it. Owner or editor;
 *  the server answers 404 to everyone else, which is `null` here ("don't show the section"). */
export const listTeamMcpConnections = async (
    accessToken: string | null,
    teamId: string
): Promise<TeamMcpConnection[] | null> => {
    const api = authApi(accessToken);
    if (!api) return null;
    try {
        const res = await api.get<{ connections: TeamMcpConnection[] }>("/team/mcp-connections/", {
            params: { team_id: teamId },
            suppressErrorToast: true,
        });
        return res.data.connections ?? [];
    } catch {
        return null;
    }
};

/** End an app's access to THIS team. Their other teams keep working; an app left with no team
 *  ends. Throws the server's reason so a confirm dialog can show it. */
export const endTeamMcpConnection = async (
    accessToken: string | null,
    teamId: string,
    connectionId: string
): Promise<{ ended: boolean }> => {
    const api = authApi(accessToken);
    if (!api) throw new Error("Not signed in.");
    try {
        const res = await api.delete<{ ended: boolean }>(
            `/team/mcp-connections/${connectionId}/`,
            {
                params: { team_id: teamId },
                suppressErrorToast: true,
            }
        );
        return res.data;
    } catch (error: unknown) {
        const message = (error as { response?: { data?: { error?: string } } })?.response?.data
            ?.error;
        throw new Error(message || "Couldn't end that connection. Please try again.");
    }
};

/** A pending team invitation. */
export interface TeamInviteRow {
    id: string;
    email: string;
    memberRole: string;
    projectId: number | null;
    projectName: string | null;
    invitedBy: string | null;
    expiresAt: string;
    createdAt: string;
}

/** The invitations still waiting, newest first. Owner or editor; `null` otherwise. */
export const listTeamInvites = async (
    accessToken: string | null,
    teamId: string
): Promise<TeamInviteRow[] | null> => {
    const api = authApi(accessToken);
    if (!api) return null;
    try {
        const res = await api.get<{ invites: TeamInviteRow[] }>("/team/invites/", {
            params: { team_id: teamId },
            suppressErrorToast: true,
        });
        return res.data.invites ?? [];
    } catch {
        return null;
    }
};

/** Cancel a pending invitation: the link in the email stops working at once. */
export const revokeTeamInvite = async (
    accessToken: string | null,
    teamId: string,
    inviteId: string
): Promise<void> => {
    const api = authApi(accessToken);
    if (!api) throw new Error("Not signed in.");
    try {
        await api.post(
            "/team/invite/revoke/",
            { team_id: teamId, invite_id: inviteId },
            { suppressErrorToast: true }
        );
    } catch (error: unknown) {
        const message = (error as { response?: { data?: { error?: string } } })?.response?.data
            ?.error;
        throw new Error(message || "Couldn't cancel that invite. Please try again.");
    }
};
