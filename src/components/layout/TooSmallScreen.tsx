import ScreenRotationRoundedIcon from "@mui/icons-material/ScreenRotationRounded";
import { Box, Typography } from "@mui/joy";

import { useTranslation } from "../../i18n";

export const TooSmallScreen = () => {
    const { t } = useTranslation();
    return (
        <Box
            sx={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                height: "100dvh",
                width: "100vw",
                textAlign: "center",
                px: 4,
                gap: 2,
                bgcolor: "background.surface",
            }}
        >
            <ScreenRotationRoundedIcon sx={{ fontSize: 56, color: "neutral.400" }} />
            <Typography level="h3">{t.app.tooSmall.title}</Typography>
            <Typography level="body-md" sx={{ color: "neutral.500", maxWidth: 360 }}>
                {t.app.tooSmall.body}
            </Typography>
        </Box>
    );
};
