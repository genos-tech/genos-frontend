import CloudOffRoundedIcon from "@mui/icons-material/CloudOffRounded";
import WifiOffRoundedIcon from "@mui/icons-material/WifiOffRounded";
import { Stack, Typography } from "@mui/joy";

import { useTranslation } from "../../i18n";
import type { ApiDownReason } from "../../services/api";
import { Toast } from "../ui/feedback/Toast";

interface Props {
    showWsDisconnected: boolean;
    showApiDown: boolean;
    /** Which flavour of unreachable, from the api.ts interceptor. Absent
     *  when the failure couldn't be placed — then the generic copy runs. */
    apiDownReason?: ApiDownReason;
}

export const ConnectionStatusSnackbar = ({
    showWsDisconnected,
    showApiDown,
    apiDownReason,
}: Props) => {
    const { t } = useTranslation();
    const apiDownMessage = apiDownReason
        ? {
              offline: t.app.snackbar.apiDownOffline,
              timeout: t.app.snackbar.apiDownTimeout,
              unreachable: t.app.snackbar.apiDownUnreachable,
          }[apiDownReason]
        : t.app.snackbar.apiDown;
    return (
        <Toast
            dismissible={false}
            duration={null}
            icon={null}
            open={showWsDisconnected || showApiDown}
            tone="danger"
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
                        {apiDownMessage}
                    </Typography>
                )}
            </Stack>
        </Toast>
    );
};
