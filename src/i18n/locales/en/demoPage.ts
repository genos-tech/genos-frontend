// Copy for the public "/demo-guide" page (linked from the landing page).
// English is the base dictionary; other locales fall back to these values
// (same pattern as `featuresPage`). The Spotlight prompts stay in English on
// every locale because the demo workspace is seeded in English — the prompts
// must match the seeded content verbatim to return results.
//
// Prompt literals are copied verbatim from
// `genos-docs/spotlight/SPOTLIGHT_DEMO_VIDEO_SCRIPT.md`, which is kept in sync
// with `origin/services/demo_seeder.py`. Connection-gated acts (Tavily web
// search, GitHub, Google Calendar) are intentionally omitted — the demo user
// has none of those connected, so those prompts would answer "not connected".
export const demoPage = {
    meta: {
        backToHome: "Back to home",
        openApp: "Open Genos",
    },
    hero: {
        badge: "Demo guide",
        title: "Try Genos with sample data",
        lead: "Genos comes with a ready-made demo workspace — a small product team with real chats, tasks, and notes. Sign in as a demo user and use the prompts below to see how search and Genos AI actually work. No setup, no signup.",
    },
    login: {
        eyebrow: "Getting in",
        title: "Sign in as a demo user",
        lead: "You can explore the whole app without creating an account. It takes about a minute.",
        steps: [
            {
                title: "Open Genos",
                body: "Genos runs in your browser — nothing to install. Opening Genos takes you to the sign-in page.",
            },
            {
                title: "Click “Try with Demo User”",
                body: "No signup, no password. Genos creates a private demo team just for you and drops you straight into the workspace.",
            },
            {
                title: "Give search a few seconds",
                body: "The first time you open the demo, Genos indexes your workspace. If a search or question comes back empty, wait about 10 seconds and try again — it's just warming up.",
            },
        ],
        note: "Your demo account is automatically deleted after 24 hours (or when you sign out). Create an account any time to keep your work permanently.",
        cta: "Open Genos",
    },
    data: {
        eyebrow: "What's inside",
        title: "The demo workspace",
        lead: "A small software team mid-sprint. Everything overlaps on purpose, so questions have real, citable answers.",
        castTitle: "Your teammates",
        cast: [
            { name: "You", role: "Demo user" },
            { name: "Alice Chen", role: "Product Lead" },
            { name: "Bob Martinez", role: "Engineer" },
            { name: "Carol Park", role: "Designer" },
            { name: "Dan O'Connor", role: "QA" },
        ],
        cards: [
            {
                title: "Projects & tasks",
                body: "Two projects — Website Redesign and Q2 Roadmap — with milestones, sprints, and around two dozen tasks and sub-tasks. Some are deliberately messy, so Genos has something real to organize.",
            },
            {
                title: "Chats & threads",
                body: "Direct messages with Alice, Bob, and Carol, a team group channel, and a channel per project — each with threaded discussions full of actual decisions and trade-offs.",
            },
            {
                title: "Notes",
                body: "Specs, meeting notes, research methodology, and a “How to get the most out of Spotlight” guide — the kind of documents Genos AI reads and cites.",
            },
            {
                title: "Daily todos",
                body: "A few days of daily todos, tagged by project and overlapping with the rest of the work — so “what's on today?” has something to answer.",
            },
        ],
    },
    spotlight: {
        eyebrow: "The main event",
        title: "Use Genos AI yourself",
        lead: "Press ⌘K (Ctrl+K on Windows) anywhere in Genos to open Spotlight. Type a keyword to search, or ask a full question and press Enter for an answer with clickable citations. Every prompt below is written for the demo data.",
        copyHint: "Click any prompt to copy it, then paste it into Spotlight.",
        copyLabel: "Copy prompt",
        copiedLabel: "Copied",
        headlineBadge: "Headline",
        groups: [
            {
                id: "search",
                title: "Search across everything",
                desc: "Press ⌘K and just type. These are keywords, not questions — chats, tasks, and notes appear live as you type. Use ↑ / ↓ to highlight a result and Enter to open it.",
                prompts: ["framer-motion", "Plausible", "synthesis", "Cmd-K"],
            },
            {
                id: "ask",
                title: "Ask a question",
                desc: "Type a full question and press Enter. Genos picks the right tool — search, your task list, project analytics — and answers with citations you can click.",
                prompts: [
                    "What's the perf budget for the marketing site?",
                    "What are my open tasks?",
                    "How is the Website Redesign project going?",
                    "Who is on this team?",
                ],
            },
            {
                id: "reason",
                title: "Let it reason across sources",
                desc: "Some answers need more than one lookup. Watch the activity strip under the answer show each step as Genos chains chats, tasks, and notes together.",
                prompts: [
                    "Why did we rule out framer-motion?",
                    "What's blocking the homepage rebuild?",
                    "Summarize the customer interview signal so far.",
                ],
            },
            {
                id: "followup",
                title: "Keep the conversation going",
                desc: "Ask a follow-up right after the framer-motion answer. Genos remembers the thread, so “it” and “that decision” just work.",
                prompts: ["And what's the in-app animation decision?", "Who owns it?"],
            },
            {
                id: "todos",
                title: "Manage your day",
                desc: "Genos reads your daily todo list and can add or check off items. Every change pauses for your approval first — nothing is written silently.",
                prompts: [
                    "What's on my todo list today?",
                    "What's still open from earlier this week?",
                    "Add a todo: review the Plausible dashboard before standup",
                    "Mark the framer-motion review todo as done.",
                ],
            },
            {
                id: "thread",
                title: "Ask about one thread",
                desc: "These don't use ⌘K. Open any chat thread and click the ✨ in its header — Genos summarizes just that conversation, then answers questions scoped strictly to it.",
                prompts: [
                    "What did Bob argue against?",
                    "What were the suggested alternatives?",
                    "Who needs to act next?",
                ],
            },
            {
                id: "agent",
                headline: true,
                title: "Put Genos to work",
                desc: "The headline. Describe messy work in one sentence and Genos proposes the whole thing — a milestone with tasks, sub-tasks under work that already exists, a reprioritization, or a written note. Nothing is saved until you approve it in a single click.",
                prompts: [
                    "Create a milestone with tasks from the mobile speed discussion in the group chat.",
                    'Break the "Investigate slow homepage load on mobile Safari" task into sub-tasks based on its comments.',
                    'Reprioritize the tasks in the "Billing & Plans Revamp" milestone: blockers first, fix due dates that contradict the dependency order, and explain each change.',
                    'Research best practices for accessible color contrast and save it as a note called "Contrast research".',
                    "Write a plan document for the mobile Safari task and save it as a note on that task.",
                    'Refine my "How to get the most out of Spotlight" note — tighten the structure but keep all the content.',
                ],
            },
        ],
    },
    footerCta: {
        title: "Ready to try it yourself?",
        body: "Open Genos, click Try with Demo User, and paste in any prompt above.",
        button: "Open Genos",
    },
} as const;
