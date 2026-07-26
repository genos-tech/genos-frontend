// Monthly AI credit balance — the customer-facing view of the credit
// engine.
//
// RENDERED ONLY when the backend serves a `credits` block, which it does
// exactly when credits are the authoritative limit. That payload-shape
// switch is the same contract the effort picker uses, and it is what
// lets this ship before the server flips: a client that showed a credit
// balance while the server still enforced daily ask counts would be
// telling the user about a limit that isn't limiting them.
//
// Deliberately NOT shown alongside the daily ask rows. Under credits
// those counters still increment (Free's abuse breaker reads one) but
// they no longer describe anything the user is subject to, and two
// limits on screen when only one applies is worse than the old UI.

import { useMemo } from "react";
import BoltRoundedIcon from "@mui/icons-material/BoltRounded";
import { Box, LinearProgress, Stack, Typography } from "@mui/joy";

import { fmt, useTranslation } from "../../../i18n";
import { CreditsBlock } from "../../../services/agentApi";

/**
 * "Resets today / tomorrow / in N days" from the server's ISO instant.
 *
 * The server sends a DATE, not a day count, so a page left open
 * overnight recomputes instead of showing yesterday's answer. Counts
 * whole calendar days remaining rather than 24h blocks — "resets in 1
 * day" the evening before a reset reads correctly, where a duration
 * would say "in 0 days".
 */
const useResetLabel = (periodEndIso: string): string => {
    const { t } = useTranslation();
    return useMemo(() => {
        const end = new Date(periodEndIso);
        if (Number.isNaN(end.getTime())) return "";
        const startOfDay = (d: Date) =>
            Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
        const days = Math.round((startOfDay(end) - startOfDay(new Date())) / 86_400_000);
        if (days <= 0) return t.settings.llmModel.creditsResetsToday;
        if (days === 1) return t.settings.llmModel.creditsResetsTomorrow;
        return fmt(t.settings.llmModel.creditsResetsInDays, { days });
    }, [periodEndIso, t]);
};

/** Two decimals, but no trailing ".00" on a whole number. */
const formatCredits = (value: number): string =>
    Number.isInteger(value) ? String(value) : value.toFixed(2).replace(/0$/, "");

type Props = {
    credits: CreditsBlock;
    /** Hide the upgrade hint (e.g. the Plan & Usage tab already sells). */
    hideUpgradeNote?: boolean;
    tier?: string;
};

export const CreditBalance = ({ credits, hideUpgradeNote, tier }: Props) => {
    const { t } = useTranslation();
    const resetLabel = useResetLabel(credits.period_end_iso);

    if (credits.unlimited || credits.limit === null || credits.balance === null) {
        return (
            <Stack spacing={0.5}>
                <Typography level="body-sm" sx={{ fontWeight: 600 }}>
                    {t.settings.llmModel.creditsUnlimited}
                </Typography>
            </Stack>
        );
    }

    const balance = Math.max(credits.balance, 0);
    const used = Math.max(credits.limit - balance, 0);
    // The bar fills with what has been USED, so a fresh month reads
    // empty and fills as you spend. Matches the task/note quota bars in
    // `PlanUsageSection` — same direction, same `used / limit` ratio,
    // same at-cap colour — because two meters in one Settings modal
    // filling in opposite directions is a misreading waiting to happen.
    const pctUsed = credits.limit > 0 ? Math.min((used / credits.limit) * 100, 100) : 0;
    // Two states, not one, mirroring what the server actually does.
    // `empty` is the only one that refuses a request; `low` means the
    // balance can no longer cover a request's quoted maximum, so a long
    // one may be stopped partway. Warning at a PERCENTAGE would be
    // silent through every stop on a 10-credit plan.
    const empty = balance <= 0;
    const low = !empty && balance < credits.per_request_max;

    return (
        <Stack spacing={1}>
            <Stack
                alignItems="baseline"
                direction="row"
                justifyContent="space-between"
                spacing={1}
            >
                <Typography level="body-sm" sx={{ fontWeight: 600 }}>
                    {fmt(t.settings.llmModel.creditsRemaining, {
                        balance: formatCredits(balance),
                        limit: formatCredits(credits.limit),
                    })}
                </Typography>
                <Typography level="body-xs" sx={{ color: "text.tertiary" }}>
                    {resetLabel}
                </Typography>
            </Stack>

            <LinearProgress
                determinate
                color={empty ? "warning" : "primary"}
                size="sm"
                sx={{ "--LinearProgress-radius": "6px" }}
                value={pctUsed}
            />

            {(empty || low) && (
                <Typography level="body-xs" sx={{ color: "warning.plainColor" }}>
                    {fmt(
                        empty
                            ? t.settings.llmModel.creditsEmptyWarning
                            : t.settings.llmModel.creditsLowWarning,
                        { when: resetLabel.toLowerCase() }
                    )}
                </Typography>
            )}

            {!hideUpgradeNote && tier === "free" && (
                <Typography level="body-xs" sx={{ color: "text.tertiary" }}>
                    {t.settings.llmModel.creditsUpgradeNote}
                </Typography>
            )}
        </Stack>
    );
};

/**
 * The credit block as a full titled section, for the model picker where
 * it replaces the "Today's usage" list.
 */
export const CreditUsageSection = ({ credits, tier }: Props) => {
    const { t } = useTranslation();
    return (
        <Box>
            <Stack alignItems="center" direction="row" spacing={1} sx={{ mb: 0.5 }}>
                <BoltRoundedIcon sx={{ fontSize: 18 }} />
                <Typography level="title-sm">{t.settings.llmModel.creditsHeading}</Typography>
            </Stack>
            <Typography level="body-xs" sx={{ mb: 1.5 }}>
                {t.settings.llmModel.creditsDescription}
            </Typography>
            <CreditBalance credits={credits} tier={tier} />
        </Box>
    );
};
