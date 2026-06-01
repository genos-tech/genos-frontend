import NotificationsActiveRounded from "@mui/icons-material/NotificationsActiveRounded";
import NotificationsOffRounded from "@mui/icons-material/NotificationsOffRounded";
import { IconButton, Tooltip } from "@mui/joy";

import { useTranslation } from "../../i18n";
import { NotificationCategory } from "./categories";
import { useNotificationsContext } from "./NotificationsContext";
import { MutedTargetType } from "./types";

interface MuteTargetButtonProps {
    /** What kind of object this button mutes (thread / task / note). */
    targetType: MutedTargetType;
    /** The object's id. Numbers are normalized to strings internally. */
    targetId: string | number | null | undefined;
    /** Optional chat scope, stored on the mute entry (for thread targets). */
    chatType?: number;
    /** Optional category scope — when set the mute applies only to these
     *  categories (e.g. mute mentions but keep comments). */
    categories?: NotificationCategory[];
    /** Display label persisted for the settings "Muted items" list. */
    label?: string;
    /** Optional Joy color override; defaults to "neutral". */
    color?: "neutral" | "primary" | "danger" | "success" | "warning";
    /** Optional size override; defaults to "sm". */
    size?: "sm" | "md" | "lg";
}

/**
 * Drop-in per-object mute toggle for a thread / task / note header. Mirrors
 * `MuteToggleButton` (the chat-level bell) but reads/writes the generalized
 * `mutedTargets` pref via `muteTarget` / `unmuteTarget`. Renders nothing
 * when there is no provider or when `targetId` is missing.
 */
export const MuteTargetButton = ({
    targetType,
    targetId,
    chatType,
    categories,
    label,
    color = "neutral",
    size = "sm",
}: MuteTargetButtonProps) => {
    const ctx = useNotificationsContext();
    const { t } = useTranslation();
    if (!ctx) return null;
    if (targetId === null || targetId === undefined || targetId === "") return null;

    const id = String(targetId);
    const muted = ctx.isTargetMutedByKey(targetType, id);
    const tooltip = muted
        ? t.services.notifications.muteButton.unmute
        : t.services.notifications.muteButton.mute;

    const handleClick = (event: React.MouseEvent) => {
        event.stopPropagation();
        if (muted) {
            ctx.unmuteTarget(targetType, id);
        } else {
            ctx.muteTarget({
                targetType,
                targetId: id,
                ...(chatType !== undefined ? { chatType } : {}),
                ...(categories && categories.length ? { categories } : {}),
                ...(label ? { label } : {}),
            });
        }
    };

    return (
        <Tooltip
            placement="bottom"
            size="sm"
            sx={{ zIndex: 10020 }}
            title={tooltip}
            variant="outlined"
        >
            <IconButton
                aria-label={tooltip}
                color={color}
                size={size}
                variant="plain"
                onClick={handleClick}
            >
                {muted ? <NotificationsOffRounded /> : <NotificationsActiveRounded />}
            </IconButton>
        </Tooltip>
    );
};
