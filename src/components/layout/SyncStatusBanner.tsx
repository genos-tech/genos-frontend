import { useState } from "react";

import { useTranslation } from "../../i18n";
import { syncStatus, useSyncBanner } from "../../services/syncStatus";
import { Toast } from "../ui/feedback/Toast";

/**
 * "Couldn't sync your workspace. Retry" (MIP-1298).
 *
 * Shown when the background refresh (`refreshAllData`, the project list, the
 * channel list) failed. The data already on screen stays: this is the quiet
 * "it may be out of date" signal that a warm cache never had, with the one
 * action that can fix it. It sits in the same top banner region as the
 * connection banner (`ConnectionStatusSnackbar`), has no timer (it is a state,
 * not an event), goes away by itself when a retry succeeds, and can be closed;
 * a closed banner stays closed for that outage and returns for the next one.
 *
 * `hidden` while the connection banner says the API is unreachable: that one is
 * the cause, two stacked banners would be the same news twice, and the empty
 * surfaces still carry their own Retry. The sync banner returns when it clears.
 *
 * An EMPTY surface does not rely on this banner: it shows its own `ErrorState`
 * (`useSyncFailure`), so a failed first load never reads as an empty workspace.
 */
export const SyncStatusBanner = ({ hidden = false }: { hidden?: boolean }) => {
    const { t } = useTranslation();
    const { failed, syncing, episode } = useSyncBanner();
    const [dismissedEpisode, setDismissedEpisode] = useState(0);
    const s = t.common.feedback.sync;

    return (
        <Toast
            action={{ label: t.common.actions.retry, onClick: syncStatus.retry }}
            duration={null}
            open={!hidden && failed && dismissedEpisode !== episode}
            placement="top"
            tone="warning"
            onClose={(reason) => {
                if (reason === "dismiss") setDismissedEpisode(episode);
            }}
        >
            {syncing ? s.bannerRetrying : s.banner}
        </Toast>
    );
};
