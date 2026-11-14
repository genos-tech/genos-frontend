import type { CalendarSummary } from "../../integrations/services/calendar";

/**
 * The calendar id the calendar grid knows a source by.
 *
 * The agent's tools (and so a chip and the ref of an approved write) name an account's own calendar as
 * `"primary"`, Google's alias. The grid keys its sources by the ids `/calendar/list/` returns, and for
 * the primary calendar that is the account's address, with `primary: true`: `account:primary` matches
 * no source there. This maps the alias to the real id (and leaves any other id as it is, and the alias
 * as it is when the list is not loaded or has no such calendar).
 */
export const resolveCalendarId = (
    calendars: readonly Pick<CalendarSummary, "id" | "account_id" | "primary">[],
    accountId: string,
    calendarId: string
): string => {
    if (calendarId !== "primary") return calendarId;
    return calendars.find((c) => c.account_id === accountId && c.primary)?.id ?? calendarId;
};
