import React from "react";
import { Box, Button, CssBaseline, Typography } from "@mui/joy";
import { CssVarsProvider, useColorScheme } from "@mui/joy/styles";
import HomeRoundedIcon from "@mui/icons-material/HomeRounded";
import SearchOffRoundedIcon from "@mui/icons-material/SearchOffRounded";
import { useNavigate } from "react-router-dom";

const PageNotFoundContent: React.FC = () => {
    const navigate = useNavigate();
    const { mode } = useColorScheme();
    const isDark = mode === "dark";

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
                    ? "linear-gradient(135deg, rgba(12,12,16,1) 0%, rgba(24,24,32,1) 50%, rgba(12,12,16,1) 100%)"
                    : "linear-gradient(135deg, rgba(248,248,252,1) 0%, rgba(240,240,248,1) 50%, rgba(248,248,252,1) 100%)",
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
                        ? "radial-gradient(circle, rgba(99,102,241,0.08) 0%, transparent 70%)"
                        : "radial-gradient(circle, rgba(99,102,241,0.12) 0%, transparent 70%)",
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
                        ? "radial-gradient(circle, rgba(236,72,153,0.08) 0%, transparent 70%)"
                        : "radial-gradient(circle, rgba(236,72,153,0.12) 0%, transparent 70%)",
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
                        ? "linear-gradient(135deg, rgba(99,102,241,0.15) 0%, rgba(99,102,241,0.08) 100%)"
                        : "linear-gradient(135deg, rgba(99,102,241,0.12) 0%, rgba(99,102,241,0.06) 100%)",
                    border: "1px solid",
                    borderColor: isDark ? "rgba(99,102,241,0.25)" : "rgba(99,102,241,0.2)",
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
                        color: isDark ? "#818cf8" : "#6366f1",
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
                        ? "linear-gradient(135deg, #818cf8 0%, #c084fc 50%, #f472b6 100%)"
                        : "linear-gradient(135deg, #6366f1 0%, #a855f7 50%, #ec4899 100%)",
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
                Page Not Found
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
                The page you're looking for doesn't exist or has been moved to a new location.
            </Typography>

            {/* Button */}
            <Button
                onClick={handleBackHome}
                startDecorator={<HomeRoundedIcon />}
                sx={{
                    px: 3,
                    py: 1.25,
                    borderRadius: "12px",
                    fontWeight: 600,
                    fontSize: "0.95rem",
                    background: isDark
                        ? "linear-gradient(135deg, #6366f1 0%, #818cf8 100%)"
                        : "linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)",
                    boxShadow: isDark
                        ? "0 4px 20px rgba(99,102,241,0.3)"
                        : "0 4px 20px rgba(99,102,241,0.25)",
                    border: "none",
                    transition: "all 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
                    "&:hover": {
                        background: isDark
                            ? "linear-gradient(135deg, #818cf8 0%, #a5b4fc 100%)"
                            : "linear-gradient(135deg, #4f46e5 0%, #6366f1 100%)",
                        transform: "translateY(-2px)",
                        boxShadow: isDark
                            ? "0 8px 28px rgba(99,102,241,0.4)"
                            : "0 8px 28px rgba(99,102,241,0.35)",
                    },
                    "&:active": {
                        transform: "translateY(0)",
                    },
                }}
            >
                Back to Home
            </Button>
        </Box>
    );
};

export const PageNotFound: React.FC = () => {
    return (
        <CssVarsProvider disableTransitionOnChange>
            <CssBaseline />
            <PageNotFoundContent />
        </CssVarsProvider>
    );
};
