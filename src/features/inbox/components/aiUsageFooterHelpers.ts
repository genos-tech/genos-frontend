import { fmt } from "../../../i18n";
import type { Messages } from "../../../i18n/types";
import { formatCredits } from "../../../utils/formatCredits";
import { type AiCost } from "../utils/inboxAi";

/** The cost line: what it used, and (when it is known) what was taken from the balance. */
export const costText = (
    cost: AiCost | null,
    c: Copy,
    noCredits = false,
    monthlyLimit = false
): string => {
    // A digest or report that used no AI says so, plainly: no figure, no balance line. A report
    // that skipped its AI part because the credits were used up says that instead (MIP-1960).
    if (cost === null) {
        if (monthlyLimit) return c.noAiMonthlyLimit;
        return noCredits ? c.noAiNoCredits : c.noAiUsed;
    }
    if (!cost.metered) return c.unmeasured;
    // Under a hundredth of a credit a figure would print as "0", which is not true of a cost.
    // With unpriced calls the true cost may be more, so "less than 0.01" would be wrong too.
    if (cost.creditsMilli < 5 && cost.lowerBound) return c.unmeasured;
    const used =
        cost.creditsMilli < 5
            ? c.usedTiny
            : fmt(cost.lowerBound ? c.usedAtLeast : c.used, {
                  credits: credits(cost.creditsMilli),
              });
    const deducted =
        cost.deductedMilli === 0
            ? c.deductedNone
            : fmt(c.deducted, {
                  credits: formatCredits(Math.max(Math.round(cost.deductedMilli / 10), 1) / 100),
              });
    return `${used} · ${deducted}`;
};

export type Copy = Messages["inbox"]["aiUsage"];

/** Hundredths of a credit, so a figure reads exactly as it would in Settings ("1.83", "2"). */
export const credits = (milli: number): string => formatCredits(Math.round(milli / 10) / 100);
