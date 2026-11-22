import { isIOSDevice, isStandaloneDisplay, useInstallPrompt } from "./useInstallPrompt";
import { useIsMobile } from "./useIsMobile";

// localStorage, not sessionStorage (contrast PermissionBanner): "no" to
// installing should stick across visits — re-asking every session is how
// install banners get hated.
const DISMISSED_KEY = "pwa:installBannerDismissed";

export const isDismissed = (): boolean => {
    if (typeof localStorage === "undefined") return false;
    return localStorage.getItem(DISMISSED_KEY) === "1";
};

export const markDismissed = () => {
    if (typeof localStorage === "undefined") return;
    localStorage.setItem(DISMISSED_KEY, "1");
};

/**
 * Whether the install banner would show on this device right now (the same conditions as
 * `InstallBanner` below). The first-screen prompt uses it to show one prompt, not both (MIP-1866).
 */
export const useInstallBannerEligible = (): boolean => {
    const isMobile = useIsMobile();
    const { canPrompt } = useInstallPrompt();
    if (!isMobile || isDismissed() || isStandaloneDisplay()) return false;
    return canPrompt || isIOSDevice();
};
