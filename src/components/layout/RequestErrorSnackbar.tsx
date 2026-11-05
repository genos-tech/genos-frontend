import { useEffect, useState } from "react";
import ErrorOutlineRoundedIcon from "@mui/icons-material/ErrorOutlineRounded";
import { Snackbar, Typography } from "@mui/joy";

import { useTranslation } from "../../i18n";
import {
    RequestErrorKind,
    subscribeRequestErrors,
    TranslatedRequestErrorKind,
} from "../../services/requestErrorNotifier";

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
 * the useful behaviour. That is also why a refused task save shows its
 * reason rather than the generic "couldn't complete" line the response
 * interceptor raised a moment earlier for the same 400: the reason arrives
 * second and takes the slot.
 *
 * A `serverMessage` event carries the server's own sentence, shown as-is
 * (in English, whatever the UI language: it names the exact field and id).
 * Every other kind maps to its translated `t.app.snackbar.*` line.
 */
export const RequestErrorSnackbar = () => {
    const { t } = useTranslation();
    const [active, setActive] = useState<{ kind: RequestErrorKind; text?: string } | null>(null);

    useEffect(() => subscribeRequestErrors((kind, text) => setActive({ kind, text })), []);

    const message = !active
        ? ""
        : active.kind === "serverMessage"
          ? (active.text ?? "")
          : t.app.snackbar[active.kind as TranslatedRequestErrorKind];

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
                {message}
            </Typography>
        </Snackbar>
    );
};
