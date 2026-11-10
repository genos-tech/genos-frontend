export const integrations = {
    title: "Integrations",
    providers: {
        google: "Google",
        googleCalendar: "Google Calendar",
        github: "GitHub",
    },
    actions: {
        refresh: "Refresh",
    },
    errors: {
        notSignedIn: "Not signed in.",
        missingConsentUrl: "Backend returned no consent URL.",
        connectFlowFailed: "Could not start the connect flow. Please try again.",
        disconnectFailed: "Disconnect failed.",
        connectionsLoadFailed: "Failed to load connected accounts.",
        googleNotConnected: "Google account is not connected.",
        calendarScopeMissing: "Calendar access not granted yet.",
        calendarReconnectRequired: "Google Calendar connection expired. Please reconnect.",
        calendarRequestFailed: "Calendar request failed.",
        githubNotConnected: "GitHub account is not connected.",
        githubRequestFailed: "GitHub request failed.",
    },
    tabs: {
        connections: "Connections",
        calendar: "Calendar",
        github: "GitHub",
    },
    connections: {
        loadFailed: "Couldn't load your connections",
        disconnectDialog: {
            title: "Disconnect {provider}?",
            bodyGoogle:
                "Genos deletes its saved access to this Google account. Calendar features that use it stop working until you connect again, which means signing in with Google once more.",
            bodyGithub:
                "Genos deletes its saved access to this GitHub account. Features that use it, such as pull request links, stop working until you connect again, which means signing in with GitHub once more.",
        },
        primaryLogin: "Primary login",
        noEmailShared: "(no email shared)",
        notConnected: "Not connected",
        grantCalendarAccess: "Grant Calendar access",
        primaryDisconnectHint: "You can't disconnect the account you signed up with.",
        disconnecting: "Disconnecting…",
        disconnect: "Disconnect",
        connect: "Connect",
        verificationTitle: "First time connecting Google?",
        verificationBeforeError:
            "Our Google integration is still going through Google's verification process. If you see",
        verificationAfterError: "when granting access, please email",
        verificationEnding:
            "with your Gmail address — we'll add you as a test user. Access works within a minute of confirmation.",
        verificationError: "Error 403: access_denied",
        addGoogleAccount: "Add another Google account",
    },
    calendar: {
        connectPrompt: "Connect Google to read and manage your calendar events here.",
        connectButton: "Connect Google",
        grantPrompt:
            "Calendar access hasn't been granted yet. Grant it to read and manage events here. The chat header's Quick Meet, the task auto-sync, and the Calendar tab all need this permission.",
        grantButton: "Grant Calendar access",
        reconnectPrompt:
            "Your Google Calendar connection has expired — the stored authorization was revoked or timed out. Reconnect to restore Quick Meet, task auto-sync, and the Calendar tab.",
        upcoming: "Upcoming events",
        newEvent: "New event",
        empty: 'No events in the next 30 days. Click "New event" to create one.',
        untitled: "(no title)",
        deleteConfirm: 'Delete event "{title}"?',
        joinMeet: "Join Google Meet",
        openInCalendar: "Open in Google Calendar",
    },
    github: {
        connectPrompt: "Connect GitHub to see your pull requests here.",
        connectButton: "Connect GitHub",
        openPulls: "Your open pull requests",
        noOpenPulls: "No open pull requests authored by you.",
        updated: "{repo} #{number} · updated {date}",
        draft: "Draft",
        openOnGithub: "Open on GitHub",
        webhook: {
            title: "Auto-close tasks when their PR is merged",
            noSetupTitle: "No setup needed",
            noSetupBody:
                "Paste any GitHub PR URL into a task's Links and Genos registers our webhook on that repo for you, using your connected GitHub account. When the PR merges, the task auto-transitions to Closed.",
            showManual: "Show manual setup",
            showManualHint: " (only needed if you lack repo admin)",
            hideManual: "Hide manual setup",
            manualIntro:
                "If auto-registration didn't happen (typically because your GitHub user lacks admin on that repo), a repo admin can paste the URL below into the repo's webhook settings manually.",
            urlLabel: "Webhook URL",
            copied: "Copied",
            copyUrl: "Copy webhook URL",
            stepsTitle: "Manual steps (one-time per repo)",
            stepSettings: "On the GitHub repo:",
            settingsPath: "Settings → Webhooks → Add webhook",
            stepPayload: "Payload URL: paste the URL above. Content type:",
            contentTypeLabel: "application/json",
            stepSecret:
                "Secret: enter any value (GitHub requires one). The hook does nothing until the repo is registered (next steps); Genos then gives it a secret of its own.",
            stepEventsPrefix: "Events: select",
            eventSelectionLabel: '"Let me select individual events"',
            stepEventsList:
                "→ check Pull requests, Issue comments and Pull request review comments (all three).",
            saveSuffix: "Save.",
            stepRegister:
                "Then register the repo with the button above (or link any PR from it to a task). Until you do, the hook is not tied to a team, so it links nothing.",
        },
        register: {
            title: "Register a repository",
            intro: "Install the webhook on a repo, or take over one a repo admin added by hand. You need admin access to the repo on GitHub.",
            placeholder: "owner/repo or a GitHub URL",
            button: "Register",
            invalid: "Enter a repo as owner/repo, or paste its GitHub URL.",
            success: {
                created:
                    "Registered {repo}. PRs and branches linked to tasks will sync from now on.",
                adopted:
                    "Took over the existing webhook on {repo} and fixed its events. PRs and branches will sync from now on.",
                already_registered: "{repo} is already registered.",
            },
            reasons: {
                no_admin:
                    "Your GitHub account isn't an admin of that repo, so it can't add the webhook. Ask a repo admin to register it here.",
                repo_not_found:
                    "GitHub can't see that repo with your account. Check the name, and that its organization has granted Genos access (see Repository access).",
                not_connected: "Connect GitHub first.",
                token_unavailable: "Your GitHub connection expired. Re-authorize GitHub below.",
                adopt_failed:
                    "That repo already has a webhook GitHub wouldn't let us replace, and none of its hooks points at Genos. Remove the old webhook on GitHub, then register again.",
                encryption_unavailable: "Genos can't store the webhook's secret right now.",
                github_unreachable: "Couldn't reach GitHub. Try again in a moment.",
                github_error: "GitHub refused the request. Try again in a moment.",
                invalid_repo: "That doesn't look like a GitHub repo.",
                request_failed: "Something went wrong. Try again.",
            },
            unknownTitle: "Repos sending events Genos can't use yet",
            unknownIntro:
                "These repos have a webhook pointing at Genos, but none registered to a team, so their PRs link to nothing. Register them to start syncing.",
            events: "{count, plural, one {# event} other {# events}}",
            lastEvent: "last: {event}",
            needsAdmin: "Needs admin on the repo",
        },
        repoAccess: {
            loadFailed: "Couldn't load your repositories",
            title: "Repository access",
            description:
                "Genos reaches GitHub with your account's permissions, so a repo you create in your own account works straight away. An organization has to grant access once — if one is missing below, add it from the buttons at the bottom.",
            empty: "No repositories are visible yet. If you expect some, re-authorize below.",
            org: "Org",
            repoCount: "{count, plural, one {# repo} other {# repos}}",
            truncated: "Showing the 100 most recently updated repositories.",
            missingOrg:
                "Missing an organization? Grant it on GitHub — for orgs that restrict third-party apps an owner has to approve the request — then re-authorize here so the new access takes effect.",
            manage: "Manage access on GitHub",
            reauthorize: "Re-authorize GitHub",
        },
    },
    locked: {
        title: "{name} isn't included in your plan",
        description: "Upgrade to connect {name} and let Genos use it when answering.",
        comparePlans: "Compare plans",
    },
    pullRequest: {
        state: {
            merged: "Merged",
            draft: "Draft",
            closed: "Closed",
            open: "Open",
        },
        ci: {
            passing: "CI passing",
            failing: "CI failing",
            pending: "CI pending",
            none: "No CI",
        },
        hover: {
            openedBy: "Opened by {author} · {when}",
            commits: "{count, plural, one {# commit} other {# commits}}",
            files: "{count, plural, one {# file} other {# files}}",
            comments: "{count, plural, one {# comment} other {# comments}}",
            updated: "Updated {when}",
            ago: "{count} {unit} ago",
            units: {
                second: "second",
                seconds: "seconds",
                minute: "minute",
                minutes: "minutes",
                hour: "hour",
                hours: "hours",
                day: "day",
                days: "days",
                week: "week",
                weeks: "weeks",
                month: "month",
                months: "months",
                year: "year",
                years: "years",
            },
        },
        linkedCard: {
            connectPrompt: "Connect GitHub to see PR status",
            connectButton: "Connect GitHub",
            privateOrDeleted:
                "This PR is private to a repo you don't have access to, or it was deleted.",
            loadFailed: "Couldn't load this PR.",
            state: {
                merged: "Merged",
                draft: "Draft",
                closed: "Closed",
                open: "Open",
            },
            ci: {
                passing: "All checks passing",
                failing: "Some checks failing",
                pending: "Checks in progress",
                none: "No CI checks",
            },
        },
    },
} as const;
