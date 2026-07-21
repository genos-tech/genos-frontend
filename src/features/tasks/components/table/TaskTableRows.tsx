import { Fragment, memo } from "react";
import { Socket } from "socket.io-client";

import { ChatManagementState } from "../../../../hooks/chats/useChatManagement";
import { TeamManagementState } from "../../../../hooks/common/useTeamManagement";
import { UIStateManagementState } from "../../../../hooks/common/useUIStateManagement";
import { TaskManagementState } from "../../../../hooks/tasks/useTaskManagement";
import { UserProps } from "../../../../types/admin";
import { TagListProps, TaskTableProps } from "../../../../types/tasks";
import { TaskFieldRules } from "../../utils/taskFieldRules";
import { DraggableTaskRow } from "./DraggableTaskRow";
import { ColumnDef } from "./DraggableTaskTable";
import { QuickAddDraft, QuickAddTaskRow } from "./QuickAddTaskRow";

export type TaskTableRowsProps = {
    displayRows: TaskTableProps[];
    depthMap: Map<string, number>;
    childrenByParent: Map<string, TaskTableProps[]>;
    columns: ColumnDef[];
    expandedRows: Set<string>;
    sprintNamesById: Map<number, string>;
    mode: "light" | "dark" | undefined;
    myself: UserProps;
    teamMembers: UserProps[];
    socket: Socket | null;
    /** Row id the inline quick-add draft is anchored beneath (null = closed). */
    quickAddParentId: string | null;
    quickAddFieldRules: TaskFieldRules | null;
    quickAddProjectTags: TagListProps[];
    /**
     * Per-row selection resolver, owned by DraggableTaskTable. Its identity
     * changes exactly when the selection inputs change, which is what makes
     * it safe to compare by reference below: a preview switch invalidates it
     * (rows must re-render), while comments/activity/notes arriving does not.
     */
    resolveIsSelected: (task: TaskTableProps) => boolean;

    // State managers + callbacks. Deliberately EXCLUDED from the comparator
    // — see the note on `taskTableRowsPropsAreEqual`.
    useTM: TaskManagementState;
    useTEM: TeamManagementState;
    useCM: ChatManagementState;
    useUISM: UIStateManagementState;
    setMyself: (value: UserProps) => void;
    toggleExpand: (id: string) => void;
    onOpenDiagram: (task: TaskTableProps) => void;
    onQuickAddChild: (task: TaskTableProps) => void;
    onRequestPreview: (task: TaskTableProps) => void;
    onRowUpdate: (task: TaskTableProps) => Promise<TaskTableProps>;
    onQuickAddClose: () => void;
    onQuickAddDirtyChange: (dirty: boolean) => void;
    onQuickAddSubmit: (parent: TaskTableProps, draft: QuickAddDraft) => Promise<void>;
};

const TaskTableRowsImpl = (props: TaskTableRowsProps) => {
    const {
        displayRows,
        depthMap,
        childrenByParent,
        columns,
        expandedRows,
        sprintNamesById,
        mode,
        myself,
        teamMembers,
        socket,
        quickAddParentId,
        quickAddFieldRules,
        quickAddProjectTags,
        resolveIsSelected,
        useTM,
        useTEM,
        useCM,
        useUISM,
        setMyself,
        toggleExpand,
        onOpenDiagram,
        onQuickAddChild,
        onRequestPreview,
        onRowUpdate,
        onQuickAddClose,
        onQuickAddDirtyChange,
        onQuickAddSubmit,
    } = props;

    return (
        <>
            {displayRows.map((task, index) => (
                <Fragment key={task.id}>
                    <DraggableTaskRow
                        columns={columns}
                        depth={depthMap.get(String(task.id)) ?? 0}
                        expandedRows={expandedRows}
                        hasChildren={childrenByParent.has(String(task.id))}
                        index={index}
                        isSelected={resolveIsSelected(task)}
                        mode={mode}
                        myself={myself}
                        setMyself={setMyself}
                        socket={socket}
                        sprintNamesById={sprintNamesById}
                        task={task}
                        teamMembers={teamMembers}
                        toggleExpand={toggleExpand}
                        useCM={useCM}
                        useTEM={useTEM}
                        useTM={useTM}
                        useUISM={useUISM}
                        onOpenDiagram={onOpenDiagram}
                        onQuickAddChild={onQuickAddChild}
                        onRequestPreview={onRequestPreview}
                        onRowUpdate={onRowUpdate}
                    />
                    {/* Inline quick-add draft row, anchored directly beneath
                        its parent row (above any existing children).
                        Deliberately NOT a Draggable and consumes no dnd index
                        — `index` above still comes straight from displayRows,
                        so the drag-end splice math is untouched. */}
                    {quickAddParentId === String(task.id) && (
                        <QuickAddTaskRow
                            columns={columns}
                            creatorUserId={myself.userId}
                            depth={(depthMap.get(String(task.id)) ?? 0) + 1}
                            fieldRules={quickAddFieldRules}
                            mode={mode}
                            parentTask={task}
                            projectTags={quickAddProjectTags}
                            teamMembers={teamMembers}
                            onClose={onQuickAddClose}
                            onDirtyChange={onQuickAddDirtyChange}
                            onSubmit={(draft) => onQuickAddSubmit(task, draft)}
                        />
                    )}
                </Fragment>
            ))}
        </>
    );
};

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
    prev.columns === next.columns &&
    prev.expandedRows === next.expandedRows &&
    prev.sprintNamesById === next.sprintNamesById &&
    prev.mode === next.mode &&
    prev.myself === next.myself &&
    prev.teamMembers === next.teamMembers &&
    prev.socket === next.socket &&
    prev.quickAddParentId === next.quickAddParentId &&
    prev.quickAddFieldRules === next.quickAddFieldRules &&
    prev.quickAddProjectTags === next.quickAddProjectTags &&
    prev.resolveIsSelected === next.resolveIsSelected;

export const TaskTableRows = memo(TaskTableRowsImpl, taskTableRowsPropsAreEqual);
