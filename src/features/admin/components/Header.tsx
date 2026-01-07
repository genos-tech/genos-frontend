import AutoAwesomeRoundedIcon from "@mui/icons-material/AutoAwesomeRounded";
import RocketLaunchRoundedIcon from "@mui/icons-material/RocketLaunchRounded";
import { Box, Typography } from "@mui/joy";
import { useColorScheme } from "@mui/joy/styles";

import { ColorSchemeToggle } from "../../../components/layout/colorSchemeToggle";

// Theme-aware styling
const HEADER_STYLES = {
    dark: {
        logoBg: "linear-gradient(135deg, #6366f1 0%, #8b5cf6 50%, #a855f7 100%)",
        logoShadow: "0 4px 20px rgba(99,102,241,0.4)",
        titleGradient: "linear-gradient(90deg, #818cf8 0%, #a78bfa 50%, #c084fc 100%)",
        subtitleColor: "#94a3b8",
        containerBg: "rgba(15,17,25,0.6)",
        containerBorder: "rgba(99,102,241,0.15)",
        starColor: "#fbbf24",
    },
    light: {
        logoBg: "linear-gradient(135deg, #6366f1 0%, #7c3aed 50%, #9333ea 100%)",
        logoShadow: "0 4px 20px rgba(99,102,241,0.3)",
        titleGradient: "linear-gradient(90deg, #4f46e5 0%, #7c3aed 50%, #9333ea 100%)",
        subtitleColor: "#64748b",
        containerBg: "rgba(255,255,255,0.7)",
        containerBorder: "rgba(99,102,241,0.1)",
        starColor: "#f59e0b",
    },
};

export const AdminHeader = () => {
    const { mode } = useColorScheme();
    const isDark = mode === "dark";
    const styles = isDark ? HEADER_STYLES.dark : HEADER_STYLES.light;

    return (
        <Box
            component="header"
            sx={{
                py: 2.5,
                px: 3,
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                background: styles.containerBg,
                backdropFilter: "blur(12px)",
                borderBottom: `1px solid ${styles.containerBorder}`,
                borderRadius: "0 0 16px 16px",
                mx: -2,
                mt: -0.5,
            }}
        >
            {/* Logo & Brand */}
            <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
                {/* Animated Logo */}
                <Box
                    sx={{
                        width: 44,
                        height: 44,
                        borderRadius: "12px",
                        background: styles.logoBg,
                        boxShadow: styles.logoShadow,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        position: "relative",
                        transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
                        cursor: "pointer",
                        "&:hover": {
                            transform: "scale(1.05) rotate(-3deg)",
                            boxShadow: `${styles.logoShadow}, 0 0 30px rgba(99,102,241,0.3)`,
                        },
                        "&::before": {
                            content: '""',
                            position: "absolute",
                            inset: -2,
                            borderRadius: "14px",
                            background: styles.logoBg,
                            opacity: 0.3,
                            filter: "blur(8px)",
                            zIndex: -1,
                        },
                    }}
                >
                    <RocketLaunchRoundedIcon sx={{ color: "#fff", fontSize: 24 }} />
                </Box>

                {/* Brand Text */}
                <Box>
                    <Box sx={{ display: "flex", alignItems: "center", gap: 0.75 }}>
                        <Typography
                            level="h4"
                            sx={{
                                background: styles.titleGradient,
                                backgroundClip: "text",
                                WebkitBackgroundClip: "text",
                                WebkitTextFillColor: "transparent",
                                fontWeight: 700,
                                letterSpacing: "-0.02em",
                            }}
                        >
                            Origin
                        </Typography>
                        <AutoAwesomeRoundedIcon
                            sx={{
                                color: styles.starColor,
                                fontSize: 16,
                                animation: "twinkle 2s ease-in-out infinite",
                                "@keyframes twinkle": {
                                    "0%, 100%": { opacity: 1, transform: "scale(1)" },
                                    "50%": { opacity: 0.5, transform: "scale(0.85)" },
                                },
                            }}
                        />
                    </Box>
                    <Typography
                        level="body-xs"
                        sx={{
                            color: styles.subtitleColor,
                            fontWeight: 500,
                            letterSpacing: "0.02em",
                        }}
                    >
                        Team Collaboration Platform
                    </Typography>
                </Box>
            </Box>

            {/* Theme Toggle */}
            <Box
                sx={{
                    p: 0.5,
                    borderRadius: "10px",
                    background: isDark ? "rgba(99,102,241,0.1)" : "rgba(99,102,241,0.05)",
                    border: `1px solid ${isDark ? "rgba(99,102,241,0.2)" : "rgba(99,102,241,0.1)"}`,
                    transition: "all 0.2s ease",
                    "&:hover": {
                        background: isDark ? "rgba(99,102,241,0.15)" : "rgba(99,102,241,0.1)",
                        borderColor: isDark ? "rgba(99,102,241,0.3)" : "rgba(99,102,241,0.2)",
                    },
                }}
            >
                <ColorSchemeToggle />
            </Box>
        </Box>
    );
};
