import { useSyncExternalStore } from "react";
import HistoryToggleOffRoundedIcon from "@mui/icons-material/HistoryToggleOffRounded";
import { Box, Typography } from "@mui/joy";

import { fmt, useTranslation } from "../../../../i18n";
import { channelService } from "../../../../services/channel/channelService";

/**
 * Slim strip under the chat header when the viewer's plan hides part
 * of this channel's history (tier retention — hide, not delete;
 * upgrading restores it).
 *
 * Driven entirely by the channelService snapshot: the message delta
 * envelope stamps `retention` per channel, and `truncated` only turns
 * true when the server confirmed there ARE hidden messages — so the
 * banner never shows for channels younger than the window, or for
 * plans with unlimited history (no `retention` at all).
 *
 * `channelId` arrives via the legacy `chatId` slot, which carries the
 * v3 UUID through a `number`-typed field (migration shim) — hence the
 * defensive String().
 */
export const RetentionBanner = ({
    channelId,
}: {
    channelId: string | number | null | undefined;
}) => {
    const { t } = useTranslation();
    const snapshot = useSyncExternalStore(
        channelService.subscribe,
        channelService.getSnapshot,
        channelService.getSnapshot
    );
    const retention =
        channelId != null ? snapshot.retentionByChannel.get(String(channelId)) : undefined;
    if (!retention?.truncated) return null;
    return (
        <Box
            sx={{
                px: 2,
                py: 0.5,
                bgcolor: "warning.softBg",
                borderBottom: "1px solid",
                borderColor: "divider",
                flexShrink: 0,
            }}
        >
            <Typography
                level="body-xs"
                startDecorator={<HistoryToggleOffRoundedIcon sx={{ fontSize: 14 }} />}
                sx={{ color: "warning.softColor", fontWeight: 500 }}
            >
                {fmt(t.chat.retentionBanner, { days: String(retention.days) })}
            </Typography>
        </Box>
    );
};
