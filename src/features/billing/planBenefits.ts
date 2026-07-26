// The checkmark rows on a plan card.
//
// ONE implementation, shared by the in-app plans page and the marketing
// page. Both previously carried their own copy, under a comment saying
// they were written alike "so the two pages can never disagree" — which
// is a property only a shared function actually provides. They had
// already drifted apart in whitespace; they would have drifted in
// substance the first time one of them was updated alone, and the
// visible symptom is a marketing page selling limits the product no
// longer has.
//
// Fed by the ENFORCEMENT TABLE from `GET /billing/plans/`, so a row can
// never advertise a limit the quota engine does not apply.

import { fmt } from "../../i18n";
import type { Messages } from "../../i18n/types";
import type { PlanTier } from "../../services/billingApi";

type PlanStrings = Messages["settings"]["planUsage"];

/**
 * Selling order: history first (the classic upgrade trigger), then AI
 * volume, premium models, and the rest.
 *
 * **The AI rows come in two eras.** `monthly_ai_credits` is served only
 * when the server enforces credits, so its presence switches between
 * them — the same payload-shape convention the model picker uses, and
 * for the same reason: either side can deploy first and the page still
 * describes what is actually enforced.
 *
 * Under credits the daily ask and web-search caps still exist as
 * numbers, but they bind nobody. Rendering them would be selling a
 * limit that is not one.
 */
export const planBenefitRows = (tier: PlanTier, p: PlanStrings, locale: string): string[] => {
    const L = tier.limits;
    const n = (v: number) => v.toLocaleString(locale);
    const creditsEra = L.monthly_ai_credits !== undefined;

    const rows = [
        L.message_retention_days == null
            ? p.benefitHistoryUnlimited
            : fmt(p.benefitHistoryDays, { days: String(L.message_retention_days) }),
        creditsEra
            ? L.monthly_ai_credits == null
                ? p.benefitAiCreditsUnlimited
                : fmt(p.benefitAiCredits, { n: n(L.monthly_ai_credits) })
            : L.llm_ask_daily == null
              ? p.benefitAiAsksUnlimited
              : fmt(p.benefitAiAsks, { n: n(L.llm_ask_daily) }),
    ];

    // "40 AI credits" raises the question "how far does that go?", and
    // the answer is the whole reason credits exist — so it sits right
    // under the figure rather than in a footnote nobody reads.
    if (creditsEra) rows.push(p.benefitCreditsExplainer);

    // Free blocks opus-class models entirely; every paid tier includes
    // them (with per-model daily caps).
    if (tier.tier !== "free") rows.push(p.benefitPremiumModels);

    rows.push(
        // Under credits, web search has no separate allowance — it is
        // priced into the request like any other cost. It is a
        // capability, not a quota, and quoting a per-day number for it
        // would be fiction.
        creditsEra
            ? p.benefitWebSearchIncluded
            : L.web_search_daily == null
              ? p.benefitWebSearchesUnlimited
              : fmt(p.benefitWebSearches, { n: n(L.web_search_daily) }),
        L.task_create_monthly == null
            ? p.benefitTasksUnlimited
            : fmt(p.benefitTasks, { n: n(L.task_create_monthly) }),
        L.note_create_monthly == null
            ? p.benefitNotesUnlimited
            : fmt(p.benefitNotes, { n: n(L.note_create_monthly) })
    );

    if (L.upload_max_mb != null) {
        rows.push(fmt(p.benefitUpload, { mb: String(L.upload_max_mb) }));
    }
    return rows;
};
