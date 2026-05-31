import { forwardRef, useCallback, useImperativeHandle, useState } from "react";
import { Button, Snackbar } from "@mui/joy";

import { createEvent, deleteEvent, getEvent } from "../../features/integrations/services/calendar";
import { redirectToOAuthConnect } from "../../features/integrations/services/oauth";
import { fmt, useTranslation } from "../../i18n";

export type QuickMeetClipboardHandle = {
    trigger: () => void;
};

type Props = {
    accessToken: string | null;
};

type SnackbarState = {
    kind: "info" | "success" | "error";
    text: string;
    needsGrant?: boolean;
    // Same OAuth connect flow as `needsGrant`, surfaced when the stored
    // refresh token is revoked/expired (`google_reauth_required`); only
    // the button label differs ("Reconnect" vs "Grant access").
    needsReconnect?: boolean;
} | null;

/**
 * Global "generate Meet link → clipboard" handler.
 *
 * Triggered by the Ctrl+⌘+M / Ctrl+Alt+M shortcut wired up in App.tsx.
 * Lives INSIDE I18nProvider so its snackbar text can be translated; the
 * imperative `trigger()` is exposed via ref so the shortcut-listening
 * code (which lives outside the provider tree) can fire it.
 *
 * Flow:
 *   1. Create a 1-hour event with `add_meet: true`. Google requires an
 *      event to mint a Meet space — there's no standalone Meet API on
 *      the current OAuth scope.
 *   2. Poll up to 5 s for `hangoutLink` to appear on the event.
 *   3. Copy the link to the clipboard.
 *   4. Fire-and-forget delete the event so the user's calendar stays
 *      clean. The Meet link survives event deletion — Google keeps the
 *      meeting space valid for hours after the linking event is gone.
 */
export const QuickMeetClipboardHost = forwardRef<QuickMeetClipboardHandle, Props>(
    ({ accessToken }, ref) => {
        const { t } = useTranslation();
        const [loading, setLoading] = useState(false);
        const [snackbar, setSnackbar] = useState<SnackbarState>(null);

        const handleGrant = useCallback(() => {
            if (!accessToken) return;
            setSnackbar(null);
            void redirectToOAuthConnect("google", accessToken, undefined, () => undefined);
        }, [accessToken]);

        const trigger = useCallback(async () => {
            if (!accessToken || loading) return;
            setLoading(true);
            setSnackbar({ kind: "info", text: t.app.meetClipboard.generating });

            const now = new Date();
            const inOneHour = new Date(now.getTime() + 60 * 60 * 1000);
            const event = await createEvent(
                accessToken,
                {
                    add_meet: true,
                    end: { dateTime: inOneHour.toISOString() },
                    start: { dateTime: now.toISOString() },
                    summary: t.app.meetClipboard.eventTitle,
                },
                (err) => {
                    setSnackbar({
                        kind: "error",
                        text: err || t.app.meetClipboard.failed,
                    });
                }
            );

            if (event === "google_not_connected") {
                setLoading(false);
                setSnackbar({
                    kind: "error",
                    text: t.app.meetClipboard.notConnected,
                });
                return;
            }
            if (event === "calendar_scope_missing") {
                setLoading(false);
                setSnackbar({
                    kind: "error",
                    text: t.app.meetClipboard.scopeMissing,
                    needsGrant: true,
                });
                return;
            }
            if (event === "google_reauth_required") {
                setLoading(false);
                setSnackbar({
                    kind: "error",
                    text: t.app.meetClipboard.reauth,
                    needsReconnect: true,
                });
                return;
            }
            if (!event) {
                setLoading(false);
                return;
            }

            // Meet links are minted asynchronously; the create response
            // sometimes ships with `hangoutLink` empty and
            // conferenceData.createRequest.status="pending". Same poll
            // shape as the chat-header Quick Meet flow.
            let link = event.hangoutLink;
            for (let i = 0; !link && i < 5; i++) {
                await new Promise((r) => setTimeout(r, 1000));
                const refreshed = await getEvent(accessToken, event.id);
                if (refreshed && typeof refreshed === "object" && "hangoutLink" in refreshed) {
                    link = refreshed.hangoutLink;
                }
            }

            setLoading(false);

            if (!link) {
                // Clean up the throwaway event even on failure so we
                // don't leave it dangling on the user's calendar.
                void deleteEvent(accessToken, event.id);
                setSnackbar({ kind: "error", text: t.app.meetClipboard.failed });
                return;
            }

            // Clipboard write fails under non-secure origin / iframe
            // sandboxes. Degrade by showing the link in the snackbar
            // so the user can still grab it.
            let clipboardOk = true;
            try {
                await navigator.clipboard.writeText(link);
            } catch {
                clipboardOk = false;
            }

            void deleteEvent(accessToken, event.id);

            setSnackbar({
                kind: "success",
                text: clipboardOk
                    ? t.app.meetClipboard.success
                    : fmt(t.app.meetClipboard.successNoClipboard, { link }),
            });
        }, [accessToken, loading, t]);

        useImperativeHandle(ref, () => ({ trigger }), [trigger]);

        return (
            <Snackbar
                anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
                autoHideDuration={snackbar?.kind === "info" ? null : 5000}
                open={snackbar !== null}
                variant="soft"
                color={
                    snackbar?.kind === "error"
                        ? "danger"
                        : snackbar?.kind === "success"
                          ? "success"
                          : "neutral"
                }
                endDecorator={
                    snackbar?.needsGrant || snackbar?.needsReconnect ? (
                        <Button size="sm" variant="solid" onClick={handleGrant}>
                            {snackbar?.needsReconnect
                                ? t.app.meetClipboard.reconnectButton
                                : t.app.meetClipboard.grantButton}
                        </Button>
                    ) : null
                }
                onClose={(_e, reason) => {
                    if (reason === "clickaway") return;
                    setSnackbar(null);
                }}
            >
                {snackbar?.text}
            </Snackbar>
        );
    }
);

QuickMeetClipboardHost.displayName = "QuickMeetClipboardHost";
