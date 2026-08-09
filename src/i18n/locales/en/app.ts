export const app = {
    features: {
        integrations: "Integrations",
        plans: "Plans",
        genos: "Genos",
        chat: "Chat",
        tasks: "Tasks",
        notes: "Notes",
    },
    diagram: {
        milestoneFallback: "Milestone",
        label: "{title} · diagram",
    },
    dates: {
        today: "Today",
        yesterday: "Yesterday",
    },
    collaboration: {
        unknownUser: "Unknown user",
    },
    tooSmall: {
        title: "Window Size Too Small",
        body: "This application is designed for desktop use. Please resize your browser window or switch to a larger screen.",
    },
    snackbar: {
        wsLost: "Real-time connection lost. Attempting to reconnect...",
        // The same banner, said three ways. "Unreachable" alone reads
        // identically whether the device lost its network, the server
        // never answered, or the connection was refused — and those send
        // whoever is reading it somewhere different. Picked from
        // `ApiDownReason` in the api.ts interceptor; `apiDown` stays the
        // fallback for a failure that couldn't be placed.
        apiDown: "API server is unreachable.",
        apiDownOffline: "You're offline. Genos will reconnect when your network is back.",
        apiDownTimeout: "The API server isn't responding — requests are timing out.",
        apiDownUnreachable: "Can't reach the API server. Retrying...",
        // Transient per-request failures (RequestErrorSnackbar). Distinct
        // from the two banners above, which mean the server / socket is
        // unreachable; these fire for a single failed request while the app
        // is otherwise online. Classified by HTTP status in the api.ts
        // interceptor; `actionFailed` covers rejected v3 socket actions.
        serverError: "Server error. Please try again shortly.",
        permissionDenied: "You don't have permission to do that.",
        requestFailed: "That request couldn't be completed. Please try again.",
        limitReached: "You've reached a plan limit. See Settings → Plan & Usage for details.",
        actionFailed: "Couldn't complete that action. Please try again.",
        messageSendFailed: "Couldn't send your message. Please try again.",
    },
    // Global "generate Meet link → clipboard" feature, triggered by
    // Ctrl+⌘+M / Ctrl+Alt+M. Distinct from the chat-header Quick Meet:
    // this one never posts to chat and the underlying calendar event
    // is deleted right after the link is extracted, so the user
    // doesn't accumulate phantom events on their Google Calendar.
    meetClipboard: {
        // Title given to the brief throwaway event Google requires us
        // to create. The event lives <5s before being deleted; the
        // Meet link survives.
        eventTitle: "Meet link (auto-deleted event)",
        generating: "Generating Meet link…",
        success: "Meet link copied to clipboard.",
        successNoClipboard: "Meet link ready: {link}",
        failed: "Couldn't generate a Meet link. Try again.",
        notConnected: "Connect Google in Settings → Integrations to generate Meet links.",
        scopeMissing: "Calendar access hasn't been granted. Grant it to generate Meet links.",
        grantButton: "Grant",
        reauth: "Google Calendar connection expired. Reconnect to generate Meet links.",
        reconnectButton: "Reconnect",
    },
} as const;
