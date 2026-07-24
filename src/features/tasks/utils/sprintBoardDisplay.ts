import { TaskTableProps } from "../../../types/tasks";

/**
 * Which task cards the sprint board shows, per the depth model.
 *
 * The board is a flat kanban — "depth" controls WHICH tasks appear as cards,
 * not nesting. There are exactly four patterns plus the member-filter escape
 * hatch:
 *
 *   not scoped, collapsed : milestone cards + orphan root tasks (= filtered
 *                           roots).
 *   not scoped, expanded  : + each milestone card's DIRECT tasks ("Show tasks").
 *   scoped, collapsed     : the scoped milestone(s)' DIRECT tasks; the milestone
 *                           card itself is NOT shown.
 *   scoped, expanded      : + those tasks' DIRECT subtasks ("Show subtasks").
 *
 * The toggle always reveals exactly ONE more layer and stops (2-depth max);
 * deeper descendants stay hidden. Under a Member filter the board shows the
 * flat assignee matches unchanged (fe #225).
 *
 * `filteredTasks` / `visibleChildTaskIds` are the filter pipeline's verdict at
 * any depth (a card only appears if it survived the active filters);
 * `allTasks` supplies the parent → child structure used to walk one layer.
 */
export type BoardDisplayInput = {
    /** The filtered top-level set from TaskFilterMenu (roots when unscoped;
     *  the scoped milestone's flattened matches when scoped). */
    filteredTasks: TaskTableProps[];
    /** Ids of non-root tasks that passed every active filter (any depth). */
    visibleChildTaskIds: Set<string> | null;
    /** The full task set — source of the parent→child structure. */
    allTasks: TaskTableProps[];
    /** A milestone scope is active (dropdown filter or sidebar folder). */
    scoped: boolean;
    /** A Member filter is active — show flat matches, bypass the depth model. */
    memberFilterActive: boolean;
    /** Reveal one extra layer. */
    expandExtraDepth: boolean;
};

export const buildBoardDisplaySet = ({
    filteredTasks,
    visibleChildTaskIds,
    allTasks,
    scoped,
    memberFilterActive,
    expandExtraDepth,
}: BoardDisplayInput): TaskTableProps[] => {
    // Parent-id → direct children, from the FULL task set (so we can walk
    // exactly one layer down regardless of which layers passed the filter).
    const childrenByParent = new Map<string, TaskTableProps[]>();
    for (const task of allTasks) {
        if (task.parentTaskId == null || task.id == null) continue;
        const pid = String(task.parentTaskId);
        const arr = childrenByParent.get(pid) ?? [];
        arr.push(task);
        childrenByParent.set(pid, arr);
    }

    const filteredIds = new Set(
        (filteredTasks || [])
            .map((t) => (t.id != null ? String(t.id) : ""))
            .filter((s) => s !== "")
    );
    // "Did this task pass the active filters at any depth?"
    const passedFilter = (id: string) => filteredIds.has(id) || !!visibleChildTaskIds?.has(id);
    const directChildren = (parentId: string): TaskTableProps[] =>
        (childrenByParent.get(parentId) ?? []).filter(
            (c) => c.id != null && passedFilter(String(c.id))
        );

    const display: TaskTableProps[] = [];
    if (memberFilterActive) {
        // Member filter: flat assignee matches, unchanged (fe #225).
        display.push(...(filteredTasks || []));
    } else if (scoped) {
        // Layer 1 = the scoped milestone(s)' DIRECT tasks; the milestone card
        // itself (isMilestone) is intentionally NOT shown.
        const scopedMilestones = (filteredTasks || []).filter(
            (t) => t.isMilestone === true && t.id != null
        );
        const layer1: TaskTableProps[] = [];
        for (const m of scopedMilestones) layer1.push(...directChildren(String(m.id)));
        display.push(...layer1);
        if (expandExtraDepth) {
            // Layer 2 = those tasks' DIRECT subtasks (stop there).
            for (const task of layer1) {
                if (task.id != null) display.push(...directChildren(String(task.id)));
            }
        }
    } else {
        // Not scoped. Base = filtered roots (milestone cards + orphan root
        // tasks). Toggle adds each milestone card's DIRECT tasks.
        display.push(...(filteredTasks || []));
        if (expandExtraDepth) {
            for (const task of filteredTasks || []) {
                if (task.isMilestone === true && task.id != null) {
                    display.push(...directChildren(String(task.id)));
                }
            }
        }
    }

    // Dedupe by id, preserving first-seen order.
    const seen = new Set<string>();
    const out: TaskTableProps[] = [];
    for (const task of display) {
        const idKey = task.id != null ? String(task.id) : "";
        if (idKey) {
            if (seen.has(idKey)) continue;
            seen.add(idKey);
        }
        out.push(task);
    }
    return out;
};
