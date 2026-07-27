import React from "react";
import HomeRoundedIcon from "@mui/icons-material/HomeRounded";
import SearchOffRoundedIcon from "@mui/icons-material/SearchOffRounded";
import { Box, Button, CssBaseline, Typography } from "@mui/joy";
import { useColorScheme } from "@mui/joy/styles";
import { useNavigate } from "react-router-dom";

import { I18nProvider, useTranslation } from "../../i18n";
import { ColorThemeProvider } from "../../theme/ColorThemeProvider";
import { purplePalette } from "../../theme/purplePalette";

const PageNotFoundContent: React.FC = () => {
    const navigate = useNavigate();
    const { mode } = useColorScheme();
    const { t } = useTranslation();
    const isDark = mode === "dark";
    const palette = isDark ? purplePalette.dark : purplePalette.light;

    const handleBackHome = (): void => {
        navigate("/");
    };

    return (
        <Box
            sx={{
                display: "flex",
                flexDirection: "column",
                justifyContent: "center",
                alignItems: "center",
                height: "100dvh",
                width: "100vw",
                textAlign: "center",
                background: isDark
                    ? "linear-gradient(135deg, rgba(11,10,22,1) 0%, rgba(22,16,40,1) 50%, rgba(11,10,22,1) 100%)"
                    : "linear-gradient(135deg, rgba(250,249,255,1) 0%, rgba(240,235,255,1) 50%, rgba(250,249,255,1) 100%)",
                position: "relative",
                overflow: "hidden",
            }}
        >
            {/* Decorative background elements */}
            <Box
                sx={{
                    position: "absolute",
                    top: "15%",
                    left: "10%",
                    width: 300,
                    height: 300,
                    borderRadius: "50%",
                    background: isDark
                        ? "radial-gradient(circle, rgba(var(--gp-brand-700-rgb), 0.10) 0%, transparent 70%)"
                        : "radial-gradient(circle, rgba(var(--gp-brand-700-rgb), 0.14) 0%, transparent 70%)",
                    filter: "blur(40px)",
                    pointerEvents: "none",
                }}
            />
            <Box
                sx={{
                    position: "absolute",
                    bottom: "20%",
                    right: "15%",
                    width: 250,
                    height: 250,
                    borderRadius: "50%",
                    background: isDark
                        ? "radial-gradient(circle, rgba(var(--gp-tint-danger-alt-rgb), 0.08) 0%, transparent 70%)"
                        : "radial-gradient(circle, rgba(var(--gp-tint-danger-alt-rgb), 0.12) 0%, transparent 70%)",
                    filter: "blur(40px)",
                    pointerEvents: "none",
                }}
            />

            {/* Icon */}
            <Box
                sx={{
                    width: 80,
                    height: 80,
                    borderRadius: "24px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    background: isDark
                        ? "linear-gradient(135deg, rgba(var(--gp-brand-700-rgb), 0.18) 0%, rgba(var(--gp-brand-700-rgb), 0.08) 100%)"
                        : "linear-gradient(135deg, rgba(var(--gp-brand-700-rgb), 0.14) 0%, rgba(var(--gp-brand-700-rgb), 0.06) 100%)",
                    border: "1px solid",
                    borderColor: palette.borderStrong,
                    mb: 3,
                    animation: "float 3s ease-in-out infinite",
                    "@keyframes float": {
                        "0%, 100%": { transform: "translateY(0px)" },
                        "50%": { transform: "translateY(-8px)" },
                    },
                }}
            >
                <SearchOffRoundedIcon
                    sx={{
                        fontSize: 40,
                        color: palette.accentSoft,
                    }}
                />
            </Box>

            {/* 404 Text */}
            <Typography
                level="h1"
                sx={{
                    fontSize: { xs: "6rem", md: "8rem" },
                    fontWeight: 800,
                    background: isDark
                        ? "linear-gradient(135deg, var(--gp-brandalt-400) 0%, var(--gp-brand-400) 50%, var(--gp-tint-danger) 100%)"
                        : "linear-gradient(135deg, var(--gp-brand-700) 0%, var(--gp-brand-500) 50%, var(--gp-tint-danger-alt) 100%)",
                    backgroundClip: "text",
                    WebkitBackgroundClip: "text",
                    WebkitTextFillColor: "transparent",
                    letterSpacing: "-0.02em",
                    lineHeight: 1,
                    mb: 1,
                }}
            >
                404
            </Typography>

            {/* Title */}
            <Typography
                level="h3"
                sx={{
                    fontWeight: 600,
                    color: isDark ? "rgba(255,255,255,0.9)" : "rgba(0,0,0,0.85)",
                    mb: 1.5,
                }}
            >
                {t.layout.pageNotFound.title}
            </Typography>

            {/* Subtitle */}
            <Typography
                level="body-md"
                sx={{
                    color: isDark ? "rgba(255,255,255,0.5)" : "rgba(0,0,0,0.5)",
                    maxWidth: 360,
                    px: 2,
                    mb: 4,
                }}
            >
                {t.layout.pageNotFound.body}
            </Typography>

            {/* Button */}
            <Button
                startDecorator={<HomeRoundedIcon />}
                sx={{
                    px: 3,
                    py: 1.25,
                    borderRadius: "12px",
                    fontWeight: 600,
                    fontSize: "0.95rem",
                    background: palette.primaryButtonBg,
                    boxShadow: palette.shadowSoft,
                    border: "none",
                    transition: "all 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
                    "&:hover": {
                        background: palette.primaryButtonHover,
                        transform: "translateY(-2px)",
                        boxShadow: isDark
                            ? "0 8px 28px rgba(var(--gp-brand-700-rgb), 0.45)"
                            : "0 8px 28px rgba(var(--gp-brand-700-rgb), 0.35)",
                    },
                    "&:active": {
                        transform: "translateY(0)",
                    },
                }}
                onClick={handleBackHome}
            >
                {t.layout.pageNotFound.backHome}
            </Button>
        </Box>
    );
};

export const PageNotFound: React.FC = () => {
    return (
        <ColorThemeProvider>
            <CssBaseline />
            <I18nProvider>
                <PageNotFoundContent />
            </I18nProvider>
        </ColorThemeProvider>
    );
};
