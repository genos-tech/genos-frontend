import { useCallback, useEffect, useRef, useState } from "react";
import DoneAllRoundedIcon from "@mui/icons-material/DoneAllRounded";
import { IconButton } from "@mui/joy";

import { AppTooltip } from "../../../components/ui/AppTooltip";
import { Spinner } from "../../../components/ui/feedback/Skeleton";
import { toast } from "../../../components/ui/feedback/toastStore";
import { useAuth } from "../../../context/authState";
import { fmt, useTranslation } from "../../../i18n";
import { focusRing } from "../../../theme/tokens";
import type { UserProps } from "../../../types/admin";
import type { InboxItemProps } from "../../../types/common";
import { readKey, releaseHold } from "../readHold";
import { markAllActivitiesRead } from "../services/markInboxRead";

type Props = {
    /** The Activities half, as the list shows it. */
    items: InboxItemProps[];
    myself: UserProps;
    /** Re-read the list (and so the counts) once the rows are patched. */
    onChanged: () => void;
};

/**
 * "Mark all as read" for the Activities tab (MIP-1627): one request, so the member's other
 * devices pick it up through the delta sync and the `inbox.changed` push it triggers.
 *
 * Shaped like the Sync button beside it: busy rather than disabled while it works (a disabled
 * button drops keyboard focus), and the answer is a toast with one id, so pressing it again
 * replaces the message. Disabled only when there is nothing unread.
 */
export const InboxMarkAllReadButton = ({ items, myself, onChanged }: Props) => {
    const { t } = useTranslation();
    const { accessToken } = useAuth();
    const [busy, setBusy] = useState(false);
    const inFlight = useRef(false);
    const alive = useRef(true);
    useEffect(() => {
        alive.current = true;
        return () => {
            alive.current = false;
        };
    }, []);

    const unread = items.some((item) => !item.isRead);

    const markAll = useCallback(async () => {
        if (inFlight.current) return;
        inFlight.current = true;
        setBusy(true);
        const res = await markAllActivitiesRead(accessToken, myself.teamId, items);
        inFlight.current = false;
        if (alive.current) setBusy(false);
        if (!res.ok) {
            toast.error(t.inbox.markAll.failed, { id: "inbox-mark-all" });
            return;
        }
        // Everything is read now, so a card held unread by hand is no longer held.
        for (const id of res.itemIds) releaseHold(readKey(myself.userId, myself.teamId, id));
        onChanged();
        toast.success(fmt(t.inbox.markAll.done, { count: res.updated }), {
            id: "inbox-mark-all",
            duration: 2500,
        });
    }, [accessToken, items, myself.teamId, myself.userId, onChanged, t]);

    return (
        <AppTooltip title={t.inbox.markAll.label}>
            <span>
                <IconButton
                    aria-busy={busy}
                    aria-label={t.inbox.markAll.label}
                    color="neutral"
                    data-testid="inbox-mark-all-read"
                    disabled={!unread && !busy}
                    size="sm"
                    sx={{ "&:focus-visible": focusRing }}
                    variant="plain"
                    onClick={() => void markAll()}
                >
                    {busy ? <Spinner /> : <DoneAllRoundedIcon sx={{ fontSize: 18 }} />}
                </IconButton>
            </span>
        </AppTooltip>
    );
};
