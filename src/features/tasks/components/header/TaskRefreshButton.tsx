import { useCallback, useEffect, useRef, useState } from "react";
import RefreshRoundedIcon from "@mui/icons-material/RefreshRounded";
import { IconButton } from "@mui/joy";

import { AppTooltip } from "../../../../components/ui/AppTooltip";
import { Spinner } from "../../../../components/ui/feedback/Skeleton";
import { toast } from "../../../../components/ui/feedback/toastStore";
import { useTranslation } from "../../../../i18n";
import { focusRing } from "../../../../theme/tokens";
import {
    getPrResyncRequest,
    requestPrResync,
    whenPrResyncDone,
} from "../../../integrations/services/prResync";

type Props = {
    /** Reload the open project's task rows. */
    onRefresh: () => Promise<void>;
};

/**
 * "Refresh Tasks" in the task table's header: reload the rows, and re-sync the PR column with
 * them (MIP-1409). Both take a moment (the PR half asks GitHub with `fresh=1`, a call per
 * matching branch), and until now the button said nothing: no sign it was working, finished,
 * or ignored.
 *
 * Same shape as the Inbox's Sync button (`InboxSyncButton`): the spinner replaces the icon inside
 * the same button, which stays focusable (`aria-busy`, not disabled), so the header never
 * shifts; the answer is a toast with one id, so pressing again replaces it instead of stacking,
 * and a phone, which has no hover, still hears it. It stays busy until the rows are back AND
 * the PR column has answered, not just the rows, which come back first.
 */
export const TaskRefreshButton = ({ onRefresh }: Props) => {
    const { t } = useTranslation();
    const [busy, setBusy] = useState(false);
    const alive = useRef(true);
    useEffect(() => {
        alive.current = true;
        return () => {
            alive.current = false;
        };
    }, []);
    // A ref as well as state: two presses in one frame both see `busy` false until React
    // re-renders, and a press while one runs would only start the same work twice.
    const inFlight = useRef(false);

    const refresh = useCallback(async () => {
        if (inFlight.current) return;
        inFlight.current = true;
        setBusy(true);

        // The PR column re-syncs with the rows; it had no other way to learn of a merge or a CI
        // run short of re-opening the table. A second click within the cooldown only reloads
        // the rows (`false`: the column is not asked again).
        const asked = requestPrResync("manual");
        const prs = asked
            ? whenPrResyncDone(getPrResyncRequest().id)
            : Promise.resolve({ rows: 0, failed: 0 });

        let rowsReloaded = true;
        try {
            await onRefresh();
        } catch (error) {
            rowsReloaded = false;
            console.error("Failed to refresh the tasks", error);
        }
        const prResult = await prs;

        inFlight.current = false;
        if (alive.current) setBusy(false);
        const s = t.tasks.header;
        if (!rowsReloaded) toast.error(s.refreshFailed, { id: "tasks-refresh" });
        else if (prResult.failed > 0) toast.error(s.refreshPrsFailed, { id: "tasks-refresh" });
        else toast.neutral(s.refreshed, { id: "tasks-refresh", duration: 2500 });
    }, [onRefresh, t]);

    return (
        <AppTooltip title={t.tasks.header.refreshTasks}>
            <IconButton
                // Busy, not disabled: a disabled button drops keyboard focus, and the press that
                // started this would lose its place in the header.
                aria-busy={busy}
                aria-label={t.tasks.header.refreshTasks}
                color="neutral"
                data-testid="task-refresh"
                size="sm"
                sx={{ "&:focus-visible": focusRing }}
                variant="plain"
                onClick={() => void refresh()}
            >
                {busy ? (
                    // Not the Button `loading` prop: that disables the button.
                    <Spinner />
                ) : (
                    <RefreshRoundedIcon sx={{ fontSize: 18 }} />
                )}
            </IconButton>
        </AppTooltip>
    );
};
