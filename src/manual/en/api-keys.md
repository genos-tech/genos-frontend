---
id: api-keys
title: API keys and webhooks, step by step
settings: [developer]
---

## Connect an AI app (no API key)

To connect Claude, ChatGPT or another AI app, you do not need a key. Open Settings → Developer → Connected apps → "Connect your AI", pick your app, and follow the steps. The app signs in to Genos as you. On the approval page you choose the teams it may use and what it may do: read, make changes, and deleting, which starts unticked. Then press Allow. Connecting needs the Core plan or above.

The address to paste is shown in that panel. It looks like `https://<your Genos API address>/api/public/v1/mcp/core`. Paste it whole, including the path, with nothing after it.

To end an app's access, open Settings → Developer → Connected apps and press Revoke. It stops working on its next request. "Connecting Genos to other tools: API, MCP, and realtime" has the steps for each app.

## Making a key

1. Open Settings → Developer → API keys.
2. Type what the key is for, for example "CI bot".
3. Choose Read or Read & write.
4. Choose when it expires ("Expires after": 30, 90, 180 or 365 days). The default is 90 days, and no key lasts longer than a year. After that, you make a new key.
5. For a Read & write key only, you can tick "Also allow actions that can't be undone or that change who has access". This covers deleting calendar events, milestones, sprints, notes and note folders, adding people to projects or approving their requests to join, and sharing notes. It is off by default. Leave it off unless the key really needs it.
6. Press "Create key". Genos asks for your password again ("Confirm it's you") and does not ask again for 10 minutes. Accounts that sign in only with Google or GitHub have no password and are not asked.

- The key is shown once ("Copy your API key now"). Copy it straight into wherever it will live. You cannot read it again later. If you lose it, revoke it and make another.
- Keys begin with `gnos_`, so you can spot one in a log. The list shows only the first characters.
- Genos emails you when a key is created on your account. If it was not you, revoke the key.
- A key acts as you: anything you can see, it can see. Treat it like a password. Never put it in a public repository or in code that runs in a browser.
- Revoking a key stops it on its very next request, and a revoked key cannot be turned back on. This is the right response to a key you think has leaked.
- Keys made before every key had to expire say "Never expires — replace it with a new key". Replace them.

## Team API keys

A team key is tied to one team instead of to you. Only a team owner or editor can create one, through the API. Owners and editors see every live team key under Team API keys, with who made it. The owner can revoke any team key. An editor can revoke a viewer's key or their own. A team key also stops working when its creator leaves the team.

## Using a key

Send the header `Authorization: ApiKey <your key>`. The scheme is the word ApiKey. Bearer is for the app's own sign-in and is refused here. A key also cannot create or delete keys, so a leaked key cannot make more of itself.

- `GET /api/public/v1/me/`: who the key acts as, its scope and its team. Start here to prove the key works.
- `GET /api/public/v1/projects/`: your projects.
- `GET` and `POST /api/public/v1/tasks/`: list tasks, or create one.
- `GET` and `PATCH /api/public/v1/tasks/<id>/`: read or update one task.
- `GET /api/public/v1/openapi.json`: the machine-readable description of all of the above. It is the one address that needs no key.
- Each key may make 120 REST requests a minute.
- A personal key belongs to you, not to one team, so each request must say which team it means. That is why `me/` shows no team for it. A team key carries its own team.

## Limits by plan

- REST API keys work on every plan.
- MCP (an AI agent using your key, or a connected AI app) needs the Core plan or above.
- Your Genos can also limit AI-app use by plan. When those limits are turned on: MCP calls per minute, per key or connected app, are 60 on Core, 120 on Pro and 240 on Max. Calls per day, per person, are 3,000, 10,000 and 30,000. Active API keys and connected apps are each capped at 3, 10 and 25. Only new ones are refused; the ones you have keep working.

## Webhooks

A webhook is Genos telling your server when something happens, instead of your script checking on a timer. In Settings → Developer → Webhooks, a team owner or editor adds one:

1. Type an https address. It must be a public address.
2. Tick the events it should receive: task.created, task.updated, task.completed, task.comment_created, message.created.
3. Optional: choose projects. If you choose none, every project counts.
4. For message.created, you must choose the channels to watch, because message text is sent to your address. If you choose none, no chat events are sent. Direct messages can never be sent to a webhook.
5. Press "Add webhook". Genos asks for your password again, as for a key, and emails you that a webhook was added.

- The signing secret is shown once ("Copy your signing secret now"). Use it to check the X-Genos-Signature header on each delivery.
- If your address fails 10 times in a row, Genos switches the webhook off. It then shows "Disabled after repeated failures". Fix your endpoint, delete the webhook, and add it again. Adding it again creates a new secret.
- Webhooks count per team: none on Free, 3 on Core, 10 on Pro, 25 on Max. The team's plan or the team owner's plan, whichever is better, decides. A disabled webhook still counts until you delete it. Existing webhooks keep delivering after a downgrade.

## The team's view (owners and editors)

Below your own keys, Settings → Developer also shows a few sections to team owners and editors:

- **Team API keys**: every key that can act on this team (see above).
- **Connected AI apps**: AI apps that members connected and that can work in this team. The owner can end any of them; an editor can end a viewer's. "End access to this team" removes only this team; that person's other teams keep working.
- **AI app use** (owner only): how much each member's AI apps did in this team, by week. Counts only: what they read or searched is not shown.
- **Security log** (owner only): sensitive changes to this team, newest first. It covers members joining and leaving, role and ownership changes, invites, API keys, webhooks and alerts. Entries are kept for 365 days.

## Things that don't exist yet

- Public links. Nothing in your workspace can be opened by someone who is not signed in and allowed. A link you paste anywhere still checks the reader's access.
- Spreadsheet export. Settings → Account → "Download my data" exports your own data as JSON, and a note can be exported as Markdown from its menu. There is no CSV export of tasks or chat.
- Live connections to Slack, Notion, Jira and Asana. Google and GitHub are the two integrations. You can import tasks from CSV, Jira and Notion exports, notes from a Notion export folder, and (team owner) a Slack export into group chats.

## The full reference

The "Read the API docs →" link in Settings → Developer opens the Genos Developers page. It is the complete reference for everything above, with every field, every event payload, and examples.
