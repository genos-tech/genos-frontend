import { Fragment, memo, useEffect, useRef } from "react";
import { Socket } from "socket.io-client";

import { ChatManagementState } from "../../../../hooks/chats/useChatManagement";
import { TeamManagementState } from "../../../../hooks/common/useTeamManagement";
import { UIStateManagementState } from "../../../../hooks/common/useUIStateManagement";
import { TaskManagementState } from "../../../../hooks/tasks/useTaskManagement";
import { UserProps } from "../../../../types/admin";
import { ProjectCustomFieldDef, TagListProps, TaskTableProps } from "../../../../types/tasks";
import type { TaskGraphScope } from "../../diagram/types";
import { TaskFieldRules } from "../../utils/taskFieldRules";
import { DraggableTaskRow } from "./DraggableTaskRow";
import { ColumnDef } from "./DraggableTaskTable";
import { QuickAddDraft, QuickAddTaskRow } from "./QuickAddTaskRow";
import { taskTableRowsPropsAreEqual } from "./taskTableRowsHelpers";
import { useGridNav } from "./useGridNav";

export type TaskTableRowsProps = {
    displayRows: TaskTableProps[];
    depthMap: Map<string, number>;
    childrenByParent: Map<string, TaskTableProps[]>;
    /** Ids of "ghost" rows — ancestors spliced in by the Member filter to keep
     *  a matching subtask's dependency chain visible even though they aren't
     *  assigned to the filtered member. Rendered dimmed + non-interactive. */
    ghostIds: Set<string>;
    /** Row id → the id of the root task/milestone its parent chain ends at.
     *  Published to the DOM as `data-task-family` so the hover handler
     *  can dim every row outside the hovered row's family. Built
     *  in the same tree walk as `depthMap`, so it shares its identity. */
    familyKeyByRow: Map<string, string>;
    columns: ColumnDef[];
    /** The current project's custom field definitions — the row needs
     *  them to resolve `cf_<id>` column values (tag options, types). */
    customFieldDefs: ProjectCustomFieldDef[];
    expandedRows: Set<string>;
    sprintNamesById: Map<number, string>;
    mode: "light" | "dark" | undefined;
    myself: UserProps;
    teamMembers: UserProps[];
    /** The focused project's tags — options for the inline tags-cell editor. */
    projectTags: TagListProps[];
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
    onOpenDiagram: (task: TaskTableProps, scope: TaskGraphScope) => void;
    onQuickAddChild: (task: TaskTableProps) => void;
    onRequestPreview: (task: TaskTableProps) => void;
    onRowUpdate: (task: TaskTableProps) => Promise<TaskTableProps>;
    onDeleteTask: (task: TaskTableProps) => void;
    onQuickAddClose: () => void;
    onQuickAddDirtyChange: (dirty: boolean) => void;
    onQuickAddSubmit: (parent: TaskTableProps, draft: QuickAddDraft) => Promise<void>;
};

const TaskTableRowsImpl = (props: TaskTableRowsProps) => {
    const {
        displayRows,
        depthMap,
        childrenByParent,
        ghostIds,
        familyKeyByRow,
        columns,
        customFieldDefs,
        expandedRows,
        sprintNamesById,
        mode,
        myself,
        teamMembers,
        projectTags,
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
        onDeleteTask,
        onQuickAddClose,
        onQuickAddDirtyChange,
        onQuickAddSubmit,
    } = props;

    // Closing the quick-add form from the keyboard (Escape, or Enter to create) puts
    // the keyboard back on the "+" cell that opened it (MIP-1230); the form unmounts
    // with focus in it. A click-away keeps wherever the click went.
    const grid = useGridNav();
    const lastQuickAddParent = useRef<string | null>(null);
    useEffect(() => {
        const previous = lastQuickAddParent.current;
        lastQuickAddParent.current = quickAddParentId;
        if (previous && !quickAddParentId) grid?.restoreFocus({ rowId: previous, col: "__add" });
    }, [quickAddParentId, grid]);

    return (
        <>
            {displayRows.map((task, index) => (
                <Fragment key={task.id}>
                    <DraggableTaskRow
                        columns={columns}
                        customFieldDefs={customFieldDefs}
                        depth={depthMap.get(String(task.id)) ?? 0}
                        expandedRows={expandedRows}
                        familyKey={familyKeyByRow.get(String(task.id))}
                        hasChildren={childrenByParent.has(String(task.id))}
                        index={index}
                        isGhost={ghostIds.has(String(task.id))}
                        isSelected={resolveIsSelected(task)}
                        mode={mode}
                        myself={myself}
                        projectTags={projectTags}
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
                        onDeleteTask={onDeleteTask}
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

export const TaskTableRows = memo(TaskTableRowsImpl, taskTableRowsPropsAreEqual);
