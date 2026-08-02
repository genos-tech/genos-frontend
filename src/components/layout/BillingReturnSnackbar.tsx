import { useEffect, useState } from "react";
import CheckCircleRoundedIcon from "@mui/icons-material/CheckCircleRounded";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import { Snackbar, Typography } from "@mui/joy";

import { useAuth } from "../../context/AuthContext";
import { useTranslation } from "../../i18n";
import { refreshBillingTier } from "../../services/billingApi";

const AUTO_HIDE_MS = 8000;

/**
 * One-shot handling of the Stripe return redirects.
 *
 * The backend sends the browser back to `/?billing=success` /
 * `/?billing=cancelled` (checkout) and `/?billing=portal_return`
 * (customer portal). This reads the param, shows the matching toast
 * for checkout outcomes (the portal return stays silent — it may have
 * been a plan change or just invoice browsing), and strips it from the
 * URL so a refresh or a shared link doesn't re-handle it.
 *
 * For `success` and `portal_return` it also fires
 * `refreshBillingTier`: both flows change subscription state, and the
 * webhook that normally projects it into the tier CAN be lost (locally
 * `stripe listen` may be down; in prod the handler may have crashed)
 * or simply not have landed yet. The pull makes the return itself
 * self-healing; nothing here trusts the redirect params for the tier.
 */
/** Fired once the post-checkout reconcile has completed, so pages
 *  showing billing-derived data can refetch rather than race it. */
export const BILLING_REFRESHED = "genos:billing-refreshed";

export const BillingReturnSnackbar = () => {
    const { t } = useTranslation();
    const { accessToken } = useAuth();
    const [kind, setKind] = useState<"success" | "cancelled" | null>(null);

    useEffect(() => {
        // Wait for the auth bootstrap — the token arrives async after
        // mount and the reconcile call needs it. The param stays in the
        // URL until then, so the re-run on token arrival still sees it;
        // once handled, the param is gone and later runs no-op.
        if (!accessToken) return;
        const params = new URLSearchParams(window.location.search);
        const billing = params.get("billing");
        if (billing !== "success" && billing !== "cancelled" && billing !== "portal_return") {
            return;
        }
        if (billing !== "portal_return") setKind(billing);
        if (billing !== "cancelled") {
            // Tell the page when the reconcile has actually FINISHED.
            // Without this there is a race nobody can see coming: the
            // return is a full page load, so a plans page mounts and
            // fetches its balance while this call is still in flight —
            // and the balance it gets is the one from before the
            // purchase landed. The buyer sees their old number and
            // concludes nothing happened.
            //
            // A window event rather than shared state because the two
            // components are unrelated and live in different trees;
            // `openTodoPane` in App.tsx sets the precedent.
            void refreshBillingTier(accessToken).finally(() => {
                window.dispatchEvent(new CustomEvent(BILLING_REFRESHED));
            });
        }
        params.delete("billing");
        params.delete("plan");
        const qs = params.toString();
        window.history.replaceState(
            null,
            "",
            window.location.pathname + (qs ? `?${qs}` : "") + window.location.hash
        );
    }, [accessToken]);

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
