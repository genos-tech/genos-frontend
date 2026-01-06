import AllInboxRoundedIcon from "@mui/icons-material/AllInboxRounded";
import { Box, Typography } from "@mui/joy";
import { useColorScheme } from "@mui/joy/styles";

export const InboxHeader = () => {
    const { mode } = useColorScheme();
    const isDark = mode === "dark";

    return (
        <Box
            sx={{
                height: "64px",
                display: "flex",
                alignItems: "center",
                px: 3,
                borderBottom: "1px solid",
                borderColor: isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)",
                background: isDark
                    ? "linear-gradient(135deg, rgba(30,30,35,0.95) 0%, rgba(25,25,30,0.98) 100%)"
                    : "linear-gradient(135deg, rgba(255,255,255,0.98) 0%, rgba(250,250,252,1) 100%)",
                backdropFilter: "blur(12px)",
                position: "relative",
                overflow: "hidden",
            }}
        >
            {/* Subtle gradient accent line at top */}
            <Box
                sx={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    right: 0,
                    height: "2px",
                    background: isDark
                        ? "linear-gradient(90deg, #6366f1 0%, #8b5cf6 50%, #a855f7 100%)"
                        : "linear-gradient(90deg, #4f46e5 0%, #7c3aed 50%, #9333ea 100%)",
                    opacity: 0.8,
                }}
            />

            {/* Icon with background */}
            <Box
                sx={{
                    width: 36,
                    height: 36,
                    borderRadius: "10px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    background: isDark
                        ? "linear-gradient(135deg, rgba(99,102,241,0.2) 0%, rgba(139,92,246,0.15) 100%)"
                        : "linear-gradient(135deg, rgba(79,70,229,0.12) 0%, rgba(124,58,237,0.08) 100%)",
                    mr: 1.5,
                }}
            >
                <AllInboxRoundedIcon
                    sx={{
                        fontSize: 20,
                        color: isDark ? "#a78bfa" : "#7c3aed",
                    }}
                />
            </Box>

            <Box>
                <Typography
                    level="h4"
                    sx={{
                        fontWeight: 700,
                        fontSize: "1.1rem",
                        letterSpacing: "-0.01em",
                        background: isDark
                            ? "linear-gradient(135deg, #fff 0%, rgba(255,255,255,0.85) 100%)"
                            : "linear-gradient(135deg, #1e1b4b 0%, #312e81 100%)",
                        WebkitBackgroundClip: "text",
                        WebkitTextFillColor: "transparent",
                        backgroundClip: "text",
                    }}
                >
                    Inbox
                </Typography>
                <Typography
                    level="body-xs"
                    sx={{
                        color: isDark ? "rgba(255,255,255,0.45)" : "rgba(0,0,0,0.45)",
                        fontSize: "0.7rem",
                        mt: -0.3,
                    }}
                >
                    Stay on top of notifications
                </Typography>
            </Box>
        </Box>
    );
};
