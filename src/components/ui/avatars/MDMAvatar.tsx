import PeopleRoundedIcon from "@mui/icons-material/PeopleRounded";
import { Avatar, Box } from "@mui/joy";
import { useColorScheme } from "@mui/joy/styles";

import { UserProps } from "../../../types/admin";
import { MDMMemberProps } from "../../../types/chat";
import { PulseDot } from "../misc/PulseDot";

const media_url = import.meta.env.VITE_MEDIA_ROOT_DJANGO;

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
    const { mode } = useColorScheme();
    const isDark = mode === "dark";

    const miniSize = avatarSize ?? (size === "sm" ? 28 : 32);
    const maxVisible = 3;

    if (!members || members.length === 0) {
        return (
            <Avatar
                size={size}
                sx={{
                    ...(avatarSize ? { width: avatarSize, height: avatarSize } : {}),
                    background: isDark
                        ? "linear-gradient(135deg, rgba(59, 130, 246, 0.3) 0%, rgba(37, 99, 235, 0.3) 100%)"
                        : "linear-gradient(135deg, rgba(59, 130, 246, 0.2) 0%, rgba(37, 99, 235, 0.2) 100%)",
                    border: "1px solid",
                    borderColor: isDark ? "rgba(59, 130, 246, 0.4)" : "rgba(59, 130, 246, 0.3)",
                }}
            >
                <PeopleRoundedIcon
                    sx={{
                        fontSize: avatarSize
                            ? Math.round(avatarSize * 0.64)
                            : size === "sm"
                              ? 18
                              : 22,
                        color: isDark ? "#60a5fa" : "#3b82f6",
                    }}
                />
            </Avatar>
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
                const dotSize = Math.max(6, miniSize * 0.28);

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
                        <Avatar
                            size="sm"
                            src={imgSrc}
                            sx={{
                                width: miniSize,
                                height: miniSize,
                                fontSize: 10,
                                fontWeight: 700,
                                border: "1.5px solid",
                                borderColor: isDark
                                    ? "var(--joy-palette-background-surface)"
                                    : "#fff",
                                background: isDark
                                    ? `hsl(${(index * 90 + 200) % 360}, 50%, 30%)`
                                    : `hsl(${(index * 90 + 200) % 360}, 60%, 85%)`,
                                color: isDark
                                    ? `hsl(${(index * 90 + 200) % 360}, 70%, 75%)`
                                    : `hsl(${(index * 90 + 200) % 360}, 60%, 40%)`,
                            }}
                        >
                            {member.userName?.[0]?.toUpperCase() || "?"}
                        </Avatar>
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
                                    color={isOnline ? "#4caf50" : "#999"}
                                    sx={{
                                        width: dotSize,
                                        height: dotSize,
                                        marginLeft: 0,
                                    }}
                                />
                            </Box>
                        )}
                    </Box>
                );
            })}
        </Box>
    );
};
