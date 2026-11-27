---
id: genos-ai
title: Genos AI: ask, act, and stay ahead
settings: [spotlight, spotlight.provider, spotlight.effort, spotlight.model, spotlight.aiAnswers, spotlight.webSearch, spotlight.contentLength, spotlight.sharedAnswers, spotlight.noteActivity, spotlight.scheduleMode, spotlight.scheduleEffort, spotlight.scheduleDeliver, spotlight.scheduleDashboardKind, spotlight.scheduleDashboardPeriod, spotlight.scheduleDashboardFocus]
---

## Where you ask Genos

Genos is the AI in your workspace. You can ask it from three places:

- **Spotlight**, the quick-ask box. Press Cmd-K (Ctrl-K on Windows and Linux) anywhere. Type a few words to search, or write a question and press Enter to ask Genos.
- **The Genos page.** Click Genos in the left sidebar. The page has the same box, a few "Try asking" starter questions, and your Ask history beside the conversation.
- **On the thing itself.** A thread and a note each have an Ask button in their header. It shows a summary first, and then you can ask follow-up questions about that one thread or note. A task or milestone has "Ask Genos about this task" (or milestone) in its ... menu, and that conversation stays with the task. A chat message has "Ask Genos about this message", and you can also select text and choose "Ask Genos about the selected text". Calendar events, projects ("Ask Genos about progress") and sprints have their own Ask entries too.

Genos reads only what you can open yourself: your chats, tasks, notes and to-dos. It cannot see a teammate's private notes or a chat you are not in.

## Asking well

- Type @ to pick a person or a mention group, and # to pick a task, project, note or chat. This tells Genos exactly what you mean.
- Answers link to their sources. Click a link to open the source and check it.
- Under an answer you can Copy answer, Save as note (it goes to My Notes), or Save as task. You can also rate the answer with Good answer or Needs work.
- If you close Spotlight, a thread window or a note window while an answer is still being written, Genos keeps working. When it finishes you get a "Your AI answer is ready" notification. You can turn this off under AI answer ready in Settings > Notifications.

## What Genos can do on your plan

What Genos can do depends on your plan:

- **Free:** Genos answers, searches and summarizes. It cannot create or change anything. If you ask it to make a task or a note, it writes the full text for you to paste.
- **Core:** Genos can also make one change at a time, for example create or update a task, write or edit a note, add a comment, add a to-do, or manage a calendar event once Google Calendar is connected. It can search the web, and it can look back through your past Genos conversations.
- **Pro and Max:** Genos can also make larger changes in one step. For example, it can create a milestone with all of its tasks, update many tasks at once, or set task dependencies. It can also read GitHub pull requests once GitHub is connected.

## Nothing changes without your approval

- Before every change, Genos shows a card titled "Approval required" with exactly what it will create or change. Click Approve or Reject.
- For many changes you can click Edit and fix a title, a date or a sentence before you approve.
- A card marked "Can't be undone" tells you before you approve that this change cannot be reversed.
- After you approve, many changes show an Undo button. Undo puts back what that one change did. It works for up to 7 days, as long as nothing has changed the item since then. Undo cannot take back notifications, messages or emails that were already sent.

## Skills

A skill is a note of written steps with a name. In the box, type / at the start of your question to pick a skill and run it. A skill is either "Read only" or "Read and propose changes". If it proposes a change, the change still waits for your approval. You write and share skills in Settings > Genos > Skills. Skills are there only when your Genos has them turned on.

## Scheduled reports by Genos AI, and dashboard pages

A schedule (Settings > Genos > Schedules, Core and above) prepares a report at times you choose. Most reports are plain: built from your data, with no AI and no credits.

**Scheduled job by Genos AI.** Six reports have a **Mode** choice, plain or Scheduled job by Genos AI: What to do today, What is left from last week, Project updates, Milestone updates, Team activity and Dashboard page. Plain is the default. Group chat catch-up and What you did cannot use AI. Run a skill always uses AI.

- In What to do today, AI adds one short sentence under a task when its comments explain where it stands. In the other reports, AI adds a short summary (2 to 4 sentences) at the top, written from what the report already lists.
- **AI effort** (Low, Medium or High) appears only when AI is on. The form shows an estimate of the credits one run uses, and each report shows the real figure. If your plan does not allow the level a saved schedule asks for, the form says which level your plan runs it at.
- AI uses your AI credits. When you have none left, AI cannot be turned on, and a schedule that already has AI on still sends its report, without the AI part. If your Genos has AI reports turned off, the report also arrives without the AI part.

