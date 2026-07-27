import AllInboxRoundedIcon from "@mui/icons-material/AllInboxRounded";
import { Box, Typography } from "@mui/joy";
import { useColorScheme } from "@mui/joy/styles";

import { useTranslation } from "../../../i18n";
import { purplePalette } from "../../../theme/purplePalette";

export const InboxHeader = () => {
    const { mode } = useColorScheme();
    const { t } = useTranslation();
    const isDark = mode === "dark";
    const palette = isDark ? purplePalette.dark : purplePalette.light;

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
                    ? "linear-gradient(135deg, rgba(var(--gp-dark-surface-a-rgb), 0.95) 0%, rgba(22,16,36,0.98) 100%)"
                    : "linear-gradient(135deg, rgba(255,255,255,0.98) 0%, rgba(250,248,255,1) 100%)",
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
                    background: palette.titleGradient,
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
                        ? "linear-gradient(135deg, rgba(var(--gp-brand-700-rgb), 0.2) 0%, rgba(var(--gp-brandalt-500-rgb), 0.15) 100%)"
                        : "linear-gradient(135deg, rgba(var(--gp-brand-700-rgb), 0.12) 0%, rgba(var(--gp-brand-700-rgb), 0.08) 100%)",
                    mr: 1.5,
                }}
            >
                <AllInboxRoundedIcon
                    sx={{
                        fontSize: 20,
                        color: palette.accentSoft,
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
                            : "linear-gradient(135deg, var(--gp-brandalt-950) 0%, var(--gp-brandalt-900) 100%)",
                        WebkitBackgroundClip: "text",
                        WebkitTextFillColor: "transparent",
                        backgroundClip: "text",
                    }}
                >
                    {t.inbox.header.title}
                </Typography>
                <Typography
                    level="body-xs"
                    sx={{
                        color: isDark ? "rgba(255,255,255,0.45)" : "rgba(0,0,0,0.45)",
                        fontSize: "0.7rem",
                        mt: -0.3,
                    }}
                >
                    {t.inbox.header.subtitle}
                </Typography>
            </Box>
        </Box>
    );
};
