import dayjs from "dayjs";

import { TaskTableProps } from "../../../types/tasks";
import { computeTaskWeight } from "./taskWeight";

/**
 * Shared sort helpers consumed by both the task table (column header
 * click) and the sprint board (per-column ordering). Centralised here so
 * the two surfaces share rank maps, date parsing, and the comparator
 * builder — without that, the board's "Priority desc" and the table's
 * "Priority desc" could subtly disagree on edge cases (e.g. how a null
 * priority sorts, or whether "Medium" outranks "Low").
 *
 * The sort model is a **stack of tiers**: each tier is a
 * `{field, direction}` pair, and the comparator walks them in order.
 * Ties on every tier fall through to a final id-based tie-break so the
 * row order is deterministic across renders. Up to 2 tiers are exposed
 * through Settings; the comparator handles arbitrary tier counts.
 */

export type SortDirection = "asc" | "desc";

export type SortTier = {
    field: string;
    direction: SortDirection;
};

// Categorical fields stored as strings (priority / effortLevel / status)
// are what the user perceives as ordered, but `localeCompare` would sort
// them alphabetically — e.g. Priority desc would surface "Normal" above
// "Low" because of the letter ordering. The rank maps below give each
// value an explicit numeric weight so the comparator does the obvious
// thing. Higher rank = more urgent for priority/effort. For status the
// workflow order Open → WIP → Blocked → Pending → Closed → Deleted is modelled as
// ascending so "asc" naturally surfaces the most active rows first;
// "desc" shows Deleted/Closed first.
export const PRIORITY_RANK: Record<string, number> = {
    Critical: 5,
    High: 4,
    Normal: 3,
    // "Medium" is a legacy alias still referenced in the sprint-board
    // card's priorityColors map. Same rank as Normal so a task labelled
    // either way orders correctly.
    Medium: 3,
    Low: 2,
    Minimal: 1,
};

export const EFFORT_RANK: Record<string, number> = {
    Extensive: 5,
    High: 4,
    Moderate: 3,
    Low: 2,
    Minimal: 1,
};

export const STATUS_RANK: Record<string, number> = {
    Open: 1,
    WIP: 2,
    Blocked: 3,
    Pending: 4,
    Closed: 5,
    Deleted: 6,
};

// Parse a date string into epoch ms for numeric comparison. `dueDate` is
// a free-form locale-ish string in the table model, so a plain string
// sort would put "10/2/2025" before "9/30/2025"; using dayjs gives the
// chronological ordering users expect.
const parseTs = (s: string | null | undefined): number | null => {
    if (!s) return null;
    const d = dayjs(s);
    return d.isValid() ? d.valueOf() : null;
};

const numericId = (s: string | number | null | undefined): number | null => {
    if (s == null || s === "") return null;
    const n = Number(s);
    return Number.isFinite(n) ? n : null;
};

const lowerStr = (s: string | null | undefined): string | null => {
    if (s == null || s === "") return null;
    return s.toLowerCase();
};

// Resolve a row's value for a given sort field, normalizing it into the
// shape the comparator expects:
//   - numeric for id / daysLeft / priority / effortLevel / status / dates
//   - lowercased string for textual columns
//   - null when the row is missing the value (caller pushes nulls to the
//     bottom regardless of direction)
export const fieldValue = (task: TaskTableProps, field: string): number | string | null => {
    switch (field) {
        case "id":
            return numericId(task.id);
        case "daysLeft":
            return task.daysLeft ?? null;
        case "title":
            return lowerStr(task.title);
        case "assigneeId":
        case "assignee":
            // Sort by what the user actually sees in the cell, not the
            // raw user-id UUID, so the column ordering matches their
            // reading. The "assignee" alias accepts the column-id form
            // the table uses internally.
            return (
                lowerStr(task.assigneeName) ??
                lowerStr(task.assigneeEmail) ??
                lowerStr(task.assigneeId)
            );
        case "priority":
            return PRIORITY_RANK[task.priority ?? ""] ?? null;
        case "effortLevel":
            return EFFORT_RANK[task.effortLevel ?? ""] ?? null;
        case "weight":
            // Derived Task Weight (priority × start-urgency, 1..25).
            // Recomputed per sort so "Weight desc" always reflects today's
            // time pressure.
            return computeTaskWeight(task);
        case "status":
            return STATUS_RANK[task.status ?? ""] ?? null;
        case "tags":
            return lowerStr(task.concatTags);
        case "sprint":
            // Sort by sprintId so tasks/milestones in the same sprint
            // cluster together. Sprint names live in component state
            // (`sprintNamesById`) and aren't reachable from this
            // module-scope helper; sprintId is monotonically allocated
            // so it correlates with sprint creation/sequence order.
            return task.sprintId ?? null;
        case "dueDate":
        case "updatedAt":
        case "createdDate":
            return parseTs((task as unknown as Record<string, string | null | undefined>)[field]);
        default: {
            const raw = (task as unknown as Record<string, unknown>)[field];
            if (raw == null || raw === "") return null;
            return typeof raw === "number" ? raw : String(raw).toLowerCase();
        }
    }
};