**AI reports in shared chats.** Turning AI on does not widen or narrow who may receive a report: a report goes only to the chats that would take its plain version. The post in the chat includes the AI sentences, but never what the run cost. The cost is shown only to you, in your Inbox. No notification is sent for the post. A scheduled skill is different: it runs on your own skills and data, so it can only be posted in a chat that only you are in.

**Dashboard page.** This report keeps one dashboard page up to date: counts by status and what was closed and created. A milestone page also lists what is ready to start and what is blocked. My progress shows what you closed and created. Choose:

- **Dashboard of:** one milestone, one project, or My progress.
- **Period:** Last week, Last month (the default), Last quarter or Last year. This is how far back the numbers go, not how often the schedule runs. A schedule runs on its own at most once a day (Run now is extra).
- **Focus:** optional, a few words on what the page should look at.

**Links.** The names on the page (the project or milestone in the title, and the tasks it lists) are links: click one to open it in Genos. A page made by a skill can link the tasks, milestones, projects and notes that its run read. Genos writes every link itself, and only to things the page's readers can open. A page you or an AI app saved by hand has no such links.

The first run saves the page as one HTML page in your notes, and each run after replaces it with the new numbers. Dashboards need a plan that has HTML pages (Core and above). Each run counts toward your plan's HTML page saves per hour (30 on Core, 60 on Pro and above). You can keep up to 10 dashboard schedules.

- **Who can read it.** The page names only tasks that everyone who can read the note may open. A project or milestone dashboard is refused when someone who can read the note is not on that project, and the message names nobody. My progress counts only the projects all of its readers are on, and, when others can read the page, says so on the page.
- **AI summary.** With AI on, the page also gets one short summary. If nothing the page shows has changed since the last AI run (the numbers, the lists and the focus, within 8 days), Genos reuses that summary and spends no credits. If your Genos has AI dashboard summaries turned off, the page is plain. If you have no credits left, the page is plain unless an unchanged summary from the last 8 days can be reused.
- **In a chat.** A dashboard schedule that posts to a chat sends a short notice with the title, one line and a link to the page, not the full report. Every person who reads the chat must be able to open the page. If not, the run fails and posts nothing.
- **Where to find them.** Task Stats has a **Custom dashboards by AI** tab. It lists the dashboards your schedules keep up to date (Yours) and dashboards teammates share with you (Shared with you). Only pages you can already open are listed. From there you can open the page, click **Run now**, or add a **New dashboard**, which opens the same schedule form.
- **From an AI app.** A connected AI app (Claude, ChatGPT) can create or edit a dashboard schedule for you, including the chat it posts to and the place the page is saved. It asks for your approval first, and the same rules apply.

## AI use and credits

- Each ask, summary and AI report uses your plan's AI allowance. Depending on how your Genos is set up, this is either monthly AI credits or daily ask limits. Settings > Plan & Usage shows which one applies to you, and Settings > AI credit usage shows what used your credits.
- When credits run low, a long request may stop partway. When they run out, Genos cannot answer until they renew, or until you buy credits or upgrade. Search still works.

## Settings for Genos

All of these are in Settings > Genos. The gear in Spotlight and on the Genos page opens the first three, plus What Genos remembers.

- **AI model:** which model answers you. On some Genoses this shows an Effort choice (Low, Medium or High) instead. Free can use Low, Core can go up to Medium, and Pro and above can use High. Providers marked "Available soon" cannot be chosen yet.
- **Genos answers:** AI answers lets the Ask button send your question to Genos. When it is off, Spotlight shows search results only. Web search lets Genos use the web when it answers. It is off until you turn it on, needs AI answers to be on, and is included from Core up.
- **How much Genos writes:** Short, Standard or Long. This sets the length of the tasks, milestones, notes and plans Genos writes for you. Chat answers stay short at every level.
- **Genos Assist Schedules (Core and above):** Genos prepares a report at times you choose and puts it in your Inbox, or posts it in a chat. The reports are Group chat catch-up, Project updates, Milestone updates, Team activity, What is left from last week, What you did, What to do today, Dashboard page, and Run a skill (where Skills are on). Some can run in AI mode, and Dashboard page keeps a living page: see "Scheduled reports by Genos AI, and dashboard pages" above. Core can have 5 schedules, Pro and Max 20. Click Run now to get a report straight away. A schedule pauses itself after 3 failed runs in a row.
- **What Genos remembers:** see and delete your Genos conversations. Here you also choose whether your answers may help teammates ("Let my answers help teammates", off by default for new accounts) and whether Genos notes what your connected AI apps do ("Note my activity", kept 180 days). You can see and delete what Genos stored, and set how Genos weighs things when it ranks your tasks.
