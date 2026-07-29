import { useState } from "react";
import CloseRounded from "@mui/icons-material/CloseRounded";
import InstallMobileRounded from "@mui/icons-material/InstallMobileRounded";
import { Box, Button, IconButton, Sheet, Stack, Typography } from "@mui/joy";

import {
    isIOSDevice,
    isStandaloneDisplay,
    useInstallPrompt,
} from "../../hooks/common/useInstallPrompt";
import { useIsMobile } from "../../hooks/common/useIsMobile";
import { useTranslation } from "../../i18n";

// localStorage, not sessionStorage (contrast PermissionBanner): "no" to
// installing should stick across visits — re-asking every session is how
// install banners get hated.
const DISMISSED_KEY = "pwa:installBannerDismissed";

const isDismissed = (): boolean => {
    if (typeof localStorage === "undefined") return false;
    return localStorage.getItem(DISMISSED_KEY) === "1";
};

const markDismissed = () => {
    if (typeof localStorage === "undefined") return;
    localStorage.setItem(DISMISSED_KEY, "1");
};

/**
 * Bottom banner (above the mobile tab bar) offering to install the app.
 *
 * Only renders when:
 *   - the viewport is mobile (desktop keeps the browser's omnibox affordance)
 *   - not already running as an installed app
 *   - not permanently dismissed
 *   - there is a way forward: a captured `beforeinstallprompt` (Chromium
 *     shows an Install button) or iOS (no prompt API — shows Share →
 *     Add to Home Screen instructions, which is also what enables push there)
 */
export const InstallBanner = () => {
    const isMobile = useIsMobile();
    const { canPrompt, promptInstall } = useInstallPrompt();
    const [dismissed, setDismissed] = useState<boolean>(isDismissed());
    const [installing, setInstalling] = useState(false);
    const { t } = useTranslation();

    const onIOS = isIOSDevice();

    if (!isMobile) return null;
    if (dismissed) return null;
    if (isStandaloneDisplay()) return null;
    if (!canPrompt && !onIOS) return null;

    const handleDismiss = () => {
        markDismissed();
        setDismissed(true);
    };

    const handleInstall = async () => {
        setInstalling(true);
        const accepted = await promptInstall();
        setInstalling(false);
        // Accepted installs also hide via the standalone check on next
        // launch; declining the native dialog counts as a dismissal.
        markDismissed();
        setDismissed(true);
        void accepted;
    };

    return (
        <Sheet
            color="primary"
            variant="soft"
            sx={{
                position: "fixed",
                left: 8,
                right: 8,
                bottom: "calc(var(--BottomTabBar-height, 60px) + env(safe-area-inset-bottom, 0px) + 8px)",
                zIndex: 1199,
                px: 2,
                py: 1,
                borderRadius: "lg",
                boxShadow: "md",
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
                    <InstallMobileRounded />
                </Box>
                <Box sx={{ minWidth: 0, flex: 1 }}>
                    <Typography level="title-sm">{t.services.pwaInstall.title}</Typography>
                    <Typography level="body-xs">
                        {onIOS && !canPrompt
                            ? t.services.pwaInstall.iosBody
                            : t.services.pwaInstall.body}
                    </Typography>
                </Box>
                {canPrompt && (
                    <Button loading={installing} size="sm" onClick={handleInstall}>
                        {t.services.pwaInstall.install}
                    </Button>
                )}
                <IconButton color="neutral" size="sm" variant="plain" onClick={handleDismiss}>
                    <CloseRounded />
                </IconButton>
            </Stack>
        </Sheet>
    );
};
