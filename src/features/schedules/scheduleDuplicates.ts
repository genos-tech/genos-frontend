// "Is this schedule already in the list?" (MIP-1200). A convenience, not the
// rule: the API refuses a duplicate and says so in a sentence the form shows
// (MIP-1201). This asks the same question of the list already on screen, so the
// answer is instant and a suggestion the member already has is not offered again.
//
// "Same" is the API's notion:
//   - the same job, the same parameters, the same recurrence and time; or
//   - the same name, ignoring case and surrounding spaces.
// The name is the member's own label, so two reports with different names but
// identical content are still the same schedule, and two with the same name are
// confusable in the Inbox whatever they do.

import type {
    ParamValue,
    Schedule,
    ScheduleFields,
    ScheduleFrequency,
} from "../../services/schedules";

/** What is compared: the fields of a schedule that define what it does and when. */
export type ScheduleShape = Pick<ScheduleFields, "name" | "job" | "params" | "frequency"> & {
    timeOfDay: string;
    weekdays?: number[];
    monthDay?: number;
    runDate?: string;
};

export type Duplicate = { kind: "same" | "name"; schedule: Schedule };

const normalName = (name: string): string => name.trim().toLowerCase();

const paramsKey = (params: Record<string, ParamValue> | undefined): string =>
    JSON.stringify(
        Object.entries(params ?? {})
            .filter(([, v]) => v !== undefined && v !== null && v !== "")
            .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    );

/** The recurrence as the frequency uses it: a field the frequency ignores does not count. */
const recurrenceKey = (s: ScheduleShape): string => {
    const frequency: ScheduleFrequency = s.frequency;
    const parts: unknown[] = [frequency, s.timeOfDay];
    if (frequency === "weekly") parts.push([...(s.weekdays ?? [])].sort((a, b) => a - b));
    if (frequency === "monthly") parts.push(s.monthDay ?? null);
    if (frequency === "once") parts.push(s.runDate ?? null);
    return JSON.stringify(parts);
};

export const isSameSchedule = (a: ScheduleShape, b: ScheduleShape): boolean =>
    a.job === b.job &&
    paramsKey(a.params) === paramsKey(b.params) &&
    recurrenceKey(a) === recurrenceKey(b);

/** The schedule in `existing` that `candidate` would duplicate, if any. Same content
 *  is reported ahead of same name, since it is the stronger statement. `ignoreId`
 *  is the schedule being edited: it is not a duplicate of itself. */
export const findDuplicate = (
    candidate: ScheduleShape,
    existing: Schedule[],
    ignoreId?: string | null
): Duplicate | null => {
    const others = existing.filter((s) => s.id !== ignoreId);
    const same = others.find((s) => isSameSchedule(candidate, s));
    if (same) return { kind: "same", schedule: same };
    const name = normalName(candidate.name);
    if (name === "") return null;
    const named = others.find((s) => normalName(s.name) === name);
    return named ? { kind: "name", schedule: named } : null;
};
