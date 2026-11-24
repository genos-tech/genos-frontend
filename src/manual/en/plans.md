---
id: plans
title: Plans, limits, and what happens when you hit one
settings: [planUsage, aiCreditUsage, spotlight.effort, spotlight.webSearch]
---

## Where to look

Settings > **Plan & Usage** shows your plan and how much of each limit you have left. **Compare plans** opens the plans page. It compares every plan and has the upgrade buttons. Payment goes through Stripe. **Manage billing** opens the Stripe portal, where you can change plan, update the payment method or cancel.

- **Your plan is your own.** Each person has a personal plan.
- **Team plan.** A team owner can also buy a per-seat team plan (**Team Core**, **Team Pro** or **Team Max**) on the plans page. Only the team owner sees that section. Every member of the team then gets at least that plan. Guests do not.
- **Which plan counts.** Genos uses the best of your own plan and the plans of every team you are a member of. Plan & Usage says "via team …" when a team's plan is the one that counts.
- **First month free.** When your Genos has it turned on, a new account gets Core free for its first 30 days, with no card. Plan & Usage then shows a **Free trial** chip and the end date. Genos also leaves an Inbox notice 5 days before the end and 1 day before. After that you go back to Free. Your data stays. Connected apps and scheduled reports pause until you are on a paid plan again.
- **Changing plan.** An upgrade takes effect at once and you pay the difference. A downgrade takes effect at the end of the billing period. If you cancel, you keep your plan until the end of the billing period.

## What each plan includes

These are the limits your Genos ships with. Plan & Usage shows the numbers that apply to you.

- **Free**: 20 AI asks a day; 50 tasks and 50 notes created a month; 180 days of message history; files up to 5 MB; 30 days of Genos conversation history. Genos answers questions, at Low effort, and sees only your workspace (no web search). No scheduled reports, no connected AI apps or MCP, no webhooks, no HTML notes, up to 3 skills.
- **Core**: 100 AI asks and 25 web searches a day; 200 tasks and 200 notes a month; 365 days of message history; files up to 25 MB; 180 days of Genos history. Genos can take actions for you, at up to Medium effort, and remembers your own history. It can search the web and use Google Calendar. Connected AI apps (MCP), up to 5 scheduled reports, up to 25 skills.
- **Pro**: 250 AI asks and 60 web searches a day; 500 tasks and 500 notes a month; unlimited message history; files up to 50 MB; 365 days of Genos history. Genos can organize whole plans, at up to High effort (tuned automatically), and draws on your team's knowledge. GitHub as well. Up to 20 scheduled reports, up to 100 skills.
- **Max**: 500 AI asks and 150 web searches a day; unlimited tasks and notes; unlimited message history; files up to 100 MB; unlimited Genos history. Same reach and depth as Pro. Up to 20 scheduled reports, unlimited skills.
- **Enterprise**: unlimited asks, searches, tasks and notes; files up to 200 MB; unlimited Genos history. Arranged through **Contact sales**, not bought in the app.

When Genos is not using AI credits, daily caps for premium AI models also apply, by plan.

Before Genos creates or changes anything for you in the app, it shows you what it will do and waits for your approval.

## Other limits by plan

- **Webhooks, per team**: Free none, Core 3, Pro 10, Max 25, Enterprise unlimited. The team's plan or the team owner's plan counts, whichever is better.
- **Scheduled reports, per person**: Free none, Core 5, Pro 20, Max 20, Enterprise 20.
- **Skills you own** (when your Genos has Skills turned on): Free 3, Core 25, Pro 100, Max and Enterprise unlimited.
- **HTML notes** (when your Genos has them turned on): not on Free; Core up to 512 KB a page and 100 HTML notes; Pro and up 1 MB a page and 500 HTML notes.
- **Connected AI apps and API keys**: Core and up. New connected apps and new API keys per person: Core 3, Pro 10, Max 25. Calls per minute for each key or app: Core 60, Pro 120, Max 240. Calls per day for each person: Core 3,000, Pro 10,000, Max 30,000. Enterprise has no limits. These limits are enforced only when your Genos is set to enforce them. Existing apps and keys keep working.

## AI credits

When your Genos uses AI credits, the monthly credits are your AI limit instead of the daily asks and web searches. Plan & Usage then shows a credit meter instead of the daily counts.

- Monthly credits: Free 5, Core 30, Pro 70, Max 150, Enterprise unlimited. They reset on the 1st of each month (UTC). Unused monthly credits do not carry over.
- These use credits: asking Genos (including running a skill), summaries of threads and notes, the AI sentences in scheduled reports, and AI searches run by your connected apps (Claude, ChatGPT or an API key). A simple question uses fewer credits; deeper work uses more. Searching in Spotlight without asking Genos uses none.
- One request costs at most 5 credits.
- Skills have an effort level (Low, Medium, High). When your balance is low, a skill run starts one level lower and says so.
- Settings > **AI credit usage** shows credits left, what you used this month by job, and recent charges.
- **Buy credits.** The plans page has **Need more credits?** with packs of 10, 50 or 100 credits. Your monthly credits are used first. Bought credits never expire. Packs are not sold on plans with unlimited credits, or when your Genos does not use credits.

## Hitting a limit

- **Low on credits**: you see "Running low — a long request may stop partway." You can still ask. A long request may stop partway when your balance runs out.
- **Out of credits**: Genos says "You've used all your AI credits, so Genos can't answer right now." and offers **Buy credits** and **Upgrade plan**. Summaries stop too. Scheduled reports still arrive, without their AI sentences. Searches by your connected apps still answer, as plain searches without AI, and say so.
- **Daily limits** (when Genos does not use credits): asks and web searches reset at midnight UTC. Nothing is lost.
- **Monthly task and note limits**: you see "You've created all … for this month." The count resets on the 1st (UTC). Deleting a task or note does not give you the count back.
- **History limits hide; they do not delete.** Messages and Genos conversations older than your plan's window stop showing. Upgrading brings them back.
- **Upload refused as too large**: that is your plan's per-file limit, not a broken file. The limit is per file, not per day.
- **Over a count limit** (webhooks, scheduled reports, skills, connected apps, API keys): only new ones are refused. What you already have keeps working after a downgrade. Paused schedules and connected apps work again once you are back on a plan that includes them.
