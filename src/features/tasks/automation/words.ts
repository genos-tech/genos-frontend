import { useTranslation } from "../../../i18n";
import type { Messages } from "../../../i18n/types";
import type { RuleTarget } from "./types";

export type AutomationWords = Messages["tasks"]["automation"];

/** The words of a rule that acts on `target`: a milestone rule says "milestone". */
export const wordsFor = (words: AutomationWords, target?: RuleTarget): AutomationWords =>
    target === "milestone"
        ? // The cast: `en` is typed by its literal strings, and these are other strings.
          ({
              ...words,
              ...words.forMilestone,
              reason: { ...words.reason, ...words.forMilestone.reason },
          } as unknown as AutomationWords)
        : words;

export const useAutomationWords = (target?: RuleTarget): AutomationWords =>
    wordsFor(useTranslation().t.tasks.automation, target);

/** Codes that say the same thing as another. */
const ALIASES: Record<string, string> = {
    plan_required: "plan",
    bad_status: "unknown_status",
    assignee_not_allowed: "bad_assignee",
    bad_name: "fallback",
    owner_not_on_destination: "destination_not_found",
};

/** The server's refusal code in plain words (lower case: it finishes another sentence). */
export const reasonText = (words: AutomationWords, code: string): string => {
    const known = words.reason as Record<string, string>;
    const key = ALIASES[code] ?? code;
    return Object.prototype.hasOwnProperty.call(known, key) ? known[key] : known.fallback;
};

/** The same, standing alone. */
export const sentenceCase = (text: string): string =>
    text.charAt(0).toLocaleUpperCase() + text.slice(1);
