// Whether a calendar write's approval card carries the facts the server adds while its
// `AGENT_PARITY_TOOLS` flag is on (MIP-1059). Its own file because `CalendarEventPreview` exports only
// components, and `approvalRenderers` needs this to decide, per card, between the structured preview
// and the key:value fallback every member sees today.

/** `account_count` is on every such card (it is how the server says "these are the new keys"). */
export const hasCalendarCardFacts = (args: Record<string, unknown>): boolean =>
    typeof args.account_count === "number";
