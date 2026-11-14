/**
 * "Connect an AI app" (the OAuth way of using Genos over MCP): the English sentences.
 *
 * A standalone file, not inside `settings.ts`, because two surfaces print it: the
 * Settings panel (`settings.connectedApps.connect`, all 7 locales) and the English-only
 * public `/developers` page, which imports this file directly (`lp/DevelopersPage.tsx`)
 * so the two cannot drift and the marketing bundle does not pull in the catalog.
 *
 * Every sentence says what genos-docs `operations/MCP_OAUTH_CLIENTS.md` and
 * `OAuthConsentPage` do. Vendor menu names (Customize, Connectors, Add custom
 * connector) are the ones that doc records as documented by Anthropic; they were not
 * clicked through, and they stay in English in every locale.
 */
export const connectApp = {
    title: "Connect an AI app",
    intro: "No API key needed. Add the address below to the app, sign in to Genos when it asks, then choose what the app may do.",
    urlLabel: "Address to paste into the app",
    copy: "Copy",
    copied: "Copied",
    copyAria: "Copy the address",
    copyFailed: "Couldn't copy automatically. The text is selected: copy it with your keyboard.",
    codeLabel: "Command to run",
    copyCommandAria: "Copy the command",
    claudeTitle: "claude.ai and Claude Desktop",
    claudeSteps: [
        "In Claude, open Customize, then Connectors, and choose Add custom connector.",
        "Paste the address above and confirm.",
        "Sign in to Genos when Claude asks.",
        "On the approval page, choose the team and what the app may do: read, make changes, and deleting, which starts unticked.",
        "Press Allow.",
    ],
    claudeCodeTitle: "Claude Code",
    claudeCodeSteps: [
        "Run this command in your terminal.",
        "In Claude Code, run /mcp and sign in to Genos.",
        "On the approval page, choose the team and what it may do, then press Allow.",
    ],
    chatgptTitle: "ChatGPT",
    chatgptBody: "Coming: Genos is being listed in ChatGPT's directory.",
    plan: "Connecting needs the Core plan or above. On Free, the approval page says it isn't on your plan.",
    revoke: "To disconnect an app, revoke it under Settings → Developer → Connected apps.",
    trap: "Paste the whole address, including the path at the end. Without it Claude says it signed in, then reports that Genos refused its request.",
    menuNote: "Menu names in other apps change: look for connectors, or custom MCP servers.",
};
