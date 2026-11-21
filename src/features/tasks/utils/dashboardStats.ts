import { startOfTodayMs } from "../../../utils/calendarDate";
import { isDueWithin, isOverdueDate } from "./dueWindow";
import type { EffectiveTask } from "./effectiveTasks";
import { computeTaskWeight } from "./taskWeight";
import { compareByUrgency } from "./topWeightSort";

// KPI rollup for one person's tasks (active/closed/overdue/completion, …).
// Extracted so the "My Tasks" tab, its tab badge, and the "Member's Tasks"
// tab all compute the same numbers for whichever user is in focus.
export const computeAssigneeStats = (tasks: EffectiveTask[]) => {
    const today = new Date();

    let openCount = 0;
    let wipCount = 0;
    let blockedCount = 0;
    let pendingCount = 0;
    let closedCount = 0;
    let overdueCount = 0;
    let dueThisWeekCount = 0;
    for (const t of tasks) {
        const isClosed = t.effectiveStatus === "Closed";
        if (t.effectiveStatus === "Open") openCount++;
        else if (t.effectiveStatus === "WIP") wipCount++;
        else if (t.effectiveStatus === "Blocked") blockedCount++;
        else if (t.effectiveStatus === "Pending") pendingCount++;
        else if (isClosed) closedCount++;

        if (!isClosed && t.dueDate) {
            // A calendar day: due today is not overdue (MIP-1816).
            if (isOverdueDate(t.dueDate, today)) overdueCount++;
            else if (isDueWithin(t.dueDate, today)) dueThisWeekCount++;
        }
    }
    const totalCount = openCount + wipCount + blockedCount + pendingCount + closedCount;
    const activeCount = openCount + wipCount + blockedCount + pendingCount;
    const completionPct = totalCount > 0 ? Math.round((closedCount / totalCount) * 100) : 0;
    return {
        openCount,
        wipCount,
        blockedCount,
        pendingCount,
        closedCount,
        totalCount,
        activeCount,
        overdueCount,
        dueThisWeekCount,
        completionPct,
    };
};

// Top 10 active tasks to look at next: overdue → priority → soonest due →
// recent (urgency), or weight-first with urgency as tie-break. Shared by the
// "Up Next" list for whichever user is in focus.
export const computeUpNext = (tasks: EffectiveTask[], upNextSort: "weight" | "urgency") => {
    const todayMs = startOfTodayMs();
    const active = tasks.filter((t) => t.effectiveStatus !== "Closed");
    const byUrgency = (a: EffectiveTask, b: EffectiveTask): number =>
        compareByUrgency(a, b, todayMs);
    const byWeight = (a: EffectiveTask, b: EffectiveTask): number => {
        const wa = computeTaskWeight(a);
        const wb = computeTaskWeight(b);
        if (wa !== wb) return wb - wa;
        return byUrgency(a, b);
    };
    return active
        .slice()
        .sort(upNextSort === "weight" ? byWeight : byUrgency)
        .slice(0, 10);
};
