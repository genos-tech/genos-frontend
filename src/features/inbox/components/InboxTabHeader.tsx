import NotificationsActiveRoundedIcon from "@mui/icons-material/NotificationsActiveRounded";
import PendingActionsRoundedIcon from "@mui/icons-material/PendingActionsRounded";
import { Box, Chip, Typography } from "@mui/joy";
import { useColorScheme } from "@mui/joy/styles";

type InboxTab = "activities" | "requests";

type InboxTabHeaderProps = {
    activeTab: InboxTab;
    onTabChange: (tab: InboxTab) => void;
    requestCount?: number;
};

export const InboxTabHeader = ({ activeTab, onTabChange, requestCount }: InboxTabHeaderProps) => {
    const { mode } = useColorScheme();
    const isDark = mode === "dark";

    const tabs: { id: InboxTab; label: string; icon: React.ReactNode; count?: number }[] = [
        {
            id: "activities",
            label: "Activities",
            icon: <NotificationsActiveRoundedIcon sx={{ fontSize: 16 }} />,
        },
        {
            id: "requests",
            label: "Requests",
            icon: <PendingActionsRoundedIcon sx={{ fontSize: 16 }} />,
            count: requestCount,
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
                background: isDark ? "rgba(20,20,25,0.6)" : "rgba(250,250,252,0.8)",
            }}
        >
            {tabs.map((tab) => {
                const isActive = activeTab === tab.id;
                return (
                    <Box
                        key={tab.id}
                        onClick={() => onTabChange(tab.id)}
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
                                    ? "linear-gradient(135deg, rgba(99,102,241,0.18) 0%, rgba(139,92,246,0.12) 100%)"
                                    : "linear-gradient(135deg, rgba(79,70,229,0.12) 0%, rgba(124,58,237,0.06) 100%)"
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
                                        ? "linear-gradient(135deg, rgba(99,102,241,0.22) 0%, rgba(139,92,246,0.16) 100%)"
                                        : "linear-gradient(135deg, rgba(79,70,229,0.16) 0%, rgba(124,58,237,0.1) 100%)"
                                    : isDark
                                      ? "rgba(255,255,255,0.04)"
                                      : "rgba(0,0,0,0.03)",
                            },
                        }}
                    >
                        <Box
                            sx={{
                                color: isActive
                                    ? isDark
                                        ? "#a78bfa"
                                        : "#7c3aed"
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
                                    px: 0.75,
                                    background: isDark
                                        ? "linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)"
                                        : "linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)",
                                    border: "none",
                                    boxShadow: isDark
                                        ? "0 2px 8px rgba(99,102,241,0.35)"
                                        : "0 2px 8px rgba(79,70,229,0.3)",
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
