import { useCallback, useEffect, useRef, useState } from "react";
import RefreshRoundedIcon from "@mui/icons-material/RefreshRounded";
import { CircularProgress, IconButton } from "@mui/joy";

import { AppTooltip } from "../../../components/ui/AppTooltip";
import { toast } from "../../../components/ui/feedback/toastStore";
import { fmt, useTranslation } from "../../../i18n";
import { focusRing } from "../../../theme/tokens";
import { requestInboxResync } from "../inboxResyncEvent";

/**
 * "Sync inbox": fetch what arrived that no socket event announced (a report a
 * schedule filed, a reminder, a row another tab changed). It asks
 * `useInboxResync` for the same checkpointed delta sync the wake refresh runs,
 * so one press is one `?since=` request however many rows come back.
 *
 * It does not change size when it works: the spinner replaces the icon inside
 * the same 32px button (still focusable, `aria-busy`), and the answer ("Up to date", "3 new items") is a
 * toast rather than text beside the button, so the header never shifts and a
 * phone, which has no hover, still hears the result. One toast id, so
 * pressing it again replaces the answer instead of stacking.
 */
export const InboxSyncButton = () => {
    const { t } = useTranslation();
    const [syncing, setSyncing] = useState(false);
    const alive = useRef(true);
    useEffect(() => {
        alive.current = true;
        return () => {
            alive.current = false;
        };
    }, []);

    // A ref as well as state: two presses in one frame both see `syncing`
    // false until React re-renders.
    const inFlight = useRef(false);

    const sync = useCallback(async () => {
        if (inFlight.current) return;
        inFlight.current = true;
        setSyncing(true);
        const res = await requestInboxResync("manual");
        inFlight.current = false;
        if (alive.current) setSyncing(false);
        const s = t.inbox.sync;
        if (!res.ok) toast.error(s.failed, { id: "inbox-sync" });
        else if (res.added === 0) toast.neutral(s.upToDate, { id: "inbox-sync", duration: 2500 });
        else toast.success(fmt(s.added, { count: res.added }), { id: "inbox-sync" });
    }, [t]);

    return (
        <AppTooltip title={t.inbox.sync.label}>
            <IconButton
                aria-label={t.inbox.sync.label}
                color="neutral"
                data-testid="inbox-sync"
                // Busy, not disabled: a disabled button drops keyboard focus, and the
                // press that started this would lose its place in the header.
                aria-busy={syncing}
                size="sm"
                sx={{ "&:focus-visible": focusRing }}
                variant="plain"
                onClick={() => void sync()}
            >
                {syncing ? (
                    <CircularProgress
                        size="sm"
                        thickness={2}
                        sx={{ "--CircularProgress-size": "18px" }}
                    />
                ) : (
                    <RefreshRoundedIcon sx={{ fontSize: 18 }} />
                )}
            </IconButton>
        </AppTooltip>
    );
};
