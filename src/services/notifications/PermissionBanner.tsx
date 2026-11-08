import { useLayoutEffect, useState } from "react";
import CloseRounded from "@mui/icons-material/CloseRounded";
import NotificationsActiveRounded from "@mui/icons-material/NotificationsActiveRounded";
import { Box, Button, IconButton, Typography } from "@mui/joy";

import { WebNotificationPermission } from "../../hooks/common/useNotifications";
import { useTranslation } from "../../i18n";
import { focusRing, g, type } from "../../theme/tokens";

interface PermissionBannerProps {
    permission: WebNotificationPermission;
    masterEnabled: boolean;
    requestPermission: () => Promise<WebNotificationPermission>;
}

const SESSION_DISMISSED_KEY = "notif:permissionBannerDismissed";

const isDismissedThisSession = (): boolean => {
    if (typeof sessionStorage === "undefined") return false;
    return sessionStorage.getItem(SESSION_DISMISSED_KEY) === "1";
};

const markDismissed = () => {
    if (typeof sessionStorage === "undefined") return;
    sessionStorage.setItem(SESSION_DISMISSED_KEY, "1");
};

/** Height of the bar in px. Fixed, so the shell can reserve exactly this much
 *  (`--app-banner-h`, read by `--app-vh` in index.css) without measuring. */
export const PERMISSION_BANNER_HEIGHT = 44;
const BANNER_HEIGHT_VAR = "--app-banner-h";

/**
 * Banner asking the user to grant notification permission. It is a row IN the
 * layout, above the rail and the page, not a card floating over them: it used
 * to be `position: fixed` at the top centre, which sat on the page's own
 * toolbar (the chat header, the Tasks search, the Inbox title) until it was
 * dismissed (MIP-1134). While it shows it publishes its height as
 * `--app-banner-h`, which the shell's `--app-vh` subtracts, so the page below
 * is exactly as much shorter as the bar is tall and the document does not
 * scroll.
 *
 * One line everywhere; on a phone the explanation is dropped and only the
 * title, Enable and the close button remain.
 *
 * Only renders when:
 *   - Notifications API is supported
 *   - permission is still "default" (i.e. the user has not allowed or denied)
 *   - the user has not flipped off the master toggle
 *   - the banner has not been dismissed this session
 */
export const PermissionBanner = ({
    permission,
    masterEnabled,
    requestPermission,
}: PermissionBannerProps) => {
    const [dismissed, setDismissed] = useState<boolean>(isDismissedThisSession());
    const { t } = useTranslation();

    const visible = !dismissed && permission === "default" && masterEnabled;

    // Reserve the bar's height while it is on screen, give it back when it is not
    // (dismissed, permission decided, or the component goes away).
    useLayoutEffect(() => {
        if (!visible) return undefined;
        const root = document.documentElement;
        root.style.setProperty(BANNER_HEIGHT_VAR, `${PERMISSION_BANNER_HEIGHT}px`);
        return () => {
            root.style.removeProperty(BANNER_HEIGHT_VAR);
        };
    }, [visible]);

    if (!visible) return null;

    const handleEnable = async () => {
        await requestPermission();
        // No matter the result, hide the banner: re-prompting from the
        // settings panel is the path forward if the user denied.
        markDismissed();
        setDismissed(true);
    };

    const handleDismiss = () => {
        markDismissed();
        setDismissed(true);
    };

    return (
        <Box
            aria-label={t.services.notifications.banner.title}
            data-testid="permission-banner"
            role="region"
            sx={{
                boxSizing: "border-box",
                height: PERMISSION_BANNER_HEIGHT,
                display: "flex",
                alignItems: "center",
                gap: 1.5,
                px: { xs: 1.5, md: 2 },
                background: g.accent.subtle,
                borderBottom: `1px solid ${g.accent.border}`,
                color: g.text.primary,
            }}
        >
            <NotificationsActiveRounded
                sx={{ fontSize: 18, color: g.accent.text, flexShrink: 0 }}
            />
            <Typography
                sx={{ ...type("body-sm"), minWidth: 0, flex: 1, color: g.text.secondary }}
                noWrap
            >
                <Box component="span" sx={{ ...type("title-sm"), color: g.text.primary }}>
                    {t.services.notifications.banner.title}
                </Box>
                <Box component="span" sx={{ display: { xs: "none", md: "inline" } }}>
                    {" · "}
                    {t.services.notifications.banner.body}
                </Box>
            </Typography>
            <Button size="sm" sx={{ flexShrink: 0 }} onClick={handleEnable}>
                {t.services.notifications.banner.enable}
            </Button>
            <IconButton
                aria-label={t.common.actions.close}
                color="neutral"
                size="sm"
                sx={{ flexShrink: 0, "&:focus-visible": focusRing }}
                variant="plain"
                onClick={handleDismiss}
            >
                <CloseRounded />
            </IconButton>
        </Box>
    );
};
