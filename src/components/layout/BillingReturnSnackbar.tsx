import { useEffect, useState } from "react";
import CheckCircleRoundedIcon from "@mui/icons-material/CheckCircleRounded";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import { Snackbar, Typography } from "@mui/joy";

import { useTranslation } from "../../i18n";

const AUTO_HIDE_MS = 8000;

/**
 * One-shot confirmation after the Stripe checkout redirect.
 *
 * The backend sets `success_url` / `cancel_url` to `/?billing=success`
 * / `/?billing=cancelled`; this reads the param on mount, shows the
 * matching toast, and strips it from the URL so a refresh or a shared
 * link doesn't re-toast. The tier change itself lands via the backend
 * webhook (usually before the user is back here) — the next
 * `/agent/features/` fetch (e.g. opening Settings → Plan & Usage)
 * reflects it; nothing here trusts the redirect.
 */
export const BillingReturnSnackbar = () => {
    const { t } = useTranslation();
    const [kind, setKind] = useState<"success" | "cancelled" | null>(null);

    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const billing = params.get("billing");
        if (billing !== "success" && billing !== "cancelled") return;
        setKind(billing);
        params.delete("billing");
        params.delete("plan");
        const qs = params.toString();
        window.history.replaceState(
            null,
            "",
            window.location.pathname + (qs ? `?${qs}` : "") + window.location.hash
        );
    }, []);

    const p = t.settings.planUsage;
    return (
        <Snackbar
            anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
            autoHideDuration={AUTO_HIDE_MS}
            color={kind === "success" ? "success" : "neutral"}
            open={kind !== null}
            variant="soft"
            onClose={(_event, reason) => {
                if (reason === "clickaway") return;
                setKind(null);
            }}
        >
            <Typography
                level="body-sm"
                startDecorator={
                    kind === "success" ? (
                        <CheckCircleRoundedIcon sx={{ fontSize: 18 }} />
                    ) : (
                        <InfoOutlinedIcon sx={{ fontSize: 18 }} />
                    )
                }
                sx={{ fontWeight: 500 }}
            >
                {kind === "success" ? p.billingReturnSuccess : p.billingReturnCancelled}
            </Typography>
        </Snackbar>
    );
};
