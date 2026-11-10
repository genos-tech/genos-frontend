// Where an arrow key goes in a board or a calendar (MIP-1402): the pure half of the
// roving tab stops, with no DOM. `useRovingNav` reads the DOM into a `RovingModel`, asks one
// of the moves below, and applies the answer.
//
// The model is the task table's (`gridNav.ts`, MIP-1230) with one change. The table is one
// grid with one tab stop. A board column or a calendar day column is a GROUP of items, and
// each group is its own tab stop: Tab moves between groups, the arrows move between items.
// A month grid is one group of 42 days (one stop for the month). Items are found by
// (group, item) ids, never by DOM node, so the stop survives a re-render: a card that is
// moved to another column keeps being the stop of that column.

import dayjs, { type Dayjs } from "dayjs";

import { intentForKey, type GridIntent } from "../../../features/tasks/components/table/gridNav";

export { intentForKey };
export type { GridIntent };

export type RovingPos = { group: string; item: string };

/** A target that is not in the model (a day of another month): the host has to bring it in. */
export type RovingTarget = RovingPos & { outside?: boolean };

export type RovingModel = {
    /** Group ids in reading order. */
    groups: readonly string[];
    /** The item ids of a group in reading order (top to bottom, or day by day). */
    itemsOf: (group: string) => readonly string[];
};

/** `null`: the key is not this surface's (the browser keeps it). `from` itself: swallow it. */
export type RovingMove = (
    model: RovingModel,
    from: RovingPos,
    intent: GridIntent
) => RovingTarget | null;

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

/**
 * A board (groups = columns, items = cards) or a timeline (groups = days, items = events).
 * Up / Down and Home / End stay in the group, Left / Right (mirrored in RTL by `intentForKey`)
 * go to the nearest group that has an item, landing at the same index or on its last item,
 * so an empty column is skipped. Ctrl+Home / Ctrl+End are the first / last item of all.
 * Page keys are the browser's (they scroll the column).
 */
export const columnMove: RovingMove = (model, from, intent) => {
    const items = model.itemsOf(from.group);
    const at = items.indexOf(from.item);
    const groupAt = model.groups.indexOf(from.group);
    if (at === -1 || groupAt === -1) return null;
    const stay = (index: number): RovingTarget => ({
        group: from.group,
        item: items[clamp(index, 0, items.length - 1)],
    });
    switch (intent) {
        case "prevRow":
            return stay(at - 1);
        case "nextRow":
            return stay(at + 1);
        case "rowStart":
            return stay(0);
        case "rowEnd":
            return stay(items.length - 1);
        case "prevCell":
        case "nextCell": {
            const step = intent === "nextCell" ? 1 : -1;
            for (let g = groupAt + step; g >= 0 && g < model.groups.length; g += step) {
                const there = model.itemsOf(model.groups[g]);
                if (there.length > 0) {
                    return {
                        group: model.groups[g],
                        item: there[Math.min(at, there.length - 1)],
                    };
                }
            }
            return { ...from };
        }
        case "gridStart":
        case "gridEnd": {
            const order = intent === "gridStart" ? [...model.groups] : [...model.groups].reverse();
            for (const group of order) {
                const there = model.itemsOf(group);
                if (there.length > 0) {
                    return {
                        group,
                        item: intent === "gridStart" ? there[0] : there[there.length - 1],
                    };
                }
            }
            return { ...from };
        }
        default:
            return null;
    }
};

/** "YYYY-MM-DD", the item id of a day: the format the calendar views write on their cells. */
export const dayId = (d: Date | Dayjs): string => dayjs(d).format("YYYY-MM-DD");

const addDays = (id: string, n: number): string => dayjs(id).add(n, "day").format("YYYY-MM-DD");

/** Same day of the neighbouring month, or its last day when that is shorter (Jan 31 -> Feb 28). */
const addMonths = (id: string, n: number): string =>
    dayjs(id).add(n, "month").format("YYYY-MM-DD");

/**
 * The WAI-ARIA date grid on a 6x7 month: ONE group of consecutive days, one row per week.
 * Left / Right a day, Up / Down a week, Home / End the start / end of the week, PageUp /
 * PageDown a month. A day that is not in the grid, and every page move, comes back with
 * `outside` set and the host shows that day's month. Ctrl+Home / Ctrl+End are not claimed (no meaningful day).
 */
export const monthMove: RovingMove = (model, from, intent) => {
    const days = model.itemsOf(from.group);
    const at = days.indexOf(from.item);
    if (at === -1) return null;
    const to = (item: string): RovingTarget => ({
        group: from.group,
        item,
        ...(days.includes(item) ? {} : { outside: true }),
    });
    switch (intent) {
        case "prevCell":
            return to(at > 0 ? days[at - 1] : addDays(from.item, -1));
        case "nextCell":
            return to(at < days.length - 1 ? days[at + 1] : addDays(from.item, 1));
        case "prevRow":
            return to(at >= 7 ? days[at - 7] : addDays(from.item, -7));
        case "nextRow":
            return to(at + 7 < days.length ? days[at + 7] : addDays(from.item, 7));
        case "rowStart":
            return to(days[Math.floor(at / 7) * 7]);
        case "rowEnd":
            return to(days[Math.min(days.length - 1, Math.floor(at / 7) * 7 + 6)]);
        // A month is a month ON SCREEN: the target can be one of the dimmed days of the
        // neighbouring month this grid also shows, and the host still has to switch to it
        // (else PageDown from the 3rd would land on the next month's 3rd and skip it).
        case "pageUp":
            return { group: from.group, item: addMonths(from.item, -1), outside: true };
        case "pageDown":
            return { group: from.group, item: addMonths(from.item, 1), outside: true };
        default:
            return null;
    }
};
