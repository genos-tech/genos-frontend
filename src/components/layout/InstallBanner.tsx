import { ReactNode, useState } from "react";
import AddBoxOutlined from "@mui/icons-material/AddBoxOutlined";
import CloseRounded from "@mui/icons-material/CloseRounded";
import InstallMobileRounded from "@mui/icons-material/InstallMobileRounded";
import IosShareRounded from "@mui/icons-material/IosShareRounded";
import {
    Box,
    Button,
    DialogContent,
    DialogTitle,
    IconButton,
    Modal,
    ModalDialog,
    Sheet,
    Stack,
    Typography,
} from "@mui/joy";

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

// One numbered row of the iOS how-to dialog.
const HowToStep = ({ step, icon, text }: { step: number; icon: ReactNode; text: string }) => (
    <Stack alignItems="center" direction="row" spacing={1.5}>
        <Box
            sx={{
                width: 40,
                height: 40,
                borderRadius: "12px",
                display: "grid",
                placeItems: "center",
                bgcolor: "primary.softBg",
                color: "primary.solidBg",
                flexShrink: 0,
            }}
        >
            {icon}
        </Box>
        <Typography level="body-sm" sx={{ flex: 1 }}>
            <Typography component="span" fontWeight="lg">
                {step}.{" "}
            </Typography>
            {text}
        </Typography>
    </Stack>
);

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
    const [howOpen, setHowOpen] = useState(false);
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

    const showIOSHowTo = onIOS && !canPrompt;

    return (
        <>
            <Sheet
                color="primary"
                variant="soft"
                sx={{
                    position: "fixed",
                    left: 8,
                    right: 8,
                    // Clear the MobileSpotlightFab, which occupies the
                    // bottom-right from tab-bar+16 to tab-bar+54 at
                    // zIndex 1250 — docking the banner at +8 put the FAB
                    // on top of the banner's close button, making it
                    // untappable. 66 = the FAB's top edge + a 12px gap.
                    bottom: "calc(var(--BottomTabBar-height, 60px) + 66px)",
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
                            {showIOSHowTo
                                ? t.services.pwaInstall.iosBody
                                : t.services.pwaInstall.body}
                        </Typography>
                    </Box>
                    {canPrompt && (
                        <Button loading={installing} size="sm" onClick={handleInstall}>
                            {t.services.pwaInstall.install}
                        </Button>
                    )}
                    {/* iOS has no install API, so the banner's action is
                        opening the two-step instructions instead — a banner
                        titled "Install" with nothing to tap reads as broken. */}
                    {showIOSHowTo && (
                        <Button size="sm" onClick={() => setHowOpen(true)}>
                            {t.services.pwaInstall.how}
                        </Button>
                    )}
                    <IconButton color="neutral" size="sm" variant="plain" onClick={handleDismiss}>
                        <CloseRounded />
                    </IconButton>
                </Stack>
            </Sheet>

            <Modal open={howOpen} onClose={() => setHowOpen(false)}>
                <ModalDialog
                    sx={{
                        width: "calc(100vw - 32px)",
                        maxWidth: 420,
                    }}
                >
                    <DialogTitle>{t.services.pwaInstall.howTitle}</DialogTitle>
                    <DialogContent>
                        <Stack spacing={2} sx={{ pt: 1 }}>
                            <HowToStep
                                icon={<IosShareRounded />}
                                step={1}
                                text={t.services.pwaInstall.howStep1}
                            />
                            <HowToStep
                                icon={<AddBoxOutlined />}
                                step={2}
                                text={t.services.pwaInstall.howStep2}
                            />
                            <Typography level="body-xs" sx={{ color: "text.tertiary" }}>
                                {t.services.pwaInstall.howNote}
                            </Typography>
                            <Button fullWidth onClick={() => setHowOpen(false)}>
                                {t.common.actions.done}
                            </Button>
                        </Stack>
                    </DialogContent>
                </ModalDialog>
            </Modal>
        </>
    );
};
