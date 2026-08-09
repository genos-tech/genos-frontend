import { useState } from "react";
import LinkRoundedIcon from "@mui/icons-material/LinkRounded";
import { Button, type ButtonProps } from "@mui/joy";

import { useTranslation } from "../../../i18n";
import { redirectToOAuthConnect } from "../services/oauth";

interface ReconnectGoogleCalendarButtonProps {
    accessToken: string;
    /** Where Google's OAuth callback drops the user back. Defaults to
     *  the connect flow's own default (the Integrations page). */
    next?: string;
    /** Surfaces a failure to *start* the flow. On success the browser
     *  is already navigating to Google, so this only fires on an early
     *  error (e.g. the initiate call failed). */
    onError?: (message: string) => void;
    label?: string;
    size?: ButtonProps["size"];
    variant?: ButtonProps["variant"];
    color?: ButtonProps["color"];
}

/**
 * Repairs a broken Google **Calendar** connection by re-running the
 * connect-intent OAuth flow.
 *
 * Used when the backend reports `google_reauth_required` — the
 * ConnectedAccount row still exists (and may still carry the calendar
 * scope), but its refresh token has been revoked or has expired, so
 * "Reconnect" is the right verb, not "Connect". The most common cause
 * in a prototype is the Google OAuth app being in "Testing" publishing
 * status, where Google expires refresh tokens after ~7 days.
 *
 * The connect flow forces `prompt=consent` + `access_type=offline`
 * server-side, so Google always returns a fresh refresh token, which
 * the OAuth callback persists onto the existing account — restoring
 * Quick Meet, task auto-sync, and the Calendar tab in one click.
 */
export const ReconnectGoogleCalendarButton = ({
    accessToken,
    next,
    onError,
    label,
    size,
    variant,
    color,
}: ReconnectGoogleCalendarButtonProps) => {
    const { t } = useTranslation();
    const [redirecting, setRedirecting] = useState(false);

    return (
        <Button
            color={color}
            loading={redirecting}
            size={size}
            startDecorator={<LinkRoundedIcon />}
            sx={{ alignSelf: "flex-start" }}
            variant={variant}
            onClick={() => {
                setRedirecting(true);
                void redirectToOAuthConnect("google", accessToken, next, onError).then((ok) => {
                    // On success the browser is mid-navigation to
                    // Google's consent screen — leave the button
                    // disabled. Only re-enable if the initiate call
                    // failed, so the user can retry.
                    if (!ok) setRedirecting(false);
                });
            }}
        >
            {label ?? t.calendar.reconnectButton}
        </Button>
    );
};
