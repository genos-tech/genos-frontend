/**
 * Connecting an AI app (Claude, ChatGPT...) to Genos over MCP, the OAuth way.
 *
 * ONE place for what two surfaces both print: Settings → Developer → Connected apps
 * (the app) and the public `/developers` page. They are separate bundles with
 * separate chrome, so what they share is DATA, here, and the English sentences in
 * `i18n/locales/en/connectApp.ts`.
 *
 * The address is the API origin plus the MCP path, typed EXACTLY: no trailing slash
 * and no query string. It is also the `resource` the token is issued for, so the
 * app's own origin, a trailing slash, or a `?team_id=` (that one is the API-key
 * form: with OAuth the team is chosen on the consent page) all end in "signed in,
 * but refused" (genos-docs `operations/MCP_OAUTH_CLIENTS.md` §1). Never hard-code the
 * host: it is the deployment's own API origin.
 */

export const MCP_PATH = "/api/public/v1/mcp";

/**
 * The MCP address for an API origin. Whatever trails the origin (slashes, a query,
 * a fragment) is dropped, so the result never ends in "/" and never carries a query.
 * An empty origin gives "" (the caller hides the address rather than show a relative
 * one that would be pasted into an app and fail).
 */
export const mcpServerUrl = (apiOrigin: string | null | undefined): string => {
    const origin = (apiOrigin ?? "")
        .trim()
        .replace(/[?#].*$/, "")
        .replace(/\/+$/, "");
    return origin ? `${origin}${MCP_PATH}` : "";
};

/** The one-line Claude Code setup for OAuth: no `--header`, no key. */
export const claudeCodeAddCommand = (url: string): string =>
    `claude mcp add --transport http genos ${url}`;
