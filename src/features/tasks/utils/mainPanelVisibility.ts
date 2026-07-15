/**
 * The task workspace shows exactly one MAIN panel at a time: the task
 * table, the dashboard, or the sprint board. `useTaskManagement` enforces
 * that — each `setIsXVisible(true)` turns the other two off — so the flags
 * must always be read as a set, never individually.
 *
 * Several close/cancel paths (task preview, milestone preview, create-task
 * form) need the same rule: *if closing me would leave no main panel up,
 * fall back to the table*. That test was written out by hand at five call
 * sites, and one of them checked only the table and the sprint board. With
 * the dashboard open the table flag is already false, so that site called
 * `setIsTaskTableVisible(true)` — and mutual exclusion then closed the
 * dashboard the user was reading and swapped in the table.
 *
 * Hence one predicate: a new main panel can't be forgotten from the set.
 */
export type MainPanelVisibility = {
    isTaskTableVisible: boolean;
    isSprintBoardVisible: boolean;
    isTaskDashboardVisible: boolean;
};

export const isNoMainPanelVisible = (v: MainPanelVisibility): boolean =>
    v.isTaskTableVisible === false &&
    v.isSprintBoardVisible === false &&
    v.isTaskDashboardVisible === false;
