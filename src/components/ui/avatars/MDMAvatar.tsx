import { Avatar, Box } from "@mui/joy";
import { useColorScheme } from "@mui/joy/styles";
import PeopleRoundedIcon from "@mui/icons-material/PeopleRounded";

import { MDMMemberProps } from "../../../types/chat";

const media_url = import.meta.env.VITE_MEDIA_ROOT_DJANGO;

type MDMAvatarProps = {
    members?: MDMMemberProps[];
    size?: "sm" | "md";
};

export const MDMAvatar: React.FC<MDMAvatarProps> = ({ members, size = "sm" }) => {
    const { mode } = useColorScheme();
    const isDark = mode === "dark";

    const avatarSize = size === "sm" ? 32 : 40;
    const miniSize = size === "sm" ? 20 : 24;
    const maxVisible = 3;

    if (!members || members.length === 0) {
        return (
            <Avatar
                size={size}
                sx={{
                    background: isDark
                        ? "linear-gradient(135deg, rgba(59, 130, 246, 0.3) 0%, rgba(37, 99, 235, 0.3) 100%)"
                        : "linear-gradient(135deg, rgba(59, 130, 246, 0.2) 0%, rgba(37, 99, 235, 0.2) 100%)",
                    border: "1px solid",
                    borderColor: isDark ? "rgba(59, 130, 246, 0.4)" : "rgba(59, 130, 246, 0.3)",
                }}
            >
                <PeopleRoundedIcon sx={{ fontSize: size === "sm" ? 18 : 22, color: isDark ? "#60a5fa" : "#3b82f6" }} />
            </Avatar>
        );
    }

    const visibleMembers = members.slice(0, maxVisible);

    return (
        <Box sx={{ position: "relative", width: avatarSize, height: avatarSize, flexShrink: 0 }}>
            {visibleMembers.map((member, index) => {
                const offset = index * (miniSize * 0.55);
                const imgSrc = member.avatarImgPath
                    ? `${media_url}${member.avatarImgPath}`
                    : undefined;

                return (
                    <Avatar
                        key={member.userId}
                        size="sm"
                        src={imgSrc}
                        sx={{
                            position: "absolute",
                            width: miniSize,
                            height: miniSize,
                            fontSize: 10,
                            fontWeight: 700,
                            bottom: 0,
                            left: offset,
                            zIndex: maxVisible - index,
                            border: "2px solid",
                            borderColor: isDark ? "#1a1a2e" : "#ffffff",
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
                );
            })}
        </Box>
    );
};
