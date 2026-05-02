import { useState } from "react";
import CloseRounded from "@mui/icons-material/CloseRounded";
import NotificationsActiveRounded from "@mui/icons-material/NotificationsActiveRounded";
import { Box, Button, IconButton, Sheet, Stack, Typography } from "@mui/joy";

import { WebNotificationPermission } from "../../hooks/common/useNotifications";

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
            variant="soft"
            color="primary"
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
            }}
        >
            <Stack direction="row" spacing={1.5} alignItems="center">
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
                    <Typography level="title-sm">Enable desktop notifications</Typography>
                    <Typography level="body-xs">
                        Get notified about new messages, mentions, and inbox updates while the tab
                        is in the background.
                    </Typography>
                </Box>
                <Button size="sm" onClick={handleEnable}>
                    Enable
                </Button>
                <IconButton size="sm" variant="plain" color="neutral" onClick={handleDismiss}>
                    <CloseRounded />
                </IconButton>
            </Stack>
        </Sheet>
    );
};
