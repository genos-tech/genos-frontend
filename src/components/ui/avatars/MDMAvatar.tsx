import NotificationsPausedRoundedIcon from "@mui/icons-material/NotificationsPausedRounded";
import PeopleRoundedIcon from "@mui/icons-material/PeopleRounded";
import { Box } from "@mui/joy";

import { fmt, useTranslation } from "../../../i18n";
import { g } from "../../../theme/tokens";
import { UserProps } from "../../../types/admin";
import { MDMMemberProps } from "../../../types/chat";
import { initialOf } from "../../../utils/initials";
import { PRESENCE_COLOR } from "../misc/presenceColor";
import { PulseDot } from "../misc/PulseDot";
import { BaseAvatar } from "./BaseAvatar";

const media_url = import.meta.env.VITE_MEDIA_ROOT_DJANGO;

// A stacked member with no picture is tinted by position, so neighbours read apart: blue, the
// theme's accent, amber (the blue / violet / orange the hsl formula gave).
const MEMBER_TONES = ["info", "accent", "warning"] as const;

type MDMAvatarProps = {
    members?: MDMMemberProps[];
    size?: "sm" | "md";
    teamMemberProfiles?: Record<string, UserProps>;
    /**
     * Exact pixel size of each member circle, overriding the `size`
     * preset. Same escape hatch `GMAvatar` / `ProjectAvatar` expose under
     * this name, for dense surfaces (note-sidebar folder rows at 18px)
     * where neither 28 nor 32 fits. The overlap step and the empty-state
     * glyph scale with it so the stack keeps its proportions.
     */
    avatarSize?: number;
};

export const MDMAvatar: React.FC<MDMAvatarProps> = ({
    members,
    size = "sm",
    teamMemberProfiles,
    avatarSize,
}) => {
    const { t } = useTranslation();

    const miniSize = avatarSize ?? (size === "sm" ? 28 : 32);
    const maxVisible = 3;

    if (!members || members.length === 0) {
        return (
            <BaseAvatar
                size={avatarSize ?? (size === "sm" ? "md" : "lg")}
                sx={{ border: "1px solid", borderColor: g.info.border }}
                tone="info"
            >
                <PeopleRoundedIcon
                    sx={{
                        fontSize: avatarSize
                            ? Math.round(avatarSize * 0.64)
                            : size === "sm"
                              ? 18
                              : 22,
                    }}
                />
            </BaseAvatar>
        );
    }

    const visibleMembers = members.slice(0, maxVisible);
    const step = miniSize * 0.55;
    const totalWidth = miniSize + (visibleMembers.length - 1) * step;

    return (
        <Box
            sx={{
                position: "relative",
                width: totalWidth,
                height: miniSize,
                flexShrink: 0,
                alignSelf: "center",
            }}
        >
            {visibleMembers.map((member, index) => {
                const imgSrc = member.avatarImgPath
                    ? `${media_url}/${member.avatarImgPath}`
                    : undefined;
                const profile = teamMemberProfiles?.[member.userId];
                const isOnline = profile?.isOnline === true && profile?.isOfflineForced !== "true";
                const isPaused = profile?.isNotificationsPaused === true;
                const dotSize = Math.max(6, miniSize * 0.28);
                const pauseIconSize = Math.max(9, Math.round(miniSize * 0.4));
                const pauseTitle = fmt(t.services.notifications.pause.avatarTooltip, {
                    name: member.userName || "",
                });

                return (
                    <Box
                        key={member.userId}
                        sx={{
                            position: "absolute",
                            top: 0,
                            left: index * step,
                            zIndex: maxVisible - index,
                            width: miniSize,
                            height: miniSize,
                        }}
                    >
                        <BaseAvatar
                            size={miniSize}
                            src={imgSrc}
                            sx={{
                                fontSize: 10,
                                fontWeight: 600,
                                // The ring that separates the overlapped circles: the surface
                                // they sit on, in either mode.
                                border: "1.5px solid",
                                borderColor: g.surface.default,
                            }}
                            tone={MEMBER_TONES[index % MEMBER_TONES.length]}
                        >
                            {initialOf(member.userName)}
                        </BaseAvatar>
                        {teamMemberProfiles && (
                            <Box
                                sx={{
                                    position: "absolute",
                                    bottom: 7,
                                    right: 2,
                                    width: dotSize,
                                    height: dotSize,
                                    zIndex: 1,
                                }}
                            >
                                <PulseDot
                                    color={
                                        isOnline ? PRESENCE_COLOR.online : PRESENCE_COLOR.offline
                                    }
                                    sx={{
                                        width: dotSize,
                                        height: dotSize,
                                        marginLeft: 0,
                                    }}
                                />
                            </Box>
                        )}
                        {teamMemberProfiles && isPaused && (
                            // Paused-notifications moon at the top-right (the
                            // presence dot owns bottom-right). No tooltip
                            // wrapper: these mini-avatars overlap, so a hover
                            // target on each would fight the stack — the
                            // aria-label carries the accessible name instead.
                            <Box
                                aria-label={pauseTitle}
                                sx={{
                                    position: "absolute",
                                    top: -1,
                                    right: -1,
                                    zIndex: maxVisible + 1,
                                    display: "flex",
                                    color: "var(--joy-palette-warning-400)",
                                }}
                            >
                                <NotificationsPausedRoundedIcon sx={{ fontSize: pauseIconSize }} />
                            </Box>
                        )}
                    </Box>
                );
            })}
        </Box>
    );
};
