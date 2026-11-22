import { useFirstRunPromptGate } from "../../hooks/common/useFirstRunPromptGate";
import { useInstallBannerEligible } from "../../hooks/common/useInstallBannerEligible";
import type { WebNotificationPermission } from "../../hooks/common/useNotifications";
import { PermissionBanner } from "../../services/notifications/PermissionBanner";
import { InstallBanner } from "./InstallBanner";

interface FirstScreenPromptProps {
    masterEnabled: boolean;
    permission: WebNotificationPermission;
    requestPermission: () => Promise<WebNotificationPermission>;
}

/**
 * The one prompt slot above the first screen (MIP-1866).
 *
 * A new account used to see the notifications bar and the install banner stacked above its first
 * content. Now:
 *   - nothing shows until the person has seen the app (`useFirstRunPromptGate`: a second visit,
 *     or a first action in this visit);
 *   - then at most one shows: the install banner where it can be offered (a phone with an install
 *     prompt, or iOS), otherwise the notifications bar.
 */
export const FirstScreenPrompt = ({
    masterEnabled,
    permission,
    requestPermission,
}: FirstScreenPromptProps) => {
    const open = useFirstRunPromptGate();
    const installEligible = useInstallBannerEligible();
    if (!open) return null;
    if (installEligible) return <InstallBanner />;
    return (
        <PermissionBanner
            masterEnabled={masterEnabled}
            permission={permission}
            requestPermission={requestPermission}
        />
    );
};
