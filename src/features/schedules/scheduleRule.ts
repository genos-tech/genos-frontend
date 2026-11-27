// How a schedule row says when it runs (MIP-2512): worded here from the fields the
// API sends, in the member's language. The API's own `when` is English and is only
// the fallback for a rule this build does not know or cannot complete.

import { fmt } from "../../i18n";
import type { Messages } from "../../i18n/types";
import type { Schedule } from "../../services/schedules";
import { weekdayName } from "./scheduleFormat";

type RuleStrings = Pick<
    Messages["settings"]["schedules"],
    "ruleDaily" | "ruleWeekdays" | "ruleWeekly" | "ruleMonthly" | "ruleOnce"
>;

type RuleFields = Pick<
    Schedule,
    "when" | "frequency" | "timeOfDay" | "weekdays" | "monthDay" | "runDate"
>;

const listWords = (words: string[], locale: string): string => {
    try {
        return new Intl.ListFormat(locale, { type: "conjunction" }).format(words);
    } catch {
        return words.join(", ");
    }
};

/** "2026-12-24" as a calendar date in the page's language. No time zone shift: the
 *  date is read and written as UTC. */
const dateWords = (iso: string, locale: string): string => {
    const date = new Date(`${iso}T00:00:00Z`);
    if (Number.isNaN(date.getTime())) return iso;
    try {
        return new Intl.DateTimeFormat(locale, {
            year: "numeric",
            month: "short",
            day: "numeric",
            timeZone: "UTC",
        }).format(date);
    } catch {
        return iso;
    }
};

export const describeRule = (sch: RuleFields, s: RuleStrings, locale: string): string => {
    const time = sch.timeOfDay;
    if (!time) return sch.when;
    switch (sch.frequency) {
        case "daily":
            return fmt(s.ruleDaily, { time });
        case "weekdays":
            return fmt(s.ruleWeekdays, { time });
        case "weekly": {
            const days = [...(sch.weekdays ?? [])]
                .filter((d) => d >= 0 && d <= 6)
                .sort((a, b) => a - b)
                .map((d) => weekdayName(d, locale, "long"));
            return days.length
                ? fmt(s.ruleWeekly, { days: listWords(days, locale), time })
                : sch.when;
        }
        case "monthly":
            return sch.monthDay ? fmt(s.ruleMonthly, { day: sch.monthDay, time }) : sch.when;
        case "once":
            return sch.runDate
                ? fmt(s.ruleOnce, { date: dateWords(sch.runDate, locale), time })
                : sch.when;
        default:
            return sch.when;
    }
};
