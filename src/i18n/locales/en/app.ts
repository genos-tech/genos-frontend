export const app = {
    tooSmall: {
        title: "Window Size Too Small",
        body: "This application is designed for desktop use. Please resize your browser window or switch to a larger screen.",
    },
    snackbar: {
        wsLost: "Real-time connection lost. Attempting to reconnect...",
        apiDown: "API server is unreachable.",
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
