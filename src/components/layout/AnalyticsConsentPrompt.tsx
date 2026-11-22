import { Button, Link, Sheet, Stack, Typography } from "@mui/joy";

import { useTranslation } from "../../i18n";
import { chooseConsent, useAnalyticsConsent } from "../../services/marketingConsent";
import { g } from "../../theme/tokens";
import { touchTargetSx } from "../ui/touchTargets";

/**
 * The one-time analytics question in the app (MIP-1781). Counsel (2026-11-21): consent is
 * needed, so analytics is off until "Accept", for everyone, with no location lookup.
 *
 * Shown on the first app load of someone with no stored choice: a new user, an existing user
 * (their old on-by-default setting is not a choice), or a visitor who did not answer on a
 * marketing page. A choice made on a marketing page, or here, is one stored record
 * (`services/consentStorage`), so it is asked once per browser; Settings > Privacy & analytics
 * changes it any time.
 *
 * A region in the page, not a dialog: nothing is covered, nothing takes focus, the workspace
 * stays usable while it is open. "Accept" and "Reject" are the same component with the same
 * variant and size, so neither is the louder choice. The wording was confirmed by Ken on
 * 2026-11-22 (MIP-1800); the privacy page's row on signed-in analytics is not changed here.
 */
export const AnalyticsConsentPrompt = () => {
    const { t } = useTranslation();
    const { needed } = useAnalyticsConsent();
    if (!needed) return null;
    const copy = t.settings.privacy.consent;
    return (
        <Sheet
            aria-label={copy.region}
            // The floating Genos button rises above this box rather than cover its buttons.
            data-fab-avoid="banner"
            role="region"
            variant="outlined"
            sx={{
                position: "fixed",
                insetInlineEnd: { xs: 8, md: 16 },
                insetInlineStart: { xs: 8, md: "auto" },
                bottom: {
                    xs: "calc(var(--BottomTabBar-height, 60px) + 8px)",
                    md: 16,
                },
                // Under the modals (1300) and far under the toasts (13500): it never hides what
                // the person is doing, and a toast is never hidden by it.
                zIndex: 1199,
                maxWidth: { md: 440 },
                p: 2,
                background: g.surface.raised,
                border: `1px solid ${g.border.default}`,
                borderRadius: g.radius.lg,
                boxShadow: g.shadow.md,
                // 44px buttons on a touch screen (MIP-1319).
                ...touchTargetSx("& .MuiButton-root"),
            }}
        >
            <Stack spacing={1.5}>
                <Stack spacing={0.5}>
                    <Typography level="title-sm">{copy.title}</Typography>
                    <Typography level="body-xs">
                        {copy.body}{" "}
                        <Link href="/privacy" rel="noopener noreferrer" target="_blank">
                            {copy.privacy}
                        </Link>
                    </Typography>
                </Stack>
                <Stack direction="row" spacing={1}>
                    <Button
                        color="neutral"
                        size="sm"
                        sx={{ flex: 1 }}
                        variant="outlined"
                        onClick={() => chooseConsent("accepted", "app")}
                    >
                        {copy.accept}
                    </Button>
                    <Button
                        color="neutral"
                        size="sm"
                        sx={{ flex: 1 }}
                        variant="outlined"
                        onClick={() => chooseConsent("rejected", "app")}
                    >
                        {copy.reject}
                    </Button>
                </Stack>
            </Stack>
        </Sheet>
    );
};
