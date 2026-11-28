<!-- Generated from genos-docs/marketing/blog/connect-claude-without-an-api-key.md. Run npm run blog:sync; do not edit this copy directly. -->

![Settings, Developer: the Connect your AI panel with the Claude Code steps](/lp/guide/en/connect.webp)

You are working with Claude on something real: a release checklist, a client reply, a bug. Everything it needs to know is in your team's tasks and notes. So you start copying.

## Why it is hard

You paste a task into the chat, then the comments under it, then the note somebody mentioned. Claude gives a good answer, and now you copy it back and update the status yourself. Next session, you do it all again.

The usual way out is an API key: create one, store it somewhere, paste it into a config file, remember to remove it later. Many people stop right there, and a key left in a file is a risk of its own.

## How Genos helps

Claude signs in to Genos with your own account. There is no key to create or store. Open **Settings → Developer**, find **Connect your AI**, pick the tab for your app, and follow its steps.

```flow
Pick your app
Sign in to Genos
Choose teams and access
Ask Claude about your work
```

When you approve, you choose which teams it may use and what it may do. Deleting stays off unless you tick it. Genos may ask for your password again first, and it emails you when a new app is connected.

## What you get in the moment

Ask Claude what is waiting on you today, and it reads your tasks and mentions instead of your pasted excerpts. Ask it to turn the plan you just agreed into tasks, and it writes them into the project. Ask it to leave a comment on where the work stands, and your team can read it without having been in your chat.

That means:

- Less copying in both directions.
- Context that is current, because it is read from Genos when you ask.
- A record your team can use, not a conversation only you can see.

Its writes are marked in Genos, so you can tell them from your own. They happen at once, within the access you chose.

## Staying in control

Claude sees only what you can see in the teams you picked. Under **Connected apps** you can change what it may do, add or remove teams, or press **Revoke**. A revoked app stops working on its next request.

Connecting needs the Core plan or above. If your Genos counts AI credits, a search by a connected app spends them, like a question asked in Genos.

## How to start

1. Open **Settings → Developer → Connected apps → Connect your AI**.
2. Choose **Claude Code** or **claude.ai & Desktop** and copy what the panel shows.
3. Sign in, choose the team and the access, and ask: "What is waiting on me?"

In Claude Code, the Genos plugin also adds ready-made commands such as `/genos:catchup`.
