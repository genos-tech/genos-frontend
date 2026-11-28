import { useTranslation } from "../../../i18n";

export const useAutomationWords = () => useTranslation().t.tasks.automation;

export type AutomationWords = ReturnType<typeof useAutomationWords>;

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
