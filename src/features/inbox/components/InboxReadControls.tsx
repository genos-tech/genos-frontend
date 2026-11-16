import { useCallback, useState } from "react";
import MarkEmailReadRoundedIcon from "@mui/icons-material/MarkEmailReadRounded";
import MarkEmailUnreadRoundedIcon from "@mui/icons-material/MarkEmailUnreadRounded";
import { Box, IconButton } from "@mui/joy";

import { AppTooltip } from "../../../components/ui/AppTooltip";
import { toast } from "../../../components/ui/feedback/toastStore";
import { useAuth } from "../../../context/AuthContext";
import { useTranslation } from "../../../i18n";
import { focusRing, g } from "../../../theme/tokens";
import type { InboxItemProps } from "../../../types/common";
import { holdUnread, readKey, releaseHold } from "../readHold";
import { markInboxRead, markInboxUnread } from "../services/markInboxRead";

// Screen-reader-only text: the dot is the visual cue, this is the same cue for everyone else.
const visuallyHidden = {
    position: "absolute",
    width: 1,
    height: 1,
    overflow: "hidden",
    clip: "rect(0 0 0 0)",
    whiteSpace: "nowrap",
} as const;

/** The small accent dot that says "you haven't looked at this yet". */
export const UnreadDot = () => {
    const { t } = useTranslation();
    return (
        <Box
            component="span"
            data-testid="inbox-unread-dot"
            sx={{
                position: "relative",
                display: "inline-block",
                width: 8,
                height: 8,
                flexShrink: 0,
                borderRadius: "50%",
                background: g.accent.solid,
            }}
        >
            <Box component="span" sx={visuallyHidden}>
                {t.inbox.markAll.unread}
            </Box>
        </Box>
    );
};

type ToggleProps = {
    inboxItem: Pick<InboxItemProps, "itemId" | "isRead">;
    userId: string;
    teamId: string;
    /** Re-read the list (and so the counts) once the stored row is patched. */
    onChanged?: () => void;
};

/**
 * "Mark as read" / "Mark as unread" on one activity card (MIP-1627).
 *
 * Unread-by-hand HOLDS the card first (`readHold`): it is often still on screen, and looking at
 * it must not undo the member's choice. Nothing is changed locally until the server has taken
 * it, so a failure leaves the card as the server has it and says so.
 */
export const ReadToggleButton = ({ inboxItem, userId, teamId, onChanged }: ToggleProps) => {
    const { t } = useTranslation();
    const { accessToken } = useAuth();
    const [busy, setBusy] = useState(false);
    const markingRead = !inboxItem.isRead;
    const label = markingRead ? t.inbox.actions.markRead : t.inbox.actions.markUnread;

    const toggle = useCallback(async () => {
        if (busy) return;
        setBusy(true);
        const key = readKey(userId, teamId, inboxItem.itemId);
        // Hold BEFORE the write: the re-render its patch causes is what would otherwise make the
        // card eligible for the dwell rule again.
        if (!markingRead) holdUnread(key);
        const ok = markingRead
            ? await markInboxRead(accessToken, teamId, inboxItem.itemId)
            : await markInboxUnread(accessToken, teamId, inboxItem.itemId);
        setBusy(false);
        if (!ok) {
            if (!markingRead) releaseHold(key);
            toast.error(t.inbox.markAll.toggleFailed, { id: `inbox-read-${inboxItem.itemId}` });
            return;
        }
        if (markingRead) releaseHold(key);
        onChanged?.();
    }, [accessToken, busy, inboxItem.itemId, markingRead, onChanged, t, teamId, userId]);

    return (
        <AppTooltip title={label}>
            <IconButton
                aria-busy={busy}
                aria-label={label}
                color="neutral"
                data-testid="inbox-read-toggle"
                size="sm"
                sx={{ "--IconButton-size": "24px", "&:focus-visible": focusRing }}
                variant="plain"
                // The card is clickable as a whole (`Clickable`): keep this from also navigating.
                onClick={(event) => {
                    event.stopPropagation();
                    void toggle();
                }}
            >
                {markingRead ? (
                    <MarkEmailReadRoundedIcon sx={{ fontSize: 16 }} />
                ) : (
                    <MarkEmailUnreadRoundedIcon sx={{ fontSize: 16 }} />
                )}
            </IconButton>
        </AppTooltip>
    );
};
