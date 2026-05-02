import NotificationsActiveRounded from "@mui/icons-material/NotificationsActiveRounded";
import NotificationsOffRounded from "@mui/icons-material/NotificationsOffRounded";
import { IconButton, Tooltip } from "@mui/joy";

import { useNotificationsContext } from "./NotificationsContext";

interface MuteToggleButtonProps {
    chatType: number;
    chatId: string | number | null | undefined;
    /** Optional Joy color override; defaults to "neutral". */
    color?: "neutral" | "primary" | "danger" | "success" | "warning";
    /** Optional size override; defaults to "sm". */
    size?: "sm" | "md" | "lg";
}

/**
 * Drop-in mute toggle for a chat header. Reads/writes the per-chat mute
 * pref via `NotificationsContext`. Renders nothing when there is no
 * provider (e.g. during initial load) or when chatId is missing.
 */
export const MuteToggleButton = ({
    chatType,
    chatId,
    color = "neutral",
    size = "sm",
}: MuteToggleButtonProps) => {
    const ctx = useNotificationsContext();
    if (!ctx) return null;
    if (chatId === null || chatId === undefined || chatId === "") return null;

    const key = String(chatId);
    const muted = ctx.isMuted(chatType, key);

    const handleClick = (event: React.MouseEvent) => {
        event.stopPropagation();
        if (muted) {
            ctx.unmute(chatType, key);
        } else {
            ctx.mute(chatType, key);
        }
    };

    return (
        <Tooltip
            title={muted ? "Unmute notifications" : "Mute notifications"}
            placement="bottom"
            size="sm"
            variant="soft"
            sx={{ zIndex: 10020 }}
        >
            <IconButton
                size={size}
                variant="plain"
                color={color}
                onClick={handleClick}
                aria-label={muted ? "Unmute notifications" : "Mute notifications"}
            >
                {muted ? <NotificationsOffRounded /> : <NotificationsActiveRounded />}
            </IconButton>
        </Tooltip>
    );
};
