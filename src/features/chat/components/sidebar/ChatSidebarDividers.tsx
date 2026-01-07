import AddRoundedIcon from "@mui/icons-material/AddRounded";
import AlternateEmailRoundedIcon from "@mui/icons-material/AlternateEmailRounded";
import ChatBubbleOutlineRoundedIcon from "@mui/icons-material/ChatBubbleOutlineRounded";
import EmojiEmotionsRoundedIcon from "@mui/icons-material/EmojiEmotionsRounded";
import TaskAltRoundedIcon from "@mui/icons-material/TaskAltRounded";
import ViewListRoundedIcon from "@mui/icons-material/ViewListRounded";
import { Box, IconButton, Stack, Typography } from "@mui/joy";
import { useColorScheme } from "@mui/joy/styles";

// Shared divider base component
const DividerBase = ({
    children,
    icon,
}: {
    children: React.ReactNode;
    icon?: React.ReactNode;
}) => {
    const { mode } = useColorScheme();
    const isDark = mode === "dark";

    return (
        <Box
            sx={{
                px: 2,
                py: 1,
                borderBottom: "1px solid",
                borderColor: isDark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.04)",
                background: isDark ? "rgba(255,255,255,0.02)" : "rgba(0,0,0,0.01)",
            }}
        >
            <Stack direction="row" spacing={1} alignItems="center" justifyContent="center">
                {icon}
                <Typography
                    level="body-xs"
                    sx={{
                        fontWeight: 600,
                        fontSize: 11,
                        color: isDark ? "rgba(255,255,255,0.55)" : "rgba(0,0,0,0.55)",
                        letterSpacing: "0.02em",
                    }}
                >
                    {children}
                </Typography>
            </Stack>
        </Box>
    );
};

export const PinnedDivider = () => {
    return <DividerBase>Pinned Messages</DividerBase>;
};

type GMDividerProps = {
    setOpenCreateGM: (value: boolean) => void;
};

export const GMDivider = (props: GMDividerProps) => {
    const { setOpenCreateGM } = props;
    const { mode } = useColorScheme();
    const isDark = mode === "dark";

    return (
        <Box
            sx={{
                px: 2,
                py: 0.75,
                borderBottom: "1px solid",
                borderColor: isDark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.04)",
                background: isDark ? "rgba(255,255,255,0.02)" : "rgba(0,0,0,0.01)",
            }}
        >
            <Stack direction="row" spacing={1} alignItems="center" justifyContent="center">
                <Typography
                    level="body-xs"
                    sx={{
                        fontWeight: 600,
                        fontSize: 11,
                        color: isDark ? "rgba(255,255,255,0.55)" : "rgba(0,0,0,0.55)",
                        letterSpacing: "0.02em",
                    }}
                >
                    Group Messages
                </Typography>
                <IconButton
                    size="sm"
                    variant="plain"
                    onClick={() => setOpenCreateGM(true)}
                    sx={{
                        width: 22,
                        height: 22,
                        minWidth: 22,
                        minHeight: 22,
                        borderRadius: "6px",
                        color: isDark ? "rgba(255,255,255,0.5)" : "rgba(0,0,0,0.45)",
                        "&:hover": {
                            background: isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.05)",
                            color: isDark ? "#a78bfa" : "#7c3aed",
                        },
                    }}
                >
                    <AddRoundedIcon sx={{ fontSize: 14 }} />
                </IconButton>
            </Stack>
        </Box>
    );
};

export const DMDivider = () => {
    return <DividerBase>Direct Messages</DividerBase>;
};

export const PMDivider = () => {
    return <DividerBase>Project Updates</DividerBase>;
};

// Activity filter configuration
const ACTIVITY_FILTERS = [
    { id: 0, label: "All", icon: ViewListRoundedIcon },
    { id: 3, label: "Mentions", icon: AlternateEmailRoundedIcon },
    { id: 1, label: "Threads", icon: ChatBubbleOutlineRoundedIcon },
    { id: 4, label: "Reactions", icon: EmojiEmotionsRoundedIcon },
    { id: 2, label: "Tasks", icon: TaskAltRoundedIcon },
];

type ActivityDividerProps = {
    currentActivityMessageType: number;
    setCurrentActivityMessageType: (value: number) => void;
};

export const ActivityDivider = (props: ActivityDividerProps) => {
    const { currentActivityMessageType, setCurrentActivityMessageType } = props;
    const { mode } = useColorScheme();
    const isDark = mode === "dark";

    return (
        <Box
            sx={{
                px: 1.5,
                py: 1,
                borderBottom: "1px solid",
                borderColor: isDark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.04)",
            }}
        >
            <Stack
                direction="row"
                spacing={0.5}
                className={`custom-scrollbar-${isDark ? "dark" : "light"}`}
                sx={{
                    overflowX: "auto",
                    pb: 0.5,
                    "&::-webkit-scrollbar": {
                        height: 4,
                    },
                }}
            >
                {ACTIVITY_FILTERS.map((filter) => {
                    const Icon = filter.icon;
                    const isActive = currentActivityMessageType === filter.id;

                    return (
                        <Box
                            key={filter.id}
                            onClick={() => {
                                if (currentActivityMessageType !== filter.id) {
                                    setCurrentActivityMessageType(filter.id);
                                } else if (filter.id !== 0) {
                                    setCurrentActivityMessageType(0);
                                }
                            }}
                            sx={{
                                display: "flex",
                                alignItems: "center",
                                gap: 0.5,
                                px: 1.25,
                                py: 0.5,
                                borderRadius: "8px",
                                cursor: "pointer",
                                whiteSpace: "nowrap",
                                transition: "all 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
                                background: isActive
                                    ? isDark
                                        ? "linear-gradient(135deg, rgba(99,102,241,0.18) 0%, rgba(139,92,246,0.12) 100%)"
                                        : "linear-gradient(135deg, rgba(79,70,229,0.12) 0%, rgba(124,58,237,0.06) 100%)"
                                    : "transparent",
                                border: "1px solid",
                                borderColor: isActive
                                    ? isDark
                                        ? "rgba(139,92,246,0.25)"
                                        : "rgba(124,58,237,0.15)"
                                    : "transparent",
                                "&:hover": {
                                    background: isActive
                                        ? isDark
                                            ? "linear-gradient(135deg, rgba(99,102,241,0.22) 0%, rgba(139,92,246,0.16) 100%)"
                                            : "linear-gradient(135deg, rgba(79,70,229,0.16) 0%, rgba(124,58,237,0.1) 100%)"
                                        : isDark
                                          ? "rgba(255,255,255,0.04)"
                                          : "rgba(0,0,0,0.03)",
                                },
                            }}
                        >
                            <Icon
                                sx={{
                                    fontSize: 14,
                                    color: isActive
                                        ? isDark
                                            ? "#a78bfa"
                                            : "#7c3aed"
                                        : isDark
                                          ? "rgba(255,255,255,0.45)"
                                          : "rgba(0,0,0,0.4)",
                                    transition: "color 0.2s ease",
                                }}
                            />
                            <Typography
                                level="body-xs"
                                sx={{
                                    fontWeight: isActive ? 600 : 500,
                                    fontSize: "0.7rem",
                                    color: isActive
                                        ? isDark
                                            ? "rgba(255,255,255,0.9)"
                                            : "rgba(0,0,0,0.85)"
                                        : isDark
                                          ? "rgba(255,255,255,0.55)"
                                          : "rgba(0,0,0,0.5)",
                                    transition: "all 0.2s ease",
                                }}
                            >
                                {filter.label}
                            </Typography>
                        </Box>
                    );
                })}
            </Stack>
        </Box>
    );
};
