import AutoAwesomeRoundedIcon from "@mui/icons-material/AutoAwesomeRounded";
import { Box, Typography } from "@mui/joy";
import { useColorScheme } from "@mui/joy/styles";

import genosLogo from "../../../assets/genos_tech.png";
import { ColorSchemeToggle } from "../../../components/layout/colorSchemeToggle";
import { HeaderStyles } from "../../../components/ui/styles/commonStyle";

export const AdminHeader = () => {
    const { mode } = useColorScheme();
    const isDark = mode === "dark";
    const styles = isDark ? HeaderStyles.dark : HeaderStyles.light;

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
                            boxShadow: `${styles.logoShadow}, 0 0 30px rgba(124,58,237,0.3)`,
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
                    <img
                        src={genosLogo}
                        alt="Genos Logo"
                        style={{
                            width: 38,
                            height: 38,
                            objectFit: "contain",
                            borderRadius: "50%",
                        }}
                    />
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
                            Genos
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
                    background: isDark ? "rgba(124,58,237,0.1)" : "rgba(124,58,237,0.05)",
                    border: `1px solid ${isDark ? "rgba(124,58,237,0.2)" : "rgba(124,58,237,0.1)"}`,
                    transition: "all 0.2s ease",
                    "&:hover": {
                        background: isDark ? "rgba(124,58,237,0.15)" : "rgba(124,58,237,0.1)",
                        borderColor: isDark ? "rgba(124,58,237,0.3)" : "rgba(124,58,237,0.2)",
                    },
                }}
            >
                <ColorSchemeToggle />
            </Box>
        </Box>
    );
};
