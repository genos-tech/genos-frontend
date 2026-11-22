import type { TaskTableRowsProps } from "./TaskTableRows";

/**
 * Why this memo boundary exists.
 *
 * Opening a task drives ~10 render passes of the whole task page (the
 * preview's loaders each land separately, plus the state mirrors between
 * TaskPreview and useTaskManagement). DraggableTaskRow is memoized, so those
 * passes don't re-render row *bodies* — but without a boundary here, React
 * still had to build and prop-compare N row elements on all ~10 passes. That
 * is O(rows × passes) of work per click for data the table doesn't even
 * display (comments, activity, notes).
 *
 * Nearly all of those passes carry nothing this subtree renders, so they stop
 * at this comparator and the row map is skipped entirely.
 *
 * The excluded props — the four state-manager objects and every callback —
 * are excluded on the SAME contract DraggableTaskRow's own comparator already
 * uses (see `draggableTaskRowPropsAreEqual`): they are rebuilt on every parent
 * render and are only ever invoked from handlers, never read at render time.
 *
 * This introduces no new staleness class. A memo-skipped DraggableTaskRow
 * already retained the previous render's callbacks; adding this boundary means
 * the row keeps the same props object it would have kept anyway. And any change
 * the rows must actually reflect — a selection switch, a row edit, an expand,
 * a filter or sort change — arrives through one of the compared props below,
 * which re-renders this subtree and hands every row the fresh callbacks.
 */
export const taskTableRowsPropsAreEqual = (
    prev: TaskTableRowsProps,
    next: TaskTableRowsProps
): boolean =>
    prev.displayRows === next.displayRows &&
    prev.depthMap === next.depthMap &&
    prev.childrenByParent === next.childrenByParent &&
    prev.ghostIds === next.ghostIds &&
    prev.familyKeyByRow === next.familyKeyByRow &&
    prev.columns === next.columns &&
    prev.customFieldDefs === next.customFieldDefs &&
    prev.expandedRows === next.expandedRows &&
    prev.sprintNamesById === next.sprintNamesById &&
    prev.mode === next.mode &&
    prev.myself === next.myself &&
    prev.teamMembers === next.teamMembers &&
    prev.projectTags === next.projectTags &&
    prev.socket === next.socket &&
    prev.quickAddParentId === next.quickAddParentId &&
    prev.quickAddFieldRules === next.quickAddFieldRules &&
    prev.quickAddProjectTags === next.quickAddProjectTags &&
    prev.resolveIsSelected === next.resolveIsSelected;
