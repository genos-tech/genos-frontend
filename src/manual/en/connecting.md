---
id: connecting
title: Connecting Genos to other tools: API, MCP, and realtime
settings: [developer, integrations]
---

## Connect an AI app (no API key)

You can let an AI app such as Claude or ChatGPT work in Genos as you. The app signs in with your Genos account, so you do not need an API key. When you approve the connection, you choose which teams the app may use and what it may do. Deleting stays off unless you tick it.

The quickest way is Settings → Developer → Connected apps → "Connect your AI". It has one tab per app (Claude Code, claude.ai & Desktop, ChatGPT), each with its steps and the exact address to paste. It also shows whether an app is connected and when one last did something in Genos.

The address looks like `https://<your Genos API address>/api/public/v1/mcp/core`. Copy it from the panel. Paste the whole address, including the path at the end, with no slash and nothing after it. Without the full path, Claude says it signed in and then reports that Genos refused its request.

**Claude Code**

1. In the Claude Code chat, run the two commands shown in the panel. They add the Genos plugin.
2. Run /mcp, sign in to Genos, then choose the team and what Claude may do.
3. Run /genos:setup. It checks the connection. If you say yes, it saves the Genos rules to your memory file.

If you do not want the plugin, the panel also shows one terminal command, `claude mcp add --transport http genos <address>`, which connects Genos on its own. The plugin adds ready-made skills you call by name, such as /genos:catchup.

**claude.ai and Claude Desktop**

1. In Claude, open Customize, then Connectors. Add Genos from the directory. If it is not listed yet, choose Add custom connector and paste the address.
2. Sign in to Genos when Claude asks. Choose the team and what Claude may do, then press Allow.

To add the plugin there instead, download the zip from the panel and upload it under Customize, Plugins.

**ChatGPT**

Genos is being listed in ChatGPT's directory. Until it is listed, on a ChatGPT plan that allows custom MCP servers, add one with the address and choose sign-in with OAuth. Then sign in to Genos and press Allow. This path has not been tested end to end with ChatGPT yet.

**What to know**

- Connecting an AI app needs the Core plan or above. On Free, the approval page says it is not on your plan. An app you connected earlier shows as Paused, and it works again once you are on Core or above.
- Before you approve an app, Genos asks for your password again ("Confirm it's you"). It does not ask again for 10 minutes. Accounts that sign in with Google or GitHub have no password, so they are not asked. Genos also emails you when a new app is connected to your account.
- Manage your apps under Settings → Developer → Connected apps. For each app you can change what it may do, add or remove teams, pick the default team, or press Revoke. A revoked app stops working on its next request.
- The app only sees what you can see in the teams you chose.
- When your Genos uses AI credits, a search by an AI app spends your credits, like a question asked in Genos. If you have no credits left, the search still answers, as a plain search.

## Who this page is for

This page is for anyone connecting Genos to something else: an AI app, a script, or another service. The section above needs no programming. If none of this is you, skip this page; nothing else in Genos depends on it.

An AI app or an API key acts as the person who connected or created it, so it only sees what that person can see. The realtime stream acts as whoever is signed in. Webhooks are the exception: a team owner or editor sets one up for the whole team, and it carries that team's events no matter who created it.

## Scripts and automation (API key)

Everything from here to the end of this page is the API-key way. It is for a script, another app, or an AI agent that cannot sign in to Genos.

## Getting a key

- Create keys in Settings → Developer → API keys. A key is shown once, when you create it. Copy it then, because you cannot read it again later. Revoke a key at any time, and it stops working on its next request.
- Choose Read or Read & write. A Read key sees what you can see and changes nothing. A Read & write key can also create and update.
- Keys made on that screen are personal. They act as you in every team you belong to, so each request has to name the team it means. Team keys, which are tied to one team, can only be made through the API, and only by a team owner or editor. Owners and editors see every team key under Team API keys.

"API keys and webhooks, step by step" has the details.

## Which one to use

- **The REST API**: for a script or another app that reads or creates Genos data when it needs to. It covers your projects, their tasks, and creating or updating single tasks. Use it for reports, imports, and anything you run on a schedule.
- **Webhooks**: when you would rather Genos told you. A team owner or editor gives Genos a public https address. Genos posts there when tasks change, or when messages arrive in the channels they choose.
- **MCP with an API key**: for an AI agent that cannot sign in. Add Genos to the agent as an HTTP MCP server at `https://<your Genos API address>/api/public/v1/mcp?team_id=<your team's id>`, with no slash before the question mark. Send the header `Authorization: ApiKey <your key>`. The scheme is the word ApiKey, not Bearer. A team key does not need the `team_id` part. MCP needs the Core plan or above.
- **The realtime stream**: for something live, such as a dashboard or a bot that reacts the moment a message arrives. It carries the same live events the Genos app uses: messages, reactions, read receipts and who is online. It signs in with a Genos login, not an API key. Use realtime where a person is signed in, and webhooks for one server talking to another.

## What an AI app can do

The address in the "Connect your AI" panel (ending in `/mcp/core`) gives an app the tools for day-to-day work: tasks, comments, notes, milestones, inbox, mentions, to-dos and calendar events. The full address (ending in `/mcp`) offers the whole catalog of tools. Six of those appear only when your Genos has the matching feature turned on. Read access lets an app read; "Make changes" lets it write; deleting needs its own tick.

## Checking it works

Start with `GET /api/public/v1/me/`. It returns the person, the key's name and scope, and the key's team. For a personal key the team is empty. That means you must name the team on each request yourself.

- The "Read the API docs →" link in Settings → Developer opens the Genos Developers page. It is the full reference for the REST API, MCP, webhooks and realtime events, with examples.

## Other connections

- Google: connect it in Settings → Integrations for Google Calendar.
- GitHub: connect it in Settings → Integrations to link pull requests to tasks.
- There are no live connections to Slack, Notion, Jira or Asana. You can import from them: tasks from a CSV, Jira or Notion export ("Import tasks from CSV…" in a project's menu), a whole Notion export folder as notes (Notes → Import → Whole folder), and, for a team owner, a Slack export as group chats ("Import from Slack…" in Team Profile).
