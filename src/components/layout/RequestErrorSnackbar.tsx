import { useEffect, useState } from "react";
import ErrorOutlineRoundedIcon from "@mui/icons-material/ErrorOutlineRounded";
import { Snackbar, Typography } from "@mui/joy";

import { useTranslation } from "../../i18n";
import { RequestErrorKind, subscribeRequestErrors } from "../../services/requestErrorNotifier";

const AUTO_HIDE_MS = 5000;

/**
 * App-level host for transient request-error toasts (see
 * `requestErrorNotifier`). Subscribes to the bus and renders the latest
 * failure as a danger Snackbar pinned bottom-center — deliberately distinct
 * from the top connection banners (`ConnectionStatusSnackbar`) so a one-off
 * failure reads as "that just failed" rather than "you're offline".
 *
 * A newer error replaces the current one: the bus already de-dups identical
 * kinds within a short window, and failures are infrequent enough that a
 * single slot (no queue) is enough — surfacing the most recent failure is
 * the useful behaviour.
 */
export const RequestErrorSnackbar = () => {
    const { t } = useTranslation();
    const [active, setActive] = useState<RequestErrorKind | null>(null);

    useEffect(() => subscribeRequestErrors((kind) => setActive(kind)), []);

    return (
        <Snackbar
            anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
            autoHideDuration={AUTO_HIDE_MS}
            color="danger"
            open={active !== null}
            variant="soft"
            onClose={(_event, reason) => {
                if (reason === "clickaway") return;
                setActive(null);
            }}
        >
            <Typography
                level="body-sm"
                startDecorator={<ErrorOutlineRoundedIcon sx={{ fontSize: 18 }} />}
                sx={{ fontWeight: 500 }}
            >
                {active ? t.app.snackbar[active] : ""}
            </Typography>
        </Snackbar>
    );
};
