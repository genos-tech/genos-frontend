import axios from "axios";

import { getMessages } from "../../../i18n";
import { authApi } from "../../../services/api";
import { activeTeamId } from "./activeTeam";

export interface Connection {
    /** Server-side id of this specific connection. Every per-account
     *  operation (calendar reads/writes, disconnect) keys on it — a
     *  user can hold several Google accounts, and `provider` alone no
     *  longer identifies one. */
    id: string;
    /** `github_app` is the person's authorization of the Genos GitHub App (MIP-2090): a separate
     *  row from the `github` sign-in / legacy OAuth one, never a login. */
    provider: "google" | "github" | "github_app";
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

/** One installation of the GitHub App on an account, as linked to the active team. */
export interface GithubAppInstallation {
    installation_id: number;
    account_login: string;
    account_type: "User" | "Organization";
    repository_selection: "all" | "selected";
    /** GitHub suspended the installation: Genos reads nothing through it. */
    suspended: boolean;
    /** The installation's own settings page on GitHub (repositories are changed there). */
    manage_url: string;
}

/** Sent by the server ONLY while its GITHUB_APP_ENABLED switch is on (MIP-2090). A response
 *  without it means the App is off: every GitHub screen then behaves as it did before. */
export interface GithubAppBlock {
    enabled: boolean;
    team_id: string | null;
    /** The person may link an installation to this team (team owner or editor). */
    can_link: boolean;
    installations: GithubAppInstallation[];
}

export interface ConnectionsResponse {
    primary_auth_provider: "email" | "google" | "github";
    connections: Connection[];
    github_app?: GithubAppBlock;
}

/** The App block, or null when the switch is off or the server is older than this field. */
export const githubAppBlock = (data: ConnectionsResponse | null): GithubAppBlock | null =>
    data?.github_app?.enabled === true ? data.github_app : null;

/** The person holds an App authorization (and the server has the App on). Their GitHub calls then
 *  go through the App, whatever the team has installed. */
export const hasGithubAppConnection = (data: ConnectionsResponse | null): boolean =>
    githubAppBlock(data) !== null && !!data?.connections.some((c) => c.provider === "github_app");

/** The person has some GitHub connection: the legacy OAuth one, or the App's while the App is on
 *  (a leftover App row with the switch off is inert and does not count). */
export const isGithubConnected = (data: ConnectionsResponse | null): boolean =>
    !!data?.connections.some((c) => c.provider === "github") || hasGithubAppConnection(data);

/** The team's GitHub connection is the App (App on and an installation linked): the OAuth-era
 *  panels (register a repository, set up a webhook by hand) have nothing to do there. */
export const teamUsesGithubApp = (data: ConnectionsResponse | null): boolean =>
    (githubAppBlock(data)?.installations.length ?? 0) > 0;

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
        const fallback = getMessages().integrations.errors.disconnectFailed;
        if (axios.isAxiosError(error)) {
            const detail = (error.response?.data as { detail?: string })?.detail;
            setErrorMessage?.(detail || fallback);
        } else {
            setErrorMessage?.(fallback);
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
        // The active team scopes the App block (which installations this team has). Every
        // caller sends it, so the cards of one screen never disagree about the team.
        const teamId = activeTeamId();
        const res = await api.get<ConnectionsResponse>(
            "/integrations/me/",
            teamId ? { params: { team_id: teamId } } : undefined
        );
        return res.data;
    } catch (error: unknown) {
        if (axios.isAxiosError(error)) {
            console.error("listConnections error:", error.response?.status, error.response?.data);
        }
        setErrorMessage?.(getMessages().integrations.errors.connectionsLoadFailed);
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
        const fallback = getMessages().integrations.errors.disconnectFailed;
        if (axios.isAxiosError(error)) {
            const detail = (error.response?.data as { detail?: string })?.detail;
            setErrorMessage?.(detail || fallback);
        } else {
            setErrorMessage?.(fallback);
        }
        return false;
    }
};
