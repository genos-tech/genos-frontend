import { Card, Stack, Typography } from "@mui/joy";
import type { SxProps } from "@mui/joy/styles/types";

import { fmt, useTranslation } from "../../i18n";

/**
 * "Your free month of Core ends on <date>" (MIP-1737). Shown wherever the plan is named while the
 * first-month trial is what gives the account its plan, i.e. while `/agent/features/` carries a
 * `trial_ends_at`. The server decides that, so this never works out a date or a plan itself; it
 * only formats the end it was handed, in the person's locale.
 *
 * `card`: the plans page, where it sits above the cards as a soft panel. Otherwise a short inline
 * line for the Settings tab, under the plan chip.
 */
export const TrialEndNote = ({
    endsAt,
    locale,
    card = false,
    sx,
}: {
    endsAt: string;
    locale: string;
    card?: boolean;
    sx?: SxProps;
}) => {
    const { t } = useTranslation();
    const p = t.settings.planUsage;
    const date = new Date(endsAt);
    // An unreadable value says nothing rather than "Invalid Date".
    if (Number.isNaN(date.getTime())) return null;
    const dateLabel = date.toLocaleDateString(locale, {
        year: "numeric",
        month: "long",
        day: "numeric",
    });
    const body = (
        <Stack spacing={0.25} sx={{ minWidth: 0 }}>
            <Typography level="body-sm" sx={{ fontWeight: 600, overflowWrap: "anywhere" }}>
                {fmt(p.trialEnds, { date: dateLabel })}
            </Typography>
            <Typography level="body-xs" sx={{ color: "text.tertiary" }}>
                {p.trialAfter}
            </Typography>
        </Stack>
    );
    if (!card) {
        return (
            <Stack data-testid="trial-end-note" sx={sx}>
                {body}
            </Stack>
        );
    }
    return (
        <Card color="success" data-testid="trial-end-note" sx={sx} variant="soft">
            {body}
        </Card>
    );
};
