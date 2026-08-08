import NotificationsActiveRounded from "@mui/icons-material/NotificationsActiveRounded";
import NotificationsOffRounded from "@mui/icons-material/NotificationsOffRounded";
import { IconButton, MenuItem } from "@mui/joy";

import { AppTooltip } from "../../components/ui/AppTooltip";
import { useTranslation } from "../../i18n";
import { useNotificationsContext } from "./NotificationsContext";

interface MuteToggleButtonProps {
    chatType: number;
    chatId: string | number | null | undefined;
    /** Display name persisted alongside the mute entry so the settings
     *  panel can show a readable label instead of a raw chat id. Optional
     *  — when omitted the panel falls back to displaying `chatId`. */
    chatName?: string;
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
    chatName,
    color = "neutral",
    size = "sm",
}: MuteToggleButtonProps) => {
    const ctx = useNotificationsContext();
    const { t } = useTranslation();
    if (!ctx) return null;
    if (chatId === null || chatId === undefined || chatId === "") return null;

    const key = String(chatId);
    const muted = ctx.isMuted(chatType, key);
    const label = muted
        ? t.services.notifications.muteButton.unmute
        : t.services.notifications.muteButton.mute;

    const handleClick = (event: React.MouseEvent) => {
        event.stopPropagation();
        if (muted) {
            ctx.unmute(chatType, key);
        } else {
            ctx.mute(chatType, key, chatName);
        }
    };

    return (
        <AppTooltip placement="bottom" size="sm" title={label}>
            <IconButton
                aria-label={label}
                color={color}
                size={size}
                variant="plain"
                onClick={handleClick}
            >
                {muted ? <NotificationsOffRounded /> : <NotificationsActiveRounded />}
            </IconButton>
        </AppTooltip>
    );
};

/**
 * Same per-chat mute toggle as `MuteToggleButton`, rendered as a
 * `<MenuItem>` for an overflow menu instead of a standalone icon button.
 * Used on the mobile chat header, where the ToDo action takes the visible
 * icon slot and mute moves into the overflow "…" menu.
 */
export const MuteMenuItem = ({
    chatType,
    chatId,
    chatName,
}: Pick<MuteToggleButtonProps, "chatType" | "chatId" | "chatName">) => {
    const ctx = useNotificationsContext();
    const { t } = useTranslation();
    if (!ctx) return null;
    if (chatId === null || chatId === undefined || chatId === "") return null;

    const key = String(chatId);
    const muted = ctx.isMuted(chatType, key);
    const label = muted
        ? t.services.notifications.muteButton.unmute
        : t.services.notifications.muteButton.mute;

    const handleClick = () => {
        if (muted) {
            ctx.unmute(chatType, key);
        } else {
            ctx.mute(chatType, key, chatName);
        }
    };

    return (
        <MenuItem aria-label={label} onClick={handleClick}>
            {muted ? (
                <NotificationsOffRounded sx={{ fontSize: 18 }} />
            ) : (
                <NotificationsActiveRounded sx={{ fontSize: 18 }} />
            )}
            {label}
        </MenuItem>
    );
};
