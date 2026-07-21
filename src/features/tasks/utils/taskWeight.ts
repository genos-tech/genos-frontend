import { TaskTableProps } from "../../../types/tasks";
import { EFFORT_RANK, PRIORITY_RANK } from "./sortTask";

/**
 * Task Weight — the "pointing system".
 *
 * Two derived numbers, computed purely from metadata already on the task
 * row, so nothing is persisted and the values recompute (day-relative) on
 * every render:
 *
 *   • **Task Weight** (importance / "what to pick up now")
 *       = priorityPoints × startUrgencyPoints  → 1..25
 *     A multiplicative model (risk-matrix style) surfaces "critical AND
 *     start-now" (5×5=25) tasks to the very top.
 *
 *     Effort is **not** a term of its own — a huge trivial task must never
 *     outrank a small critical one (cf. WSJF / cost-of-delay). Instead
 *     effort decides *how early a task starts demanding attention*: the
 *     bigger the job, the sooner it should be on someone's radar before the
 *     deadline, so effort shifts the urgency ramp earlier
 *     (`EFFORT_HEAD_START_DAYS`). An Extensive task a week out is already
 *     climbing; a Minimal one with the same week left is not.
 *
 *   • **Effort points** (the currency for *capacity* — "who's busy")
 *     roll up per assignee, bucketed by `dueBucket`, in the dashboard. That
 *     aggregation lives in the component because it needs the parent-chain
 *     `effectiveStatus` rollup; this module stays a pure points/bucket kit.
 *
 * All three inputs floor to 1 when unset (× 1 is neutral-low), so an
 * un-triaged task sinks but still carries whatever real signal it has.
 *
 * The 1..5 rank maps are shared with the sort comparator (`sortTask.ts`) so
 * a task's Weight and its "Priority desc" ordering can never disagree on
 * how a given priority/effort label ranks (incl. the legacy "Medium" alias).
 */

/** Highest attainable Task Weight (5 priority × 5 urgency). */
export const MAX_TASK_WEIGHT = 25;

/** Priority label → 1..5, flooring unknown/unset to 1. */
export const priorityPoints = (priority: string | null | undefined): number =>
    PRIORITY_RANK[priority ?? ""] ?? 1;

/** Effort label → 1..5, flooring unknown/unset to 1. */
export const effortPoints = (effortLevel: string | null | undefined): number =>
    EFFORT_RANK[effortLevel ?? ""] ?? 1;

/**
 * Effort label → how many days of head start it gets in the ranking, i.e.
 * how much earlier than its due date the task begins climbing.
 *
 * Explicitly **NOT an estimate of how long the task takes**. Duration
 * depends on who picks it up — an experienced member might finish in five
 * days what takes a newcomer ten — and the board can't know that. This is
 * just the "bigger jobs deserve earlier attention" bias, in the only unit
 * the urgency ramp speaks: days.
 *
 * `Minimal` (and unknown/unset — the same floor `effortPoints` uses) gets
 * no head start, so an un-triaged task's Weight is exactly what it was
 * before effort entered the model.
 *
 * Retuning this table is the one knob that changes how hard effort pulls.
 */
export const EFFORT_HEAD_START_DAYS: Record<string, number> = {
    Extensive: 7,
    High: 4,
    Moderate: 2,
    Low: 1,
    Minimal: 0,
};

/** Effort label → head-start days, flooring unknown/unset to 0. */
export const effortHeadStart = (effortLevel: string | null | undefined): number =>
    EFFORT_HEAD_START_DAYS[effortLevel ?? ""] ?? 0;

// Whole-day difference from *today* to the due date, both normalized to
// local midnight — matches the dashboard's `formatDueLabel` math so the
// two never disagree on what "1 day left" means.
const daysUntil = (dueDate: string, now: Date): number => {
    const today = new Date(now);
    today.setHours(0, 0, 0, 0);
    const d = new Date(dueDate);
    d.setHours(0, 0, 0, 0);
    return Math.round((d.getTime() - today.getTime()) / 86400000);
};

const clamp = (n: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, n));

/**
 * Due-date urgency → 1..5. Curve `clamp(6 − daysLeft, 1, 5)`:
 *   5+ days → 1,  4 → 2,  3 → 3,  2 → 4,  1 / today / overdue → 5.
 * No due date (or an unparseable one) → 1 (no time pressure).
 *
 * Derived from `dueDate`, NOT the row's `daysLeft`, because the table uses
 * `daysLeft === -1` as an "Expired" sentinel rather than a signed count.
 *
 * This is the deadline-only primitive: "how close is the finish line". Task
 * Weight ranks by `startUrgencyPoints` below, which brings this same ramp
 * forward by the task's effort head start.
 */
export const urgencyPoints = (
    dueDate: string | null | undefined,
    now: Date = new Date()
): number => {
    if (!dueDate) return 1;
    const diff = daysUntil(dueDate, now);
    if (Number.isNaN(diff)) return 1;
    return clamp(6 - diff, 1, 5);
};

/**
 * Time pressure to **get started**, → 1..5: the same ramp as
 * `urgencyPoints`, brought forward by the task's effort head start.
 *
 *   `clamp(6 − (daysLeft − headStart), 1, 5)`
 *
 * So an Extensive task (7 days of head start) due in 7 days is already at
 * 5 — it should be picked up now — while a Minimal one due in 7 days is
 * still at 1. It says nothing about how long either will actually take.
 *
 * No due date → 1: with no deadline to work back from, effort has nothing
 * to bring forward, however big the task.
 */
export const startUrgencyPoints = (
    dueDate: string | null | undefined,
    effortLevel: string | null | undefined,
    now: Date = new Date()
): number => {
    if (!dueDate) return 1;
    const diff = daysUntil(dueDate, now);
    if (Number.isNaN(diff)) return 1;
    return clamp(6 - (diff - effortHeadStart(effortLevel)), 1, 5);
};

/** Task Weight = priorityPoints × startUrgencyPoints → 1..25. */
export const computeTaskWeight = (task: TaskTableProps, now: Date = new Date()): number =>
    priorityPoints(task.priority) * startUrgencyPoints(task.dueDate, task.effortLevel, now);

export type WeightBand = "low" | "medium" | "high" | "critical";

// Heat bands over the 1..25 range (~quartiles). Colors reuse the
// priority/effort chip palette so Weight reads as the same visual language:
// gray (calm) → blue → amber → red (fire).
export const weightBand = (weight: number): { band: WeightBand; color: string; label: string } => {
    if (weight >= 18) return { band: "critical", color: "#EF4444", label: "Critical" };
    if (weight >= 12) return { band: "high", color: "#F59E0B", label: "High" };
    if (weight >= 6) return { band: "medium", color: "#3B82F6", label: "Medium" };
    return { band: "low", color: "#9CA3AF", label: "Low" };
};

export type DueBucket = "overdue" | "today" | "week" | "later" | "none";

/**
 * Scheduling horizon for the capacity view — "when does this land on
 * someone's plate". `week` is the next 7 days (matches the dashboard's
 * existing `weekAhead` window); `none` = no due date.
 */
export const dueBucket = (
    dueDate: string | null | undefined,
    now: Date = new Date()
): DueBucket => {
    if (!dueDate) return "none";
    const diff = daysUntil(dueDate, now);
    if (Number.isNaN(diff)) return "none";
    if (diff < 0) return "overdue";
    if (diff === 0) return "today";
    if (diff <= 7) return "week";
    return "later";
};
