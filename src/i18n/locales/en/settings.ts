export const settings = {
    title: "Settings",
    tabs: {
        general: "General",
        planUsage: "Plan & Usage",
        chat: "Chat",
        tasks: "Tasks",
        spotlight: "Spotlight",
        notifications: "Notifications",
        mentionGroups: "Mention groups",
        customEmoji: "Custom emoji",
        shortcuts: "Shortcuts",
        integrations: "Integrations",
    },
    planUsage: {
        heading: "Plan & Usage",
        description: "Your current plan and how much of each limit you've used.",
        viaTeam: "via team {team}",
        tierFree: "Free",
        tierCore: "Core",
        tierPro: "Pro",
        tierMax: "Max",
        tierEnterprise: "Enterprise",
        unlimited: "Unlimited",
        todaySuffix: "today",
        monthSuffix: "this month",
        aiAsks: "AI asks",
        webSearches: "Web searches",
        tasksCreated: "Tasks created",
        notesCreated: "Notes created",
        messageHistory: "Message history",
        messageHistoryDays: "Last {days} days",
        maxFileSize: "Max file size",
        maxFileSizeMb: "{mb} MB per file",
        upgradeCta: "Upgrade plan",
        upgradeComingSoon:
            "Self-serve upgrades are coming soon. Contact your workspace admin to change plans.",
        loadError: "Couldn't load your plan details. Please try again.",
        upgradeToCore: "Upgrade to Core",
        upgradeToPro: "Upgrade to Pro",
        upgradeToMax: "Upgrade to Max",
        switchToCore: "Switch to Core",
        switchToPro: "Switch to Pro",
        switchToMax: "Switch to Max",
        cancelPlan: "Cancel plan",
        changeTeamPlan: "Change plan",
        planChangeHint:
            "Pick any plan below to switch — Stripe prorates the difference. Cancelling keeps your plan until the end of the current billing period.",
        manageBilling: "Manage billing",
        manageBillingHint: "Change plan, payment method, or cancel via the secure Stripe portal.",
        upgradeHint: "Checkout is handled securely by Stripe.",
        billingError: "Couldn't reach the billing service. Please try again.",
        billingReturnSuccess:
            "Thanks — your subscription is active! Your new plan applies within a few seconds.",
        planRenews: "Renews on",
        planEnds: "Plan ends on",
        cancelScheduled: "Cancellation is scheduled — your plan stays active until this date.",
        pastDue:
            "There's a payment problem — please update your payment method in the billing portal.",
        plansHeading: "Plans & pricing",
        plansSubheading:
            "Every plan includes every feature — plans differ only in usage limits and history.",
        freePrice: "Free",
        perMonth: "/ month",
        contactSales: "Contact sales",
        contactUs: "Contact us",
        currentPlan: "Current plan",
        yourPlanHeading: "Your plan",
        planSetByAdmin: "Set by your administrator",
        planSetByAdminHint:
            "This plan wasn't purchased through Stripe, so there's nothing to manage here. Contact your workspace admin or support to change it.",
        perDay: "{n} / day",
        perMonthCount: "{n} / month",
        premiumNote: "Daily caps for premium AI models also apply per plan.",
        comparePlans: "Compare plans",
        seePlans: "See plans",
        legalNotice: "Legal Notice",
        teamPlansHeading: "Team plan",
        teamPlansSubheading:
            "One payer, every member benefits — billed per seat. Only the team owner sees this section.",
        teamSeats: "{n} seats",
        teamUpgradeToCore: "Team Core",
        teamUpgradeToPro: "Team Pro",
        teamUpgradeToMax: "Team Max",
        manageTeamBilling: "Manage team billing",
        perSeatMonth: "{price} × {n} seats / month",
        plansHero: "Do more of your best work with Genos",
        plansHeroSub:
            "Start free and upgrade anytime. Every plan includes every feature — paid plans unlock more AI, unlimited history, and more room to create.",
        // Accessible name for the currency switcher. The switcher only
        // renders when more than one currency has prices configured.
        currencyLabel: "Display prices in",
        startForFree: "Start for free",
        taglineFree: "Get your chat, tasks, and notes in one place",
        taglineCore: "Unlimited history and daily AI",
        taglinePro: "Make AI part of your everyday work",
        taglineMax: "Full power for AI-heavy days",
        taglineEnterprise: "For teams that need it all",
        bestValue: "Best value",
        freeForever: "Free forever",
        benefitHistoryUnlimited: "Unlimited message history",
        benefitHistoryDays: "{days}-day message history",
        // --- AI allowance, two eras -------------------------------
        // Credits replaced daily ask/search counts as the customer's
        // limit. The plans page renders whichever the SERVER actually
        // enforces (it sends `monthly_ai_credits` only when credits
        // rule), so both sets stay until the daily era is retired.
        benefitAiAsks: "{n} AI asks every day",
        benefitAiAsksUnlimited: "Unlimited AI asks",
        benefitPremiumModels: "Premium AI models included",
        benefitWebSearches: "{n} AI web searches per day",
        benefitWebSearchesUnlimited: "Unlimited AI web searches",
        // Credits era. Web search is no longer a separate allowance —
        // it is priced into the request — so it gets no row of its own;
        // saying "included" is the honest summary.
        benefitAiCredits: "{n} AI credits every month",
        benefitAiCreditsUnlimited: "Unlimited AI credits",
        benefitCreditsExplainer: "Simple questions use fewer credits; deeper work uses more",
        benefitWebSearchIncluded: "Web search included",
        benefitTasks: "{n} tasks per month",
        benefitTasksUnlimited: "Unlimited tasks",
        benefitNotes: "{n} notes per month",
        benefitNotesUnlimited: "Unlimited notes",
        benefitUpload: "Files up to {mb} MB",
        billingReturnCancelled: "Checkout cancelled — your plan is unchanged.",
    },
    appearance: {
        heading: "Appearance",
        description:
            'Choose how the app looks. "System" follows your OS theme and updates automatically when it changes.',
        themeLabel: "Theme",
        themeHelper: "Applies immediately and persists across sessions.",
        themeLight: "Light",
        themeDark: "Dark",
        themeSystem: "System",
        colorThemeLabel: "Color theme",
        colorThemeHelper: "Changes the accent color across the whole app.",
        colorThemes: {
            purple: "Purple",
            blue: "Blue",
            teal: "Teal",
            emerald: "Emerald",
            amber: "Amber",
            rose: "Rose",
            slate: "Slate",
        },
    },
    messageLayout: {
        heading: "Message layout",
        description:
            "Bubble: flexible-width balloons aligned by author (current). Compact: full-width squared rows with author on the left (Slack-style).",
        styleLabel: "Style",
        styleHelper: "Applies immediately to chat, threads, and task comments.",
        styleBubble: "Bubble",
        styleCompact: "Compact",
    },
    quickReactions: {
        heading: "Quick reactions",
        description:
            "The three one-click emoji offered when you hover a chat message, thread reply, or task comment.",
        label: "Emoji",
        helper: "Click a slot to change it. Team custom emoji can be used too.",
        slotTooltip: "Change this emoji",
        reset: "Reset",
    },
    doubleClickTodo: {
        heading: "Double-click action",
        description: "Choose what happens when you double-click a message bubble.",
        toggleLabel: "Add message to To-Do on double-click",
        toggleHelper:
            "Turn this off to use double-click for selecting text instead. Applies to chat messages, thread messages, and task comments.",
    },
    spotlight: {
        heading: "Spotlight",
        description:
            "Spotlight always searches your chats, tasks, and notes. The toggles below gate the optional LLM-powered answers, which count against your daily ask quota.",
        aiAnswersLabel: "AI answers",
        aiAnswersHelper:
            'Lets the "Ask" button send your query to the agent. When off, Spotlight returns search results only.',
        webSearchLabel: "Web search",
        webSearchHelper:
            "Allow the agent to browse the web when answering. Requires AI answers to be on.",
    },
    llmModel: {
        heading: "AI model",
        description:
            "Choose which LLM the Spotlight agent uses. Each model has a separate daily quota that resets at UTC midnight.",
        providerLabel: "Provider",
        providerHelper: "Pick the AI service that should answer your asks.",
        modelLabel: "Model",
        modelHelper: "Models on the selected provider.",
        providerGemini: "Google Gemini",
        providerClaude: "Anthropic Claude",
        providerOpenai: "OpenAI GPT",
        usageHeading: "Today's usage",
        usageUnlimited: "Unlimited",
        // Aggregate counters shown above per-model rows.
        llmAskLabel: "LLM asks",
        webSearchLabel: "Web searches",
        // Tier badge labels — Free / Pro / Max.
        tierFree: "Free",
        tierCore: "Core",
        tierPro: "Pro",
        tierMax: "Max",
        tierEnterprise: "Enterprise",
        upgradeNote: "Upgrade for higher daily limits on every model.",
        // --- Monthly AI credits (rendered when the backend serves a
        // `credits` block, i.e. credits are the authoritative limit).
        // These REPLACE the daily rows above rather than joining them:
        // showing both would present two limits when only one applies.
        // Always "AI credits", never a bare "credits" — on its own the
        // word raises the question it should answer (credits for what?).
        creditsHeading: "AI credits",
        creditsDescription:
            "Your monthly AI credits. Simple questions use fewer credits; deeper work uses more.",
        creditsRemaining: "{balance} of {limit} AI credits left",
        creditsUnlimited: "Unlimited AI credits on your plan.",
        creditsResets: "Resets {when}",
        creditsResetsToday: "Resets today",
        creditsResetsTomorrow: "Resets tomorrow",
        creditsResetsInDays: "Resets in {days} days",
        // Two distinct states, because the server now treats them
        // differently. Below one request's maximum you can still ask —
        // the run just stops partway if it turns out to be expensive.
        // At zero you cannot ask at all.
        creditsLowWarning:
            "Running low — a long request may stop partway. Your AI credits reset {when}.",
        creditsEmptyWarning:
            "You're out of AI credits. They reset {when}, or upgrade your plan to keep going.",
        creditsUpgradeNote: "Upgrade for more AI credits each month.",
        noModelsConfigured: "No models are configured for your account.",
        // Effort levels (rendered when the backend serves `efforts`).
        // The user picks Low/Medium/High instead of a model; the notes
        // are the "diff of effort" they read to choose.
        effortLabel: "Effort",
        effortHelper: "How hard the AI works on each answer.",
        effortLow: "Low",
        effortMedium: "Medium",
        effortHigh: "High",
        effortLowNote: "Fastest — quick answers for simple questions.",
        effortMediumNote: "Balanced speed and quality — right for most questions.",
        effortHighNote: "Takes longer — deepest reasoning for complex questions.",
    },
    privacy: {
        heading: "Privacy & analytics",
        description:
            "Helps us understand which features get used so we can focus on the right things.",
        shareLabel: "Share anonymous usage data",
        shareHelper:
            "Sends your user ID, team, and role plus the pages you visit. No message content, no clicks tracked. Turn off to opt out completely.",
    },
    shortcuts: {
        heading: "Keyboard shortcuts",
        global: {
            title: "Global",
            description:
                "Available anywhere. The letter shortcuts now compose navigation with a creation action; the cycle gesture works like the macOS Cmd+Tab switcher.",
            rows: {
                spotlight: "Open Spotlight search",
                tasksNew: "Open Tasks and start a new task",
                notesNew: "Open Notes and create a new My Note",
                calendar: "Open compact calendar",
                meetClipboard: "Copy a fresh Meet link to clipboard",
                openHistory: "Open history",
                openTaskDiagram: "Open task graph for the previewed task",
                cycle: "Cycle through services",
            },
            cycleCombo: {
                hold: "Hold ⌘",
                tap: "Tap Ctrl to cycle",
                release: "Release ⌘ to switch",
            },
        },
        chat: {
            title: "Chat",
            description:
                "Active while a chat surface is mounted. Editable text fields keep platform text-selection shortcuts.",
            rows: {
                switchTab: "Switch chat tab",
                moveSelection: "Move selection in chat list",
                openThread: "Open thread of a message",
            },
            clickMessage: "Click message",
        },
    },
    language: {
        heading: "Language",
        description: "Choose the language used throughout the app.",
        label: "Language",
        helper: "Some translations may be incomplete; missing values fall back to English.",
        english: "English",
        japanese: "日本語",
        spanish: "Español",
        french: "Français",
        chinese: "中文",
        arabic: "العربية",
        hindi: "हिन्दी",
    },
    autoCloseOnPrMerge: {
        heading: "Auto-close on PR merge",
        description:
            "When a GitHub PR is merged, automatically close the task whose ID is in the PR's head branch name (e.g. branch `feature/GEN-42-foo` closes task GEN-42). Only fires for tasks you are assigned to.",
        toggleLabel: "Close my tasks when their PR merges",
        toggleHelper:
            "Disabled by default. Branch must follow the convention `…<TASK-ID>…` for the match to fire.",
    },
    autoSyncCalendar: {
        heading: "Auto-sync to Google Calendar",
        description:
            "Automatically add tasks with due dates to your Google Calendar as all-day events. One-way: deleting an event on Google won't affect your tasks.",
        toggleLabel: "Auto-sync task due dates",
        toggleHelper:
            "Off by default. Only tasks assigned to you sync. Past-due tasks are skipped on backfill.",
        connectPrompt: "Connect Google Calendar in Integrations to enable this.",
        grantPrompt: "Calendar access hasn't been granted yet — grant it to enable auto-sync.",
        grantButton: "Grant Calendar access",
        reconnectPrompt:
            "Your Google Calendar connection expired — reconnect to keep auto-sync working.",
        reconnectButton: "Reconnect Google Calendar",
        backfillButton: "Sync existing tasks now",
        backfillRunning: "Syncing…",
        backfillSuccess: "Synced {total} task(s) ({created} new, {patched} updated).",
        backfillSuccessWithCleared:
            "Synced {total} task(s) ({created} new, {patched} updated). Cleared {cleared} stale link(s) — events deleted on Google were NOT re-created.",
        backfillOnlyCleared:
            "Cleared {cleared} stale link(s) — events were deleted on Google. Per the never-re-create rule, no new events were posted.",
        backfillUpToDate: "Already up to date — no tasks needed syncing.",
        backfillFailed: "Backfill failed. Try again.",
    },
    taskSort: {
        heading: "Task sort",
        description:
            "Pick up to two sort keys for each surface. The primary key sorts first; the secondary key breaks ties. Applies immediately and persists across sessions.",
        sprintBoardLabel: "Board",
        sprintBoardHelper:
            "Cards within each column are sorted by these keys. Default leaves the order as the filter pipeline produced it.",
        tableLabel: "Task table",
        tableHelper:
            "Column-header clicks override the primary key (and toggle direction). The secondary key is preserved.",
        primaryLabel: "Primary",
        secondaryLabel: "Secondary",
        fieldNone: "None",
        directionAsc: "Ascending",
        directionDesc: "Descending",
    },
} as const;
