/**
 * Guards the table-body memo boundary.
 *
 * Opening a task drives roughly ten render passes of the whole task page —
 * the preview's loaders (comments, activity, notes, dependencies) each land
 * separately, plus the state mirrors between TaskPreview and
 * useTaskManagement. PR #217 stopped those passes re-rendering row *bodies*,
 * but React still had to build and prop-compare N row elements on every one
 * of them, because the row map sat directly in DraggableTaskTable's render.
 * Measured locally, emptying that map cut a task switch from ~383ms to
 * ~142ms.
 *
 * This boundary lets a pass that carries nothing the rows display stop here.
 * The two failure modes are opposite and both matter:
 *
 *   - too LOOSE → the table silently stops updating: a filter that doesn't
 *     apply, a renamed task that keeps its old title, a selection highlight
 *     stuck on the previous row;
 *   - too STRICT → the O(rows × passes) regression this exists to remove.
 */

import { describe, expect, it } from "vitest";

import {
    taskTableRowsPropsAreEqual,
    type TaskTableRowsProps,
} from "../features/tasks/components/table/TaskTableRows";
import type { UserProps } from "../types/admin";
import type { TagListProps, TaskTableProps } from "../types/tasks";

const ROWS = [{ id: "1" }, { id: "2" }] as unknown as TaskTableProps[];
const DEPTHS = new Map<string, number>();
const CHILDREN = new Map<string, TaskTableProps[]>();
const COLUMNS = [] as unknown as TaskTableRowsProps["columns"];
const EXPANDED = new Set<string>();
const SPRINTS = new Map<number, string>();
const MYSELF = { userId: "u1" } as unknown as UserProps;
const MEMBERS = [] as unknown as UserProps[];
const TAGS = [] as unknown as TagListProps[];
const RESOLVE = () => false;

// Rebuilt on every call, exactly as the hooks rebuild them each render.
// Their churn is precisely what this boundary must ignore.
const churningManagers = () =>
    ({
        useTM: {} as never,
        useTEM: {} as never,
        useCM: {} as never,
        useUISM: {} as never,
        setMyself: () => {},
        toggleExpand: () => {},
        onOpenDiagram: () => {},
        onQuickAddChild: () => {},
        onRequestPreview: () => {},
        onRowUpdate: async (t: TaskTableProps) => t,
        onQuickAddClose: () => {},
        onQuickAddDirtyChange: () => {},
        onQuickAddSubmit: async () => {},
    }) as unknown as Partial<TaskTableRowsProps>;

const baseProps = (over: Partial<TaskTableRowsProps> = {}): TaskTableRowsProps =>
    ({
        displayRows: ROWS,
        depthMap: DEPTHS,
        childrenByParent: CHILDREN,
        columns: COLUMNS,
        expandedRows: EXPANDED,
        sprintNamesById: SPRINTS,
        mode: "light",
        myself: MYSELF,
        teamMembers: MEMBERS,
        socket: null,
        quickAddParentId: null,
        quickAddFieldRules: null,
        quickAddProjectTags: TAGS,
        resolveIsSelected: RESOLVE,
        ...churningManagers(),
        ...over,
    }) as unknown as TaskTableRowsProps;

describe("taskTableRowsPropsAreEqual — must-skip (the reason it exists)", () => {
    it("skips when only the state-manager objects were rebuilt", () => {
        // This is the common case: a preview loader resolved, every hook
        // returned a fresh object, but nothing the rows render changed.
        // ~9 of the ~10 passes per click look exactly like this.
        expect(taskTableRowsPropsAreEqual(baseProps(), baseProps())).toBe(true);
    });

    it("skips when only the row-update callback identity changed", () => {
        // `handleRowUpdate` / `handleQuickAddSubmit` are rebuilt on every
        // parent render. DraggableTaskRow already excludes them from its own
        // comparator, so excluding them here adds no new staleness.
        const next = baseProps({ onRowUpdate: async (t: TaskTableProps) => t });
        expect(taskTableRowsPropsAreEqual(baseProps(), next)).toBe(true);
    });
});

describe("taskTableRowsPropsAreEqual — must-render (staleness guards)", () => {
    it("re-renders when the selection resolver changes", () => {
        // resolveIsSelected is rebuilt exactly when the preview selection
        // inputs change — this is how a task switch reaches the rows.
        const next = baseProps({ resolveIsSelected: () => true });
        expect(taskTableRowsPropsAreEqual(baseProps(), next)).toBe(false);
    });

    it("re-renders when the visible rows change (filter, sort, edit)", () => {
        const next = baseProps({ displayRows: [{ id: "1" }] as unknown as TaskTableProps[] });
        expect(taskTableRowsPropsAreEqual(baseProps(), next)).toBe(false);
    });

    it("re-renders when a row is expanded or collapsed", () => {
        expect(
            taskTableRowsPropsAreEqual(baseProps(), baseProps({ expandedRows: new Set(["1"]) }))
        ).toBe(false);
    });

    it("re-renders when the subtask index changes", () => {
        const next = baseProps({ childrenByParent: new Map([["1", []]]) });
        expect(taskTableRowsPropsAreEqual(baseProps(), next)).toBe(false);
    });

    it("re-renders when columns resize/reorder or the theme flips", () => {
        expect(
            taskTableRowsPropsAreEqual(
                baseProps(),
                baseProps({ columns: [] as unknown as TaskTableRowsProps["columns"] })
            )
        ).toBe(false);
        expect(taskTableRowsPropsAreEqual(baseProps(), baseProps({ mode: "dark" }))).toBe(false);
    });

    it("re-renders when the quick-add row opens, moves or closes", () => {
        expect(
            taskTableRowsPropsAreEqual(baseProps(), baseProps({ quickAddParentId: "1" }))
        ).toBe(false);
    });

    it("re-renders when quick-add field rules or project tags change", () => {
        expect(
            taskTableRowsPropsAreEqual(
                baseProps(),
                baseProps({ quickAddFieldRules: {} as TaskTableRowsProps["quickAddFieldRules"] })
            )
        ).toBe(false);
        expect(
            taskTableRowsPropsAreEqual(
                baseProps(),
                baseProps({ quickAddProjectTags: [] as unknown as TagListProps[] })
            )
        ).toBe(false);
    });

    it("re-renders when team members or sprint names resolve", () => {
        expect(
            taskTableRowsPropsAreEqual(
                baseProps(),
                baseProps({ teamMembers: [] as unknown as UserProps[] })
            )
        ).toBe(false);
        expect(
            taskTableRowsPropsAreEqual(
                baseProps(),
                baseProps({ sprintNamesById: new Map([[1, "S1"]]) })
            )
        ).toBe(false);
    });
});
