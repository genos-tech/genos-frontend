import CloudOffRoundedIcon from "@mui/icons-material/CloudOffRounded";
import WifiOffRoundedIcon from "@mui/icons-material/WifiOffRounded";
import { Snackbar, Stack, Typography } from "@mui/joy";

import { useTranslation } from "../../i18n";

interface Props {
    showWsDisconnected: boolean;
    showApiDown: boolean;
}

export const ConnectionStatusSnackbar = ({ showWsDisconnected, showApiDown }: Props) => {
    const { t } = useTranslation();
    return (
        <Snackbar
            anchorOrigin={{ vertical: "top", horizontal: "center" }}
            color="danger"
            open={showWsDisconnected || showApiDown}
            sx={{ gap: 1 }}
            variant="soft"
        >
            <Stack spacing={0.5}>
                {showWsDisconnected && (
                    <Typography
                        level="body-sm"
                        sx={{
                            fontWeight: 500,
                            display: "flex",
                            alignItems: "center",
                            gap: 1,
                        }}
                    >
                        <WifiOffRoundedIcon sx={{ fontSize: 16 }} />
                        {t.app.snackbar.wsLost}
                    </Typography>
                )}
                {showApiDown && (
                    <Typography
                        level="body-sm"
                        sx={{
                            fontWeight: 500,
                            display: "flex",
                            alignItems: "center",
                            gap: 1,
                        }}
                    >
                        <CloudOffRoundedIcon sx={{ fontSize: 16 }} />
                        {t.app.snackbar.apiDown}
                    </Typography>
                )}
            </Stack>
        </Snackbar>
    );
};
