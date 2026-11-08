import { useSyncExternalStore } from "react";
import { Box } from "@mui/joy";

import { ErrorState } from "../../../../components/ui/feedback/ErrorState";
import { SkeletonRows } from "../../../../components/ui/feedback/Skeleton";
import { useTranslation } from "../../../../i18n";
import { channelService } from "../../../../services/channel/channelService";
import { isV3Uuid } from "../../../../utils/legacyId";
import { useChannelReload } from "../../../channel/hooks/useChannelReload";

/**
 * "Couldn't load this conversation. Retry" for an EMPTY message list whose
 * history sync failed (MIP-1299). Before, the list fell through to a blank
 * scroller, which reads as "nothing was ever said here".
 *
 * Mounted by `MessageListRenderer` only while the list has no rows, so the
 * channel-store subscription costs nothing for a chat that has messages, and
 * the Virtuoso scroll logic is untouched: this is an overlay on the (empty)
 * list, centered in its `position: relative` wrapper, and renders nothing
 * unless the sync failed.
 */
export const ChatHistoryLoadFailed = ({
    channelId,
    isThread,
}: {
    channelId: string;
    isThread: boolean;
}) => {
    const { t } = useTranslation();
    const failed = useSyncExternalStore(
        channelService.subscribe,
        () => channelService.getSnapshot().syncFailedByChannel.has(channelId),
        () => false
    );
    const { reload, reloading } = useChannelReload(channelId);
    if (!isV3Uuid(channelId) || (!failed && !reloading)) return null;
    return (
        <Box
            sx={{
                position: "absolute",
                inset: 0,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                minWidth: 0,
            }}
        >
            {reloading ? (
                <Box sx={{ width: "100%" }}>
                    <SkeletonRows count={4} avatar twoLines />
                </Box>
            ) : (
                <ErrorState
                    data-error="chat-history"
                    title={
                        isThread
                            ? t.chat.channel.thread.loadFailed
                            : t.chat.channel.pane.loadFailed
                    }
                    onRetry={reload}
                />
            )}
        </Box>
    );
};