// "Null tier" partition: rows missing the sort value always sink to the
// bottom regardless of asc/desc, which matches what the user expects
// when toggling direction (e.g. "Due Date desc" shouldn't fill the top
// with rows that have no due date).
export const nullTier = (a: unknown, b: unknown): number => {
    const aNull = a == null;
    const bNull = b == null;
    if (aNull && bNull) return 0;
    if (aNull) return 1;
    if (bNull) return -1;
    return 0;
};

const cmpValues = (a: number | string | null, b: number | string | null): number => {
    if (a == null || b == null) return 0; // null-tier already handled
    if (typeof a === "number" && typeof b === "number") return a - b;
    return String(a).localeCompare(String(b));
};

/**
 * Comparator over the user's sort tiers **alone**, returning 0 when
 * every tier ties. Callers append their own fallback ordering:
 * `buildComparator` falls back to id, while the table's milestone group
 * falls back to its due-date rule. An empty tier array compares
 * everything as equal, which is what lets a caller's fallback act as the
 * complete ordering when the user has configured no sort.
 *
 * Field values are cached per (task, field) so a tier's `fieldValue`
 * call is paid once per task, not 2× per comparator hit × N log N.
 */
export const buildTierComparator = (
    tiers: SortTier[]
): ((a: TaskTableProps, b: TaskTableProps) => number) => {
    // One cache per tier. Keys are task identity (we use `id` as a
    // string proxy — tasks without an id can't be cached and re-resolve
    // each time, which is rare and not a hot path).
    const caches = tiers.map(() => new Map<string, number | string | null>());
    const resolve = (task: TaskTableProps, tierIndex: number): number | string | null => {
        const tier = tiers[tierIndex];
        const idKey = task.id != null ? String(task.id) : null;
        const cache = caches[tierIndex];
        if (idKey != null) {
            const cached = cache.get(idKey);
            if (cached !== undefined) return cached;
        }
        const v = fieldValue(task, tier.field);
        if (idKey != null) cache.set(idKey, v);
        return v;
    };

    return (a, b) => {
        for (let i = 0; i < tiers.length; i++) {
            const av = resolve(a, i);
            const bv = resolve(b, i);
            const tier = nullTier(av, bv);
            if (tier !== 0) return tier;
            const dir = tiers[i].direction === "asc" ? 1 : -1;
            const cmp = cmpValues(av, bv) * dir;
            if (cmp !== 0) return cmp;
        }
        return 0;
    };
};

/**
 * Build a comparator for the given sort tiers. The comparator returns
 * a stable result (deterministic on ties via id), so callers can sort
 * in place without worrying about visual shuffle across re-renders.
 */
export const buildComparator = (
    tiers: SortTier[]
): ((a: TaskTableProps, b: TaskTableProps) => number) => {
    const compareTiers = buildTierComparator(tiers);

    const idCache = new Map<string | number, number | null>();
    const cacheId = (raw: string | number | null | undefined) => {
        if (raw == null) return null;
        const cached = idCache.get(raw);
        if (cached !== undefined) return cached;
        const v = numericId(raw);
        idCache.set(raw, v);
        return v;
    };
    const idTieBreak = (a: TaskTableProps, b: TaskTableProps): number =>
        (cacheId(a.id) ?? Number.MAX_SAFE_INTEGER) - (cacheId(b.id) ?? Number.MAX_SAFE_INTEGER);

    return (a, b) => {
        const cmp = compareTiers(a, b);
        if (cmp !== 0) return cmp;
        return idTieBreak(a, b);
    };
};

/**
 * Order one level of the task table's tree — root rows or a single
 * parent's subtask group. Every level goes through here so the whole
 * tree obeys one rule.
 *
 * Layered, in order:
 *   1. Milestone vs. task — milestones are higher-level work items and
 *      stay pinned above regular tasks whatever the user picked.
 *      Filtering hides milestones; sorting never does.
 *   2. The user's tiers, applied to tasks and (within the pinned group)
 *      to milestones alike.
 *   3. For milestones the tiers left tied: the built-in daysLeft →
 *      dueDate → sprint → id rule, so the next-up milestone surfaces
 *      first. With no tiers configured this rule is the whole ordering,
 *      which is the long-standing default.
 *   4. Deterministic id tie-break so equal rows don't shuffle on
 *      re-render.
 */
