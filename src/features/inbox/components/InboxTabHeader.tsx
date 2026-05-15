import NotificationsActiveRoundedIcon from "@mui/icons-material/NotificationsActiveRounded";
import PendingActionsRoundedIcon from "@mui/icons-material/PendingActionsRounded";
import { Box, Chip, Typography } from "@mui/joy";
import { useColorScheme } from "@mui/joy/styles";
import { useLocation, useNavigate } from "react-router-dom";

import { purplePalette } from "../../../theme/purplePalette";

type InboxTab = "requests" | "activities";

type InboxTabHeaderProps = {
    requestCount?: number;
};

export const InboxTabHeader = ({ requestCount }: InboxTabHeaderProps) => {
    const { mode } = useColorScheme();
    const isDark = mode === "dark";
    const palette = isDark ? purplePalette.dark : purplePalette.light;
    const navigate = useNavigate();
    const location = useLocation();

    // Determine active tab from URL
    const activeTab: InboxTab = location.pathname.includes("/activities")
        ? "activities"
        : "requests";

    const tabs: {
        id: InboxTab;
        label: string;
        path: string;
        icon: React.ReactNode;
        count?: number;
    }[] = [
        {
            id: "requests",
            label: "Requests",
            path: "/workspace/inbox/requests",
            icon: <PendingActionsRoundedIcon sx={{ fontSize: 16 }} />,
            count: requestCount,
        },
        {
            id: "activities",
            label: "Activities",
            path: "/workspace/inbox/activities",
            icon: <NotificationsActiveRoundedIcon sx={{ fontSize: 16 }} />,
        },
    ];

    return (
        <Box
            sx={{
                display: "flex",
                gap: 0.5,
                px: 3,
                py: 1.5,
                borderBottom: "1px solid",
                borderColor: isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)",
                background: isDark ? "rgba(20,14,34,0.6)" : "rgba(250,248,255,0.8)",
            }}
        >
            {tabs.map((tab) => {
                const isActive = activeTab === tab.id;
                return (
                    <Box
                        key={tab.id}
                        onClick={() => navigate(tab.path)}
                        sx={{
                            display: "flex",
                            alignItems: "center",
                            gap: 0.75,
                            px: 2,
                            py: 0.875,
                            borderRadius: "10px",
                            cursor: "pointer",
                            transition: "all 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
                            background: isActive
                                ? isDark
                                    ? "linear-gradient(135deg, rgba(124,58,237,0.18) 0%, rgba(139,92,246,0.12) 100%)"
                                    : "linear-gradient(135deg, rgba(124,58,237,0.12) 0%, rgba(124,58,237,0.06) 100%)"
                                : "transparent",
                            border: "1px solid",
                            borderColor: isActive
                                ? isDark
                                    ? "rgba(139,92,246,0.3)"
                                    : "rgba(124,58,237,0.2)"
                                : "transparent",
                            "&:hover": {
                                background: isActive
                                    ? isDark
                                        ? "linear-gradient(135deg, rgba(124,58,237,0.22) 0%, rgba(139,92,246,0.16) 100%)"
                                        : "linear-gradient(135deg, rgba(124,58,237,0.16) 0%, rgba(124,58,237,0.1) 100%)"
                                    : isDark
                                      ? "rgba(255,255,255,0.04)"
                                      : "rgba(0,0,0,0.03)",
                            },
                        }}
                    >
                        <Box
                            sx={{
                                color: isActive
                                    ? palette.accentSoft
                                    : isDark
                                      ? "rgba(255,255,255,0.5)"
                                      : "rgba(0,0,0,0.45)",
                                display: "flex",
                                alignItems: "center",
                                transition: "color 0.2s ease",
                            }}
                        >
                            {tab.icon}
                        </Box>
                        <Typography
                            level="body-sm"
                            sx={{
                                fontWeight: isActive ? 600 : 500,
                                color: isActive
                                    ? isDark
                                        ? "rgba(255,255,255,0.95)"
                                        : "rgba(0,0,0,0.85)"
                                    : isDark
                                      ? "rgba(255,255,255,0.6)"
                                      : "rgba(0,0,0,0.55)",
                                fontSize: "0.8rem",
                                transition: "all 0.2s ease",
                            }}
                        >
                            {tab.label}
                        </Typography>
                        {tab.count && tab.count > 0 && (
                            <Chip
                                size="sm"
                                variant="solid"
                                sx={{
                                    minWidth: 20,
                                    height: 20,
                                    fontSize: "0.65rem",
                                    fontWeight: 700,
                                    px: 0.85,
                                    pt: 0.15,
                                    background: palette.primaryButtonBg,
                                    border: "none",
                                    boxShadow: palette.shadowSoft,
                                    animation: "pulse 2s infinite",
                                    "@keyframes pulse": {
                                        "0%, 100%": { opacity: 1 },
                                        "50%": { opacity: 0.85 },
                                    },
                                }}
                            >
                                {tab.count > 99 ? "99+" : tab.count}
                            </Chip>
                        )}
                    </Box>
                );
            })}
        </Box>
    );
};

export type { InboxTab };
