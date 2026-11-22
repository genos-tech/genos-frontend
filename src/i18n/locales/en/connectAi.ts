/**
 * Settings → Developer → "Connect your AI" (MIP-2020): per-app steps, one personal
 * preference to copy, and a connection check.
 *
 * In-app only (the public /developers page keeps the shorter `connectApp.ts` text), so
 * unlike that file it is not shared with the marketing bundle. The address and the
 * commands are built in code (`utils/mcpConnect.ts`), never written here.
 *
 * Vendor menu names (Customize, Connectors, Add custom connector, Settings → Profile)
 * are the other app's own labels and stay as that app shows them in every locale.
 * ChatGPT's steps follow genos-docs `operations/MCP_OAUTH_CLIENTS.md` §3: the path is
 * documented by OpenAI but was never run against Genos, and the directory listing is
 * not published yet, so the text says so.
 */
export const connectAi = {
    title: "Connect your AI",
    intro: "No API key needed. Pick your app, follow the steps, and sign in to Genos when it asks.",
    // The connection check.
    statusNone: "Not connected yet. Pick your app below.",
    statusConnected: "Connected",
    statusActivity: "Agent activity seen {when}",
    statusNoActivity: "No agent activity seen yet. Ask your AI about your Genos tasks to try it.",
    // Free plan.
    freePlan: "The Genos connector needs the Core plan or above, and you are on Free.",
    // Tabs.
    tabsAria: "Choose your AI app",
    tabClaudeCode: "Claude Code",
    tabClaudeDesktop: "claude.ai & Desktop",
    tabChatgpt: "ChatGPT",
    // Claude Code.
    claudeCodeSteps: [
        "Run these two commands in the Claude Code chat, one after the other.",
        "Run /mcp, sign in to Genos, then choose the team and what Claude may do.",
    ],
    claudeCodeCommandLabel: "Commands for the Claude Code chat",
    claudeCodeCommandAria: "Copy the two plugin commands",
    claudeCodeAloneLabel:
        "No plugin? This one command in your terminal connects Genos on its own.",
    // claude.ai and Claude Desktop.
    claudeDesktopSteps: [
        "In Claude, open Customize, then Connectors. Add Genos from the directory; if it is not listed yet, choose Add custom connector and paste the address below.",
        "Sign in to Genos when Claude asks, choose the team and what Claude may do, then press Allow.",
    ],
    claudeDesktopAddressLabel: "Address for the custom connector",
    // ChatGPT.
    chatgptSteps: [
        "Genos is being listed in ChatGPT's directory. Once it is, add it from there.",
        "Until then, on a ChatGPT plan that allows custom MCP servers, add one: paste the address below and choose sign-in with OAuth.",
        "Sign in to Genos when ChatGPT asks, choose the team and what ChatGPT may do, then press Allow.",
    ],
    chatgptAddressLabel: "Address for the custom MCP server",
    chatgptNote:
        "Not tested end to end with ChatGPT yet. ChatGPT's menu names change: look for plugins or custom MCP servers.",
    // The optional one-line preference.
    prefTitle: "Optional: have your AI keep Genos up to date",
    prefIntro:
        "Paste this one line into your AI app once, and it keeps your tasks, decisions and progress in Genos without being asked in every chat.",
    prefLabel: "Preference to paste",
    prefText: "When I work, keep Genos up to date: tasks, decisions and progress.",
    prefCopyAria: "Copy the preference",
    prefWhereClaudeCode:
        "Claude Code: add it to your CLAUDE.md (the one in your home .claude folder applies to every project).",
    prefWhereClaudeDesktop:
        "claude.ai and Claude Desktop: paste it under Settings → Profile, in personal preferences.",
    prefWhereChatgpt:
        "ChatGPT: paste it into its custom instructions (Settings → Personalization).",
};
