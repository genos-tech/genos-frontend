---
id: playbooks
title: Playbooks: how different kinds of work fit Genos
settings: [tasks.autoCloseOnPrMerge, integrations, spotlight]
---

## How to read this page

Genos does not assume you write software. Below is one starting shape for each kind of work. Pick the closest one and ignore the rest. They all use the same three pieces, chat, tasks and notes, arranged in different ways.

## Engineers

- Make one project per service or repository.
- Connect GitHub in Settings → Integrations. If your team uses the Genos GitHub App, a team owner or editor installs it once for the team, and then each person presses Authorize. The app is read-only and has no access to code. A connection made the old way shows a note and a Reconnect button. Press Reconnect to switch to narrower, per-repository access.
- To close tasks automatically, "Close my tasks when their PR merges" in Settings → Tasks is on by default for new accounts; accounts made before that keep their own choice, and you can turn it off or on there. When a pull request merges, Genos closes the task whose ID is in the PR's branch name (for example, branch `feature/GEN-42-foo` closes GEN-42). It only closes tasks assigned to you. If a task has several PRs, it closes when the last open one merges.
- Use dependencies for real blockers. If you mark task B "Blocked by" task A, Genos sets B to Blocked. When A finishes, Genos moves B back to Open. "Open task graph" shows what is holding a milestone up.
- Keep design docs in the task's own notes, so the plan stays with the work.
- Ask Genos, for example "what changed in the API project this week?", instead of reading the whole channel.
- To let Claude Code or another AI app work on your tasks, see "Connecting Genos to other tools: API, MCP, and realtime".

## Product and project managers

- Use milestones for dated outcomes, sprints for a regular rhythm, and the task table when you need a spreadsheet view.
- When you rebuild the same filters again and again, use Saved Filters → "Save current filters…". A saved filter is shared with everyone in the project.
- In Customize Task Fields, add the custom fields your process needs and mark them required. Then a task cannot be created without them.
- Task Weight, Team Capacity and Velocity on the dashboard help you check whether a plan is realistic.
- For a regular status report, add one in Settings → Genos → Genos Assist Schedules (Core and up). At the times you choose, Genos sends the report to your Inbox or posts it in a chat. Available reports include project and milestone updates, team activity, and what to do today.
- Ask for status instead of putting it together yourself: "what's at risk before Friday?", "what did we close last sprint?"

## Marketing

- Make one project per campaign or channel, with a milestone for each launch date. Tag tasks by medium (blog, email, social, paid), then filter to one medium at a time.
- Draft copy in notes, where several people can write in the same document at once. Put the brief in the task's note, above the drafts.
- Keep approvals in the campaign's chat, so they stay with the work. Turn the decisions that need follow-up into tasks.

## Research and analysis

- Write one note per source or interview, with a folder per study. Make one task per open question. The notes hold the material; the tasks hold what you still owe.
- Genos shows the sources it used for an answer. Click a source to open the exact note before you quote it.
- To ask questions about one long document, use the Ask button in the note's header.
- To bring in existing material, use Notes → Import. "Whole folder" turns a folder tree, such as a Notion export, into note folders and notes.

## Students

- Make one project per course, a milestone per exam or deadline, and a notes folder per subject. Due dates put every course on one calendar.
- To-Do is a checklist for each day, separate from your coursework tasks. It suits study sessions.
- Before an exam, ask about your own notes: "explain what I wrote about elasticity". Use group chats for study groups.

## Operations, back office, and support

- Keep recurring procedures as checklists in notes, with one task per run. Project templates (in the project menu) give each run the same starting text.
- Make one project per process, such as onboarding, invoicing or vendor reviews. Use required fields for details that must never be missing.
- In chat, "Flag for later" keeps a message as a personal follow-up, and "Remind me…" brings it back at a time you choose. Turn requests that need tracking into tasks.
- Every task keeps a history of who changed what and when.
- To move work over from another tool, use "Import tasks from CSV…" in the project's menu. It reads CSV files, including Jira and Notion database exports, and Jira JSON files. A team owner can also bring a Slack export into group chats with "Import from Slack…" in Team Profile.

## Repeat your own steps with Skills

If your Genos has Skills turned on, you can write a set of steps once and run it again later. Open Settings → Genos → Skills and create a skill. A skill can be just for you or shared with your team. To run it, type / at the start of a question in Spotlight and pick the skill. A Genos Assist Schedule can also run a skill at set times. It runs the published version, which only reads and changes nothing.

## Whatever the work is

The pattern under all of these is the same. Discussion goes in chat, commitments become tasks, and lasting knowledge goes in notes. Genos reads all three, so you can ask instead of hunting. Start with one real project rather than a perfect structure. The structure is easy to change later.

## A whole company

Setting Genos up for a company with many departments? Read "Organising a large workspace: one team, many departments" and "Setting up Genos for your company: an owner's checklist".