export const sortTableTasks = (tasks: TaskTableProps[], tiers: SortTier[]): TaskTableProps[] => {
    // Empty tiers = preserve the caller's (filter-pipeline) ordering,
    // falling through to the id tie-break for determinism.
    const taskComparator = buildComparator(tiers);
    // Tier-only variant: returns 0 on a full tie so the milestone group
    // can reach its own rule instead of the id tie-break that
    // `buildComparator` would apply first.
    const compareTiers = buildTierComparator(tiers);

    const idCache = new Map<string | number, number | null>();
    const cacheId = (raw: string | number | null | undefined) => {
        if (raw == null) return null;
        const cached = idCache.get(raw);
        if (cached !== undefined) return cached;
        const v = numericId(raw);
        idCache.set(raw, v);
        return v;
    };
    const idTieBreak = (a: TaskTableProps, b: TaskTableProps) =>
        (cacheId(a.id) ?? Number.MAX_SAFE_INTEGER) - (cacheId(b.id) ?? Number.MAX_SAFE_INTEGER);

    const compareMilestones = (a: TaskTableProps, b: TaskTableProps) => {
        // The user's condition decides the milestone group's order too;
        // everything below only breaks ties it left equal.
        const tierCmp = compareTiers(a, b);
        if (tierCmp !== 0) return tierCmp;
        // daysLeft ascending so expired milestones top the list, then
        // due-soon, with unscheduled (null) milestones at the bottom of
        // the milestone group (still above tasks — that's the pin step).
        const aDays = a.daysLeft ?? null;
        const bDays = b.daysLeft ?? null;
        const daysTier = nullTier(aDays, bDays);
        if (daysTier !== 0) return daysTier;
        if (aDays != null && bDays != null && aDays !== bDays) {
            return aDays - bDays;
        }
        // `daysLeft` is derived — fall back to the raw due date in case a
        // row has one set without the other.
        const aDue = parseTs(a.dueDate);
        const bDue = parseTs(b.dueDate);
        const dueTier = nullTier(aDue, bDue);
        if (dueTier !== 0) return dueTier;
        if (aDue != null && bDue != null && aDue !== bDue) return aDue - bDue;
        // Cluster milestones by sprint, then id.
        const aSprint = a.sprintId ?? null;
        const bSprint = b.sprintId ?? null;
        const sprintTier = nullTier(aSprint, bSprint);
        if (sprintTier !== 0) return sprintTier;
        if (aSprint != null && bSprint != null && aSprint !== bSprint) {
            return aSprint - bSprint;
        }
        return idTieBreak(a, b);
    };

    return [...tasks].sort((a, b) => {
        const aMile = a.isMilestone === true;
        const bMile = b.isMilestone === true;
        if (aMile !== bMile) return aMile ? -1 : 1;
        if (aMile && bMile) return compareMilestones(a, b);
        return taskComparator(a, b);
    });
};

/**
 * Source-of-truth list of fields users can pick in Settings as a sort
 * tier. Kept here so the SettingsModal Select and the comparator stay
 * in sync (i.e. any field listed here is guaranteed to be handled by
 * `fieldValue`).
 *
 * The order is the order shown in the UI. "title" / "assigneeId" /
 * "id" rank lower than the time-pressure fields because users picking
 * a sort key usually want urgency information first.
 */
export const SORT_FIELD_OPTIONS: ReadonlyArray<{
    value: string;
    /** Key into `t.tasks.table.columns` for the user-facing label. */
    labelKey:
        | "id"
        | "title"
        | "status"
        | "priority"
        | "effortLevel"
        | "weight"
        | "dueDate"
        | "assignee"
        | "updatedAt"
        | "createdDate";
}> = [
    { value: "priority", labelKey: "priority" },
    { value: "weight", labelKey: "weight" },
    { value: "dueDate", labelKey: "dueDate" },
    { value: "status", labelKey: "status" },
    { value: "effortLevel", labelKey: "effortLevel" },
    { value: "updatedAt", labelKey: "updatedAt" },
    { value: "createdDate", labelKey: "createdDate" },
    { value: "title", labelKey: "title" },
    { value: "assigneeId", labelKey: "assignee" },
    { value: "id", labelKey: "id" },
];

export const isSortField = (val: unknown): val is string =>
    typeof val === "string" && SORT_FIELD_OPTIONS.some((o) => o.value === val);

export const isSortDirection = (val: unknown): val is SortDirection =>
    val === "asc" || val === "desc";
