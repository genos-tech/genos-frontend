import { useState } from "react";
import CloseRounded from "@mui/icons-material/CloseRounded";
import NotificationsActiveRounded from "@mui/icons-material/NotificationsActiveRounded";
import { Box, Button, IconButton, Sheet, Stack, Typography } from "@mui/joy";

import { WebNotificationPermission } from "../../hooks/common/useNotifications";
import { useTranslation } from "../../i18n";

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

/**
 * Top-of-app banner asking the user to grant notification permission.
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

    if (dismissed) return null;
    if (permission !== "default") return null;
    if (!masterEnabled) return null;

    const handleEnable = async () => {
        await requestPermission();
        // No matter the result, hide the banner — re-prompting from the
        // settings panel is the path forward if the user denied.
        markDismissed();
        setDismissed(true);
    };

    const handleDismiss = () => {
        markDismissed();
        setDismissed(true);
    };

    return (
        <Sheet
            color="primary"
            variant="soft"
            sx={{
                position: "fixed",
                top: 8,
                left: "50%",
                transform: "translateX(-50%)",
                zIndex: 10000,
                px: 2,
                py: 1,
                borderRadius: "lg",
                boxShadow: "md",
                minWidth: 360,
                maxWidth: 560,
                // The banner floats over page content, so it must be opaque.
                // The `soft` primary `softBg` is a translucent rgba (0.18 alpha
                // in dark mode), which lets content behind show through. Layer
                // that tint over an opaque surface so the banner stays fully
                // opaque in both light and dark themes while keeping its look.
                backgroundColor: "background.surface",
                backgroundImage:
                    "linear-gradient(var(--joy-palette-primary-softBg), var(--joy-palette-primary-softBg))",
            }}
        >
            <Stack alignItems="center" direction="row" spacing={1.5}>
                <Box
                    sx={{
                        width: 36,
                        height: 36,
                        borderRadius: "50%",
                        display: "grid",
                        placeItems: "center",
                        bgcolor: "primary.softHoverBg",
                        color: "primary.solidColor",
                        flexShrink: 0,
                    }}
                >
                    <NotificationsActiveRounded />
                </Box>
                <Box sx={{ minWidth: 0, flex: 1 }}>
                    <Typography level="title-sm">
                        {t.services.notifications.banner.title}
                    </Typography>
                    <Typography level="body-xs">{t.services.notifications.banner.body}</Typography>
                </Box>
                <Button size="sm" onClick={handleEnable}>
                    {t.services.notifications.banner.enable}
                </Button>
                <IconButton color="neutral" size="sm" variant="plain" onClick={handleDismiss}>
                    <CloseRounded />
                </IconButton>
            </Stack>
        </Sheet>
    );
};
